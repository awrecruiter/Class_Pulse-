# Feature: Lesson Resource Catalog

The following plan should be complete, but validate documentation and codebase patterns before implementing.
Pay special attention to naming of existing utils, types, and models. Import from the right files.

---

## Feature Description

A structured, per-lesson resource link catalog that teachers pre-load at year start and surface instantly during live class. Each YAAG lesson (e.g. Lesson 14.2) has named resource slots (Slides, Book, Worksheet, Video, Other). A shared defaults layer can be seeded once from district materials (CSV import). Each teacher can add their own resources or override defaults per-lesson. During live instruction, a voice command like "open slides" surfaces today's resource without any navigation.

## User Story

As a 5th-grade math teacher  
I want lesson-specific resource links pre-loaded against each YAAG lesson  
So that during live class I can open the right PowerPoint, textbook page, or worksheet instantly with a voice command instead of searching

## Problem Statement

Teachers waste instructional time switching between apps to find the right resource for each lesson. The YAAG system already knows what lesson is being taught today — but has no way to surface the corresponding materials. Resources live in Google Drive, district portals, and personal files with no organized lookup.

## Solution Statement

Add a two-layer resource catalog (shared defaults + per-teacher overrides) keyed to YAAG topic+lesson. Bulk-import via CSV at year start. Surface as a "Today's Resources" quick panel on the coach page and as voice commands that open URLs directly during live instruction. A dedicated `/resources` management page handles year-start setup and mid-year edits.

## Feature Metadata

**Feature Type**: New Capability  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: DB schema, API routes, voice command provider, coach page, new /resources page  
**Dependencies**: Existing `xlsx` library (already in package.json), `sessionRateLimiter`, YAAG data, `getTodayPacing()`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` (full file) — All table definitions, index patterns, upsert pattern to mirror
- `src/app/api/pacing/overrides/route.ts` (lines 1–81) — Canonical GET/POST/DELETE pattern: rate-limit → auth → zod → drizzle
- `src/app/api/classes/[id]/roster/import/route.ts` (full file) — XLSX+CSV import pattern using `xlsx` library, header detection, upsert
- `src/lib/voice/registry.ts` (full file) — `VOICE_SURFACES`, `VoiceSurfaceId`, navigation alias pattern
- `src/components/voice/voice-command-provider.tsx` (lines 351–600) — `handleCommand` dispatch, `AgentContext` type, fast-path regex patterns
- `src/contexts/voice-queue.tsx` (lines 1–120) — `QueueItemData` union type — THIS IS WHERE NEW COMMAND TYPE GETS ADDED
- `src/lib/pacing.ts` (full file) — `getTodayPacing()` signature, `TodayPacing` type
- `src/data/yaag-2025-2026.ts` (lines 1–30) — `YAAGLesson`, `YAAGTopic` types
- `src/lib/rate-limit.ts` (full file) — `createRateLimiter`, existing limiter instances
- `src/app/(dashboard)/settings/page.tsx` (lines 1–80) — Settings page client component pattern
- `src/components/schedule/schedule-sidebar-panel.tsx` (lines 1–100) — Schedule doc link rendering pattern

### New Files to Create

- `src/lib/db/schema.ts` — ADD two new tables (no new file)
- `src/app/api/resources/lesson/route.ts` — GET (fetch resources for topic+lesson), POST (upsert override), DELETE (remove override)
- `src/app/api/resources/lesson/import/route.ts` — POST multipart CSV/XLSX import
- `src/app/(dashboard)/resources/page.tsx` — Year-start management page (server shell)
- `src/components/resources/resource-catalog.tsx` — Main client component for /resources page
- `src/components/resources/lesson-resource-row.tsx` — Per-lesson expandable resource editor row
- `src/components/resources/resource-import-button.tsx` — CSV/XLSX upload button + parse preview
- `src/components/coach/today-resources-panel.tsx` — Coach page quick panel showing today's 3–4 resources
- `src/types/index.ts` — ADD `LessonResource`, `LessonResourceDefault` types (no new file)

### Patterns to Follow

**Table definition** — mirror `pacingLessonPlacements` (schema.ts lines ~875–895):
```ts
export const lessonResources = pgTable(
  "lesson_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherId: text("teacher_id").notNull(),
    topicNumber: integer("topic_number").notNull(),
    lessonNumber: text("lesson_number").notNull(),
    resourceType: text("resource_type").notNull(), // "slides"|"book"|"worksheet"|"video"|"other"
    label: text("label").notNull(),
    url: text("url").notNull(),
    isHidden: boolean("is_hidden").notNull().default(false), // hides a shared default
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp(...).defaultNow().notNull(),
    updatedAt: timestamp(...).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_lesson_resources_teacher_lesson_type").on(
      table.teacherId, table.topicNumber, table.lessonNumber, table.resourceType
    ),
    index("idx_lesson_resources_teacher_id").on(table.teacherId),
  ],
);
```

**Shared defaults table** — same shape but no teacherId, unique on (topicNumber, lessonNumber, resourceType):
```ts
export const lessonResourceDefaults = pgTable(
  "lesson_resource_defaults",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicNumber: integer("topic_number").notNull(),
    lessonNumber: text("lesson_number").notNull(),
    resourceType: text("resource_type").notNull(),
    label: text("label").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp(...).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_lesson_resource_defaults_topic_lesson_type").on(
      table.topicNumber, table.lessonNumber, table.resourceType
    ),
  ],
);
```

**Merge logic** (server-side, used in GET route):
```
effectiveResources = defaults
  .filter(d => !teacherOverrides.some(o => o.resourceType === d.resourceType && o.isHidden))
  .map(d => teacherOverrides.find(o => o.resourceType === d.resourceType) ?? d)
  .concat(teacherOverrides.filter(o => !defaults.some(d => d.resourceType === o.resourceType) && !o.isHidden))
  .sort(by sortOrder)
