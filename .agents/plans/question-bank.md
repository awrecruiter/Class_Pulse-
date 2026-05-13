# Feature: Question Bank

The following plan should be complete, but validate documentation and codebase patterns before implementing.
Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

After a teacher uploads a PDF (bell ringer, CFU set, exit ticket) to S3, Claude automatically
extracts the questions and stores them in a persistent question bank. The teacher sees a cockpit
panel showing all their questions, drags questions into a daily queue, and during a live session
pushes questions one at a time to student screens via the existing SSE infrastructure.

## User Story

As a 5th-grade math teacher
I want to upload a PDF and have questions automatically extracted into a bank I can queue and push to students
So that I can run structured question sessions without manual data entry

## Problem Statement

Currently uploaded PDFs are only accessible as links. There is no way to extract, manage, or deliver
individual questions to students from uploaded resources.

## Solution Statement

Three-layer system:
1. **Extract** — after S3 upload, POST to `/api/questions/extract` → Claude reads the PDF as a base64 document → returns structured JSON → saved to `questionBankItems` table
2. **Queue** — cockpit panel shows question bank; teacher drags cards into a daily `questionQueue`
3. **Push** — teacher hits "Send Next" during session → saves to `questionPushes` table → student SSE polls → question appears on student screen

---

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High
**Primary Systems Affected**: DB schema, Claude AI, cockpit UI, student-feed SSE, student screen
**Dependencies**: Anthropic SDK (already installed), existing S3 upload flow, existing SSE push pattern

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` (lines 272–290) — `manipulativePushes` table: mirror this exact pattern for `questionPushes`
- `src/lib/db/schema.ts` (lines 940–970) — `lessonResources` table: shows importDate pattern + resourceData jsonb
- `src/app/api/sessions/[id]/push/route.ts` — teacher push API: mirror auth + DB insert pattern for question push
- `src/app/api/sessions/[id]/student-feed/route.ts` (lines 240–265) — SSE poll for `manipulativePushes`: mirror for `questionPushes`
- `src/lib/ai/drawing-analysis.ts` (lines 31–80) — Claude API call with base64 content: mirror for PDF document block
- `src/app/api/resources/pdf/presign/route.ts` — auth + rate-limit pattern for new API routes
- `src/app/(dashboard)/cockpit/upload-panel.tsx` (lines 131–175) — `handleFileUpload`: add extraction trigger here after `saveResourceUrl` succeeds
- `src/lib/rate-limit.ts` — add `questionExtractLimiter` here

### New Files to Create

- `src/lib/ai/question-extract.ts` — Claude PDF extraction logic
- `src/app/api/questions/extract/route.ts` — POST: download PDF from S3, call Claude, save to bank
- `src/app/api/questions/route.ts` — GET: return teacher's question bank
- `src/app/api/questions/[id]/route.ts` — DELETE: remove a question
- `src/app/api/questions/queue/route.ts` — GET/POST: get/add to daily queue
- `src/app/api/questions/queue/[id]/route.ts` — DELETE/PATCH: remove or reorder
- `src/app/api/sessions/[id]/question-push/route.ts` — POST: push question to students
- `src/components/cockpit/question-bank-panel.tsx` — bank + queue UI with drag-and-drop
- `drizzle/0018_question_bank.sql` — migration (auto-generated via `db:generate`)

### Relevant Documentation

- Claude document blocks: `https://docs.anthropic.com/en/docs/build-with-claude/pdf-support`
  - Use `type: "document"` with `source.type: "base64"` and `media_type: "application/pdf"`
  - Model must be `claude-sonnet-4-6` or higher for reliable PDF extraction (Haiku misses questions)
  - Max PDF size per API call: 32 MB — well within our 10 MB upload limit
- Drizzle jsonb: `jsonb("col")` — already used in `lessonResources.resourceData`

### Patterns to Follow

**API route auth + rate-limit (copy from `src/app/api/resources/pdf/presign/route.ts`):**
```ts
export const dynamic = "force-dynamic";
const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
const { success } = someRateLimiter.check(ip);
if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
const { data } = await auth.getSession();
if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Claude base64 call (mirror `src/lib/ai/drawing-analysis.ts` lines 40–55):**
```ts
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 2000,
  messages: [{
    role: "user",
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
      { type: "text", text: EXTRACTION_PROMPT }
    ]
  }]
});
```

**SSE poll pattern (mirror student-feed lines 240–265):**
```ts
const [latest] = await db.select().from(questionPushes)
  .where(eq(questionPushes.sessionId, sessionId))
  .orderBy(desc(questionPushes.pushedAt)).limit(1);
if (latest && latest.id !== lastQuestionPushId) {
  lastQuestionPushId = latest.id;
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "question-push", question: JSON.parse(latest.questionJson) })}\n\n`));
}
```

**Zod v4 imports (this codebase uses zod/v4):**
```ts
import { z } from "zod/v4";
```

**Tab indentation** — all TSX/TS files use TABS not spaces.

---

## IMPLEMENTATION PLAN

### Phase 1: Schema + Migration

Add two new tables to `src/lib/db/schema.ts`:

**`questionBankItems`**
```ts
export const questionBankItems = pgTable("question_bank_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  teacherId: text("teacher_id").notNull(),
  sourceUrl: text("source_url").notNull(),       // S3 URL of the source PDF
  sourceFilename: text("source_filename").notNull(),
  resourceType: text("resource_type").notNull(), // "bell-ringer" | "cfu" | "exit-ticket"
  standardCode: text("standard_code"),
  stem: text("stem").notNull(),                   // question text
  choices: jsonb("choices"),                      // null for free-response; array of strings for MC
  answer: text("answer").notNull(),
  questionType: text("question_type").notNull().default("free-response"), // "mc" | "free-response"
  sortOrder: integer("sort_order").notNull().default(0),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_qbank_teacher_id").on(table.teacherId),
  index("idx_qbank_resource_type").on(table.resourceType),
]);
```

**`questionPushes`**
```ts
export const questionPushes = pgTable("question_pushes", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => classSessions.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").references(() => questionBankItems.id, { onDelete: "set null" }),
  questionJson: text("question_json").notNull(), // snapshot at push time
  pushedAt: timestamp("pushed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_qpushes_session_id").on(table.sessionId),
]);
```

Note: `questionQueue` is **client-side state only** (React state + localStorage). No DB table needed — queue is ephemeral and per-session. Teacher builds queue on cockpit, pushes one at a time.

### Phase 2: AI Extraction

**`src/lib/ai/question-extract.ts`**

```ts
export type ExtractedQuestion = {
  stem: string;
  choices: string[] | null;   // null = free-response
  answer: string;
  standardCode: string | null;
  questionType: "mc" | "free-response";
};

export type ExtractionResult = {
  questions: ExtractedQuestion[];
  resourceType: "bell-ringer" | "cfu" | "exit-ticket" | "unknown";
};
```

System prompt for Claude:
- Extract ALL questions from the PDF
- For each: stem, answer choices (if MC), correct answer, FL BEST standard code if visible
- Return strict JSON — no markdown fences
- If no standard codes visible, set standardCode to null
- Detect resource type from document title/header

### Phase 3: API Routes

1. **`POST /api/questions/extract`**
   - Body: `{ url: string, filename: string, resourceType: string }`
   - Downloads PDF from S3 URL as ArrayBuffer → converts to base64
   - Calls `extractQuestionsFromPdf(pdfBase64, filename)` 
   - Bulk inserts into `questionBankItems`
   - Returns `{ count: number, questions: ExtractedQuestion[] }`
   - Rate limit: 5/min (`questionExtractLimiter`)

2. **`GET /api/questions`**
   - Query params: `?resourceType=bell-ringer&date=YYYY-MM-DD`
   - Returns teacher's bank, filtered
   - Returns `{ questions: QuestionBankItem[] }`

3. **`DELETE /api/questions/[id]`**
   - Deletes one question from bank

4. **`POST /api/sessions/[id]/question-push`**
   - Body: `{ questionId: string }`
   - Fetches question from bank, snapshots to `questionPushes`
   - Returns `{ ok: true, pushId: string }`

### Phase 4: SSE Extension

In `src/app/api/sessions/[id]/student-feed/route.ts`:
- Import `questionPushes` from schema
- Add `let lastQuestionPushId: string | null = null;`
- Add poll inside the existing interval: check `questionPushes` by sessionId, send if new
- Event shape: `{ type: "question-push", pushId, question: { stem, choices, answer, questionType } }`