```

**API route pattern** — mirror `src/app/api/pacing/overrides/route.ts`:
```ts
export const dynamic = "force-dynamic";
// imports...
const schema = z.object({ ... });
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = sessionRateLimiter.check(ip);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ...drizzle query...
}
```

**CSV import pattern** — mirror `src/app/api/classes/[id]/roster/import/route.ts`:
- Use `formData()` not `request.json()`
- Use `xlsx` library: `XLSX.read(buffer, { type: "buffer" })`
- Normalize headers: `header.toLowerCase().replace(/\s+/g, "")`
- Expected CSV columns: `topicnumber`, `lessonnumber`, `resourcetype`, `label`, `url`
- Upsert each row with `onConflictDoUpdate`

**Voice command type** — ADD to `QueueItemData` union in `src/contexts/voice-queue.tsx`:
```ts
| { type: "open_resource"; resourceType: "slides" | "book" | "worksheet" | "video" | "other" }
```

**Voice fast-path regex** — ADD to voice-command-provider.tsx fast-path section (before agent API call):
```ts
const openResourceMatch = /\bopen\s+(slides?|slide\s+deck|powerpoint|book|textbook|worksheet|video)\b/i.exec(lower);
if (openResourceMatch) {
  const rawType = openResourceMatch[1].toLowerCase();
  const resourceType = rawType.startsWith("slide") || rawType.includes("power") ? "slides"
    : rawType.includes("book") ? "book"
    : rawType.includes("work") ? "worksheet"
    : "video";
  dispatch({ type: "open_resource", resourceType });
  return;
}
```

**Voice command handler** — ADD case in `handleCommand` (voice-command-provider.tsx ~line 370):
```ts
if (data.type === "open_resource") {
  // fetch today's pacing to get topic+lesson, then fetch resources
  const pacing = getTodayPacing(undefined, activeTopicOverride);
  if (!pacing?.currentLesson) { toast.error("No active lesson"); return; }
  const res = await fetch(`/api/resources/lesson?topic=${pacing.topic.number}&lesson=${encodeURIComponent(pacing.currentLesson.number)}`);
  const { resources } = await res.json();
  const match = resources.find((r: LessonResource) => r.resourceType === data.resourceType);
  if (match) window.open(match.url, "_blank");
  else toast.error(`No ${data.resourceType} linked for this lesson`);
  return;
}
```

**Voice registry** — ADD "open slides", "open book", "open worksheet", "open video" to the `coach` surface's `commands` array in `src/lib/voice/registry.ts`.

**Nav link** — ADD to `NAV_LINKS` in `src/components/nav-bar.tsx`:
```ts
{ href: "/resources", label: "Resources", icon: BookOpenIcon },
```

---

## IMPLEMENTATION PLAN

### Phase 1: Schema + Migration

Add two tables to the DB. Run `npm run db:push` after.

### Phase 2: API Routes

Three routes:
1. `GET/POST/DELETE /api/resources/lesson` — fetch merged resources, upsert override, delete override
2. `POST /api/resources/lesson/import` — bulk CSV/XLSX import into teacher overrides OR defaults

### Phase 3: Voice Integration

Add `open_resource` command type, fast-path regex, and handler. Update registry.

### Phase 4: UI — Coach Page Panel

`TodayResourcesPanel` component on the coach page: shows the 2–4 resources for today's lesson with one-tap open. Appears in the right column when a session is live.

### Phase 5: UI — Resources Management Page

`/resources` page: YAAG-driven table. All 18 topics, expandable to lessons. Each lesson shows resource slots. CSV import button at top. Inline edit of each resource URL.

---

## STEP-BY-STEP TASKS

### TASK 1 — UPDATE `src/lib/db/schema.ts`

- **ADD** `lessonResourceDefaults` table after `pacingLessonPlacements` block (~line 900)
- **ADD** `lessonResources` table immediately after
- **FIELDS** for both: see Pattern section above
- **RESOURCE_TYPES**: `"slides" | "book" | "worksheet" | "video" | "other"` — stored as plain text, no enum
- **GOTCHA**: Use `boolean("is_hidden")` not `text`. `boolean` is valid in Drizzle Postgres.
- **VALIDATE**: `npx tsc --noEmit`

### TASK 2 — UPDATE `src/types/index.ts`

- **ADD** exported types:
```ts
export type LessonResourceType = "slides" | "book" | "worksheet" | "video" | "other";
export type LessonResource = {
  id: string;
  topicNumber: number;
  lessonNumber: string;
  resourceType: LessonResourceType;
  label: string;
  url: string;
  sortOrder: number;
  isTeacherOverride: boolean; // true if from lessonResources, false if from defaults
};
```
- **VALIDATE**: `npx tsc --noEmit`

### TASK 3 — CREATE `src/app/api/resources/lesson/route.ts`

- **IMPLEMENT GET**: query params `topic` (int) + `lesson` (string). Fetch defaults and teacher overrides in parallel. Merge: defaults filtered by teacher hide-list, then teacher-only additions. Sort by `sortOrder`. Return `{ resources: LessonResource[] }`.
- **IMPLEMENT POST**: body `{ topicNumber, lessonNumber, resourceType, label, url, sortOrder?, isHidden? }`. Upsert with `onConflictDoUpdate` targeting `(teacherId, topicNumber, lessonNumber, resourceType)`.
- **IMPLEMENT DELETE**: query param `id` (UUID). Delete from `lessonResources` where `id` AND `teacherId`. Teachers cannot delete defaults — they use `isHidden: true` instead.
- **RATE LIMITER**: `sessionRateLimiter`
- **ZOD**: resourceType: `z.enum(["slides","book","worksheet","video","other"])`, url: `z.string().url().max(2048)`, label: `z.string().max(120)`
- **PATTERN**: mirror `src/app/api/pacing/overrides/route.ts` exactly
- **VALIDATE**: `npx tsc --noEmit`

### TASK 4 — CREATE `src/app/api/resources/lesson/import/route.ts`

- **IMPLEMENT POST**: multipart form with `file` field (CSV or XLSX)
- **PARSE**: use `xlsx` library — `import * as XLSX from "xlsx"`. `formData()` → `file.arrayBuffer()` → `XLSX.read(buffer, { type: "buffer" })`. Get first sheet. `XLSX.utils.sheet_to_json(sheet, { header: 1 })`.
- **HEADERS** (normalize to lowercase+no-spaces): `topicnumber`, `lessonnumber`, `resourcetype`, `label`, `url`, `sortorder` (optional)
- **VALIDATION**: each row — topicNumber 1–18, lessonNumber non-empty, resourceType in enum, url must start with http
- **TARGET**: if request has `?defaults=true` query param AND teacher is an admin (skip for now — just upsert into `lessonResources`), else upsert into teacher overrides
- **UPSERT**: batch insert all valid rows into `lessonResources` with `onConflictDoUpdate`
- **RETURN**: `{ imported: number, skipped: number, errors: string[] }`
- **RATE LIMITER**: `sessionRateLimiter`
- **GOTCHA**: multipart requires `await request.formData()` NOT `await request.json()`
- **PATTERN**: mirror `src/app/api/classes/[id]/roster/import/route.ts` lines 1–100
- **VALIDATE**: `npx tsc --noEmit`

### TASK 5 — UPDATE `src/contexts/voice-queue.tsx`

- **ADD** to `QueueItemData` union:
```ts
| { type: "open_resource"; resourceType: "slides" | "book" | "worksheet" | "video" | "other" }
```
- **ADD** to `VOICE_COMMANDS` array (if one exists) or wherever command labels are listed: `"open slides"`, `"open book"`, `"open worksheet"`, `"open video"`
- **VALIDATE**: `npx tsc --noEmit`

### TASK 6 — UPDATE `src/lib/voice/registry.ts`

- **ADD** to `coach` surface `commands` array:
  ```ts
  "open slides",
  "open book",
  "open worksheet",
  "open video",
  "open resource",
  ```
- **VALIDATE**: `npx tsc --noEmit`

### TASK 7 — UPDATE `src/components/voice/voice-command-provider.tsx`

- **ADD** fast-path regex block BEFORE the agent API call (find the section that has other fast-paths like `ram_bucks` regex). Add:
```ts
// Fast path: "open [resource type]"
const openResourceMatch = /\bopen\s+(slides?|slide\s*deck|powerpoint|ppt|book|textbook|worksheet|video)\b/i.exec(lower);
if (openResourceMatch) {
  const rawType = openResourceMatch[1].toLowerCase();
  const resourceType: "slides"|"book"|"worksheet"|"video" =
    /slide|power|ppt/.test(rawType) ? "slides"
    : /book|text/.test(rawType) ? "book"
    : /work|sheet/.test(rawType) ? "worksheet"
    : "video";
  enqueue({ type: "open_resource", resourceType });
  return;
}
```
- **ADD** handler in `handleCommand` function, right after the `open_doc` case:
```ts
if (data.type === "open_resource") {
  const pacing = getTodayPacing();
  if (!pacing?.currentLesson) {
    toast.error("No active lesson to open resources for");
    return;
  }
  try {
    const res = await fetch(
      `/api/resources/lesson?topic=${pacing.topic.number}&lesson=${encodeURIComponent(pacing.currentLesson.number)}`
    );
    const { resources } = (await res.json()) as { resources: LessonResource[] };
    const match = resources.find((r) => r.resourceType === data.resourceType);
    if (match) {
      window.open(match.url, "_blank", "noopener,noreferrer");
      toast.success(`Opening ${match.label}`);
    } else {
      toast.error(`No ${data.resourceType} linked for Lesson ${pacing.currentLesson.number}`);
    }
  } catch {
    toast.error("Could not load resources");
  }
  return;
}
```
- **IMPORTS needed**: `getTodayPacing` from `@/lib/pacing`, `type LessonResource` from `@/types`
- **GOTCHA**: `getTodayPacing` is a pure sync function — no await needed
- **VALIDATE**: `npx tsc --noEmit`

### TASK 8 — CREATE `src/components/coach/today-resources-panel.tsx`

- **IMPLEMENT** client component `TodayResourcesPanel({ topicNumber, lessonNumber }: { topicNumber: number; lessonNumber: string })`
- **FETCH** `GET /api/resources/lesson?topic=X&lesson=Y` on mount
- **RENDER** a row of resource chips per type: icon + label + click to open in new tab
- **ICONS**: use lucide-react — `PresentationIcon` for slides, `BookOpen` for book, `FileText` for worksheet, `Video` for video
- **EMPTY STATE**: if no resources, show "No resources linked for this lesson — add them in Resources"
- **STYLE**: match existing coach page panels — `bg-slate-900/60 border border-slate-800 rounded-xl p-3`
- **VALIDATE**: `npx tsc --noEmit`

### TASK 9 — UPDATE `src/app/(dashboard)/coach/page.tsx`

- **ADD** `TodayResourcesPanel` below `DailyAssignmentInput` when `selectedClassId && showOrbArea && todayPacing?.currentLesson`
- **PASS** `topicNumber={todayPacing.topic.number}` and `lessonNumber={todayPacing.currentLesson.number}`
- **IMPORT** `getTodayPacing` (already available via the schedule sidebar — check if already imported, if not add it)
- **GOTCHA**: Read 20 lines above/below insertion point before editing. The coach page uses tabs for indentation throughout.
- **VALIDATE**: `npx tsc --noEmit`

### TASK 10 — CREATE `src/components/resources/resource-import-button.tsx`

- **IMPLEMENT** `ResourceImportButton({ onImported }: { onImported: () => void })`
- **RENDER**: file input (CSV or .xlsx) + "Import from CSV" button
- **ON SELECT**: POST multipart to `/api/resources/lesson/import` with the file
- **SHOW RESULT**: toast with `Imported X resources, skipped Y`
- **CSV TEMPLATE DOWNLOAD**: include a link to download a sample CSV template with correct headers
- **SAMPLE TEMPLATE** headers: `topicNumber,lessonNumber,resourceType,label,url`
- **VALIDATE**: `npx tsc --noEmit`

### TASK 11 — CREATE `src/components/resources/lesson-resource-row.tsx`

- **IMPLEMENT** `LessonResourceRow({ topic, lesson, resources, onSave, onDelete }: Props)`
- **RENDER** expandable row: lesson number + title → expand to show resource type slots
- **EACH SLOT**: type label + URL input + label input + Save button + (if teacher override) Delete/Reset button
- **HIDE DEFAULT**: checkbox "Hide this resource" sets `isHidden: true` via POST
- **SAVE**: POST `/api/resources/lesson` with upsert payload
- **DELETE**: DELETE `/api/resources/lesson?id=X` for teacher overrides
- **STYLE**: match pacing calendar cell aesthetic

### TASK 12 — CREATE `src/components/resources/resource-catalog.tsx`

- **IMPLEMENT** client component `ResourceCatalog()`
- **FETCH** all teacher's overrides on mount: `GET /api/resources/lesson` (no params = return all teacher overrides)
- **RENDER**: group by topic → expandable topic accordion → lesson rows
- **TOPIC HEADER**: Topic roman + title + standard codes + lesson count
- **ADD RESOURCE IMPORT BUTTON** at top
- **ADD RESOURCE** button per lesson opens inline form for new resource slot
- **STATE**: local optimistic updates on save/delete
- **VALIDATE**: `npx tsc --noEmit`

### TASK 13 — CREATE `src/app/(dashboard)/resources/page.tsx`

- **IMPLEMENT** minimal server component shell:
```tsx
import { ResourceCatalog } from "@/components/resources/resource-catalog";
export default function ResourcesPage() {
  return <ResourceCatalog />;
}
```
- **VALIDATE**: `npx tsc --noEmit`

### TASK 14 — UPDATE `src/components/nav-bar.tsx`

- **ADD** to `NAV_LINKS`:
```ts
{ href: "/resources", label: "Resources", icon: BookOpenIcon },
```
- **NOTE**: `BookOpenIcon` is already imported
- **POSITION**: between Gradebook and Store (or after Pacing — pick a logical spot)
- **VALIDATE**: `npx tsc --noEmit`

### TASK 15 — UPDATE `src/middleware.ts`

- **CHECK** if `/resources` needs adding to protected routes. Read the file first.
- **ADD** `/resources` to protected paths if not already covered by a wildcard
- **VALIDATE**: `npx tsc --noEmit`

### TASK 16 — UPDATE `GET /api/resources/lesson` to support no-params (all overrides)

- When neither `topic` nor `lesson` params are present, return ALL teacher override rows (for the catalog page to build its full view without N+1 requests)
- **VALIDATE**: `npx tsc --noEmit`

### TASK 17 — RUN DB MIGRATION

- **COMMAND**: `npm run db:push` (user must run this directly as `! npm run db:push`)
- Confirm both `lesson_resources` and `lesson_resource_defaults` tables are created
- **VALIDATE**: `npx tsc --noEmit && npm run lint:fix`

### TASK 18 — LINT + FINAL VALIDATION

- **RUN**: `npm run lint:fix`
- **RUN**: `npx tsc --noEmit`
- **RUN**: `npm run test:run`
- Fix any issues before committing

---

## TESTING STRATEGY

### Unit Tests

No new unit tests required for this feature (existing test suite has no unit tests for UI components or API routes that hit the DB — all DB-touching routes are integration-tested manually). However, if adding tests:

- Test the CSV header normalization function in isolation
- Test the merge logic (defaults + overrides → effective resources) as a pure function
- **Pattern**: mirror `src/lib/__tests__/rate-limit.test.ts` for pure function tests

### Edge Cases to Validate Manually

- Import CSV with missing columns → should return errors array, not crash
- Import CSV with invalid URLs → skip that row, report in errors
- Teacher hides a default resource → it disappears from the GET result
- Teacher adds resource for a lesson with no defaults → appears only for that teacher
- Voice command "open slides" when no lesson is active → graceful toast error
- Voice command "open slides" when lesson has no slides linked → graceful toast error
- Resource URL with spaces or special characters → should be stored as-is, opened via `window.open`
- XLSX file (not CSV) → should parse correctly with same column structure

---

## VALIDATION COMMANDS

### Level 1: Type + Lint
```bash
npx tsc --noEmit
npm run lint:fix
```

### Level 2: Unit Tests
```bash
npm run test:run
```

### Level 3: Manual API Testing
```bash
# After db:push and dev server running:
# 1. GET today's resources (should return empty array initially)
curl http://localhost:3000/api/resources/lesson?topic=14&lesson=14.1

# 2. POST a resource override
curl -X POST http://localhost:3000/api/resources/lesson \
  -H "Content-Type: application/json" \
  -d '{"topicNumber":14,"lessonNumber":"14.1","resourceType":"slides","label":"Lesson 14.1 Slides","url":"https://example.com/slides"}'

# 3. GET again — should include the new resource
curl http://localhost:3000/api/resources/lesson?topic=14&lesson=14.1
```

### Level 4: Manual UI Testing
1. Navigate to `/resources` — should load all 18 topics grouped
2. Expand Topic XIV → Lesson 14.1 → add a slides URL → save → reload page → confirm persisted
3. Upload the sample CSV template → confirm resources appear
4. Go to `/coach` with a live session on Lesson 14.1 → Today's Resources panel shows slides chip
5. Say "open slides" into voice command → browser opens the URL in new tab
6. Say "open book" with no book linked → toast: "No book linked for Lesson 14.1"

---

## ACCEPTANCE CRITERIA

- [ ] `lesson_resources` and `lesson_resource_defaults` tables exist in DB
- [ ] `GET /api/resources/lesson?topic=X&lesson=Y` returns merged defaults + teacher overrides
- [ ] `POST /api/resources/lesson` upserts a teacher resource override
- [ ] `DELETE /api/resources/lesson?id=X` removes a teacher override
- [ ] `POST /api/resources/lesson/import` accepts CSV and XLSX, imports valid rows
- [ ] `/resources` page renders all YAAG lessons grouped by topic
- [ ] Inline editing and saving of resource URLs works without page reload
- [ ] `TodayResourcesPanel` on coach page shows today's lesson resources
- [ ] Voice command "open slides" opens the slides URL for today's lesson
- [ ] Voice command "open book" / "open worksheet" / "open video" works the same way
- [ ] Graceful error when no resource is linked (toast, not crash)
- [ ] `npm run lint:fix` passes with no errors in new files
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run test:run` all 30 test files pass