### Phase 5: Cockpit Panel UI

**`src/components/cockpit/question-bank-panel.tsx`**

Layout (two columns):
```
┌──────────────────┬──────────────────┐
│   Question Bank  │   Today's Queue  │
│  (all extracted) │  (drag from bank)│
│                  │                  │
│  [Q card]        │  1. [Q card] ↕   │
│  [Q card]        │  2. [Q card] ↕   │
│  [Q card]        │                  │
│                  │  [Send Next →]   │
└──────────────────┴──────────────────┘
```

- Left: fetches from `GET /api/questions`, shows question cards with stem + answer + standard chip
- Right: queue (React state array), drag-and-drop reorder via `@dnd-kit` (already installed)
- Drag from left → appends to right queue
- "Send Next" button: POSTs to `/api/sessions/[id]/question-push` with `queue[0].id`, shifts queue

### Phase 6: Upload Panel Integration

After `saveResourceUrl(objectUrl)` succeeds in `handleFileUpload`, trigger extraction:
```ts
// Fire-and-forget — don't block the UI
fetch("/api/questions/extract", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: objectUrl, filename: pickedFile.name, resourceType }),
}).catch(() => {}); // silent — bank will just be empty if it fails
toast.info("Extracting questions in background…");
```

### Phase 7: Student Screen

In the student session screen, handle the new SSE event type:
- `{ type: "question-push", question: { stem, choices, answer, questionType } }`
- Show question card with stem
- MC: show answer buttons → on select, highlight correct/incorrect
- Free-response: show text input → submit → show correct answer
- "Ready for next" button resets student to waiting state

---

## STEP-BY-STEP TASKS

### TASK 1: UPDATE `src/lib/db/schema.ts`
- **ADD** `questionBankItems` table after `lessonResources`
- **ADD** `questionPushes` table after `questionBankItems`
- **ADD** both to relations if needed
- **VALIDATE**: `npx tsc --noEmit`

### TASK 2: UPDATE `src/lib/rate-limit.ts`
- **ADD** `export const questionExtractLimiter = createRateLimiter(5, 60_000);`
- **VALIDATE**: `npx tsc --noEmit`

### TASK 3: RUN `npm run db:generate` then `npm run db:push`
- Generates migration file `drizzle/0018_question_bank.sql`
- Pushes to DB
- **VALIDATE**: confirm tables exist

### TASK 4: CREATE `src/lib/ai/question-extract.ts`
- **IMPLEMENT** `extractQuestionsFromPdf(pdfBase64: string, filename: string, resourceType: string): Promise<ExtractionResult>`
- **PATTERN**: mirror `src/lib/ai/drawing-analysis.ts` lines 31–80
- **MODEL**: `claude-sonnet-4-6` (not Haiku — PDF extraction needs stronger reasoning)
- **PROMPT**: extract all questions, return strict JSON array, detect MC vs free-response
- **VALIDATE**: `npx tsc --noEmit`

### TASK 5: CREATE `src/app/api/questions/extract/route.ts`
- **IMPLEMENT** POST handler
- **PATTERN**: auth + rate-limit from `src/app/api/resources/pdf/presign/route.ts`
- **FLOW**: validate body → fetch PDF from S3 URL → base64 → call `extractQuestionsFromPdf` → bulk insert `questionBankItems`
- **GOTCHA**: `fetch(s3Url)` works server-side without auth since bucket is public-read
- **VALIDATE**: `npx tsc --noEmit`

### TASK 6: CREATE `src/app/api/questions/route.ts`
- **IMPLEMENT** GET handler returning `questionBankItems` for authenticated teacher
- **FILTER**: optional `?resourceType=` and `?date=` params
- **VALIDATE**: `npx tsc --noEmit`

### TASK 7: CREATE `src/app/api/questions/[id]/route.ts`
- **IMPLEMENT** DELETE handler — verify teacherId ownership before deleting
- **VALIDATE**: `npx tsc --noEmit`

### TASK 8: CREATE `src/app/api/sessions/[id]/question-push/route.ts`
- **IMPLEMENT** POST handler
- **PATTERN**: mirror `src/app/api/sessions/[id]/push/route.ts` exactly
- **FLOW**: verify session ownership → fetch question → insert `questionPushes` with JSON snapshot
- **VALIDATE**: `npx tsc --noEmit`