---

## NOTES

### Two-Layer Design Rationale
The `lessonResourceDefaults` table exists for future sharing: a district admin or the app itself can seed default resource links once, and all teachers get them without having to import. In practice for v1, defaults will be empty — teachers populate via CSV or manual entry. The override system is ready for day 1.

### No RAG Needed
Resources are keyed by exact topic+lesson, so retrieval is a simple indexed DB lookup. AI semantic search adds complexity and cost with no benefit here.

### Voice Command Scope
Only "open [type]" is implemented as a fast-path. More complex commands ("what resources do I have for next week?") would go through the voice agent API — but are out of scope for v1.

### CSV Template
The import route should accept the most minimal possible CSV. Teachers will build their own or export from Google Sheets. A downloadable template with correct headers is enough guidance.

### URL Storage
URLs are stored verbatim (up to 2048 chars). No validation that the URL is reachable at save time — that would require server-side HTTP requests and adds latency. Teachers will notice broken links the first time they try to open them.

### Future: Shared Defaults Import
When a district wants to seed defaults for all teachers, an admin endpoint `POST /api/resources/lesson/import?defaults=true` can write to `lessonResourceDefaults` instead. This is stubbed in the import route but not exposed in the UI for v1.

---

## CONFIDENCE SCORE: 8.5/10

**Risks:**
- Voice command provider is a large, complex file (~1090 lines) — read the exact lines around the fast-path insertion point before editing to avoid breaking existing paths
- Coach page is also large — use targeted edits, read surrounding context before every change
- The merge logic (defaults + overrides) needs careful handling of the `isHidden` flag