### TASK 9: UPDATE `src/app/api/sessions/[id]/student-feed/route.ts`
- **ADD** import for `questionPushes`
- **ADD** `let lastQuestionPushId: string | null = null;` alongside `lastPushId`
- **ADD** question push poll inside existing interval (mirror the manipulativePushes poll, lines 240–265)
- **GOTCHA**: use `desc(questionPushes.pushedAt)` and check `id !== lastQuestionPushId`
- **VALIDATE**: `npx tsc --noEmit`

### TASK 10: UPDATE `src/app/(dashboard)/cockpit/upload-panel.tsx`
- **ADD** fire-and-forget `fetch("/api/questions/extract", ...)` after `saveResourceUrl` succeeds
- **ADD** toast: `toast.info("Extracting questions in background…")`
- **ONLY** trigger for `resourceType !== "pacing"` (pacing guides have no Q&A)
- **VALIDATE**: `npx tsc --noEmit`

### TASK 11: CREATE `src/components/cockpit/question-bank-panel.tsx`
- **IMPLEMENT** two-column layout: bank (left) + queue (right)
- **USE** `@dnd-kit` for drag-and-drop — it's already installed, mirror `src/components/classes/groups-kanban.tsx` for DnD setup
- **STATE**: queue is local React state (array of `QuestionBankItem`)
- **FETCH**: bank from `GET /api/questions?resourceType=...`
- **SEND NEXT**: POST to `/api/sessions/[id]/question-push`, shift queue[0] off front
- **SESSION ID**: accept `activeSessionId: string | null` as prop — disable Send Next if null
- **VALIDATE**: `npx tsc --noEmit`

### TASK 12: ADD panel to cockpit page
- **READ** `src/app/(dashboard)/cockpit/page.tsx` fully before touching
- **ADD** `<QuestionBankPanel activeSessionId={activeSessionId} />` in appropriate column
- **VALIDATE**: `npx tsc --noEmit`

### TASK 13: UPDATE student session screen
- **FIND** student session page: `src/app/student/` 
- **ADD** handler for `{ type: "question-push" }` SSE event
- **RENDER** question card: stem + MC buttons or free-response input
- **VALIDATE**: `npx tsc --noEmit`

### TASK 14: RUN full validation
- **VALIDATE**: `npm run validate`

---

## TESTING STRATEGY

### Unit Tests
- `src/lib/ai/__tests__/question-extract.test.ts` — mock Anthropic client, verify JSON parsing handles malformed Claude output gracefully

### Edge Cases
- PDF with no detectable questions → return empty array, no DB insert, show toast "No questions found"
- Claude returns malformed JSON → catch + log, return empty array
- Student screen receives push with no active session → ignore silently
- Queue empty when "Send Next" clicked → button disabled

---

## VALIDATION COMMANDS

```bash
npx tsc --noEmit          # after every file edit
npm run lint:fix          # fix formatting
npm run validate          # full suite before commit
npm run db:push           # after schema changes
```

---

## ACCEPTANCE CRITERIA

- [ ] Upload a bell ringer PDF → questions appear in bank within ~10 seconds
- [ ] Teacher can delete individual questions from bank
- [ ] Teacher can drag questions into daily queue and reorder
- [ ] During live session, "Send Next" pushes question to student screens
- [ ] Student screen shows question, accepts answer, reveals correct answer
- [ ] Pacing guide uploads do NOT trigger extraction (no questions to extract)
- [ ] Empty PDF (no questions found) shows toast, does not crash
- [ ] All validation commands pass

---

## NOTES

- Queue is intentionally ephemeral (React state only) — teacher rebuilds each class. Adding persistence later is trivial (add `questionQueue` table) but not needed for v1.
- Use `claude-sonnet-4-6` for extraction (not Haiku) — PDF reasoning is more reliable with the larger model. Extraction only happens once per upload so cost is negligible.
- Student answer correctness checking happens client-side (compare to `answer` field from push payload) — no server roundtrip needed.
- The `questionPushes.questionJson` column stores a snapshot at push time so deleted questions still display correctly on student screen.

**Confidence Score**: 8/10
