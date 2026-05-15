# Feature: Question Week Panel — Day-Group Assignment to Weekly Buckets

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to: the @dnd-kit DndContext location, the existing QuestionBankPanel being fully replaced, the WeeklyResourcesPanel staying untouched (it shows file links — separate concern), and the server-side query for initial question counts in the weekly grid.

## Feature Description

Bell ringer / CFU / exit-ticket PDFs contain questions grouped by instructional "Day N" (e.g., "Topic 1: Day 2"). This feature replaces the current "Today's Queue" panel with a week-view panel that shows Mon–Fri day columns as drop buckets. The teacher:

1. Uploads a PDF → questions appear in the bank grouped as "Day 2 · 4 Qs", "Day 3 · 3 Qs"
2. Selects a resource type tab (Bell Ringer / CFU / Exit Ticket) — both bank and week columns filter to that type
3. Drags a day-group from the bank → drops into a day column (Mon/Tue/Wed/Thu/Fri)
4. The assignment saves to DB (`assignedDate` on `questionBankItems`) — persists on reload
5. Today's column shows a push-to-students button (→) per question during a live session

## User Story

As a 5th grade math teacher,  
I want to drag bell ringer day-groups into the weekly day columns and push questions from today's column during class,  
So that I can plan the whole week in one view and run questions without any manual queue management.

## PDF Format (confirmed from Grade 5 Topic 1 Bellringer.pdf)

- Page 1: Cover (no questions)
- Pages 2–N: Each page = "Topic 1: Day N" header + 2–4 questions
- `topicDay` = the integer N from "Day N" (e.g., Day 2 → `topicDay: 2`)
- Questions never span pages — every question on a page belongs to the same topicDay

## Feature Metadata

**Feature Type**: Enhancement (replaces QuestionBankPanel)  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: question bank extraction, cockpit panel layout, DnD  
**Dependencies**: @dnd-kit (installed), Drizzle ORM

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` lines 1078–1120 — `questionBankItems` table (add `topicDay`, `assignedDate`)
- `src/lib/ai/question-extract.ts` — extraction prompt + `ExtractedQuestion` type
- `src/app/api/questions/route.ts` — GET endpoint, add new fields to select
- `src/app/api/questions/extract/route.ts` — bulk insert, map new `topicDay` field
- `src/components/cockpit/question-bank-panel.tsx` — **being replaced entirely** — read to understand what to preserve (send-to-students logic, fetch pattern)
- `src/app/(dashboard)/cockpit/weekly-resources-panel.tsx` — **already removed from cockpit page** (panel deleted, file kept only for `getWeekDates` utility which the plan re-adds)
- `src/app/(dashboard)/cockpit/page.tsx` lines 460–488 — rendering location; add server queries + swap component
- `drizzle/meta/_journal.json` — check latest index before creating migration

### New Files to Create

- `src/app/(dashboard)/cockpit/question-week-panel.tsx` — the new client component (replaces QuestionBankPanel)
- `src/app/api/questions/assign-date/route.ts` — PATCH bulk-assign `assignedDate`

### Patterns to Follow

**DnD** (from `src/components/cockpit/question-bank-panel.tsx`):
```ts
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
// DndContext wraps the whole component; draggableId and droppableId are strings
```

**Droppable ID**: `"day-col:2026-05-13"` (ISO date)  
**Draggable ID**: `"day-group:bell-ringer:2"` (resourceType:topicDay)

**API route auth pattern** (from `src/app/api/questions/[id]/route.ts`):
```ts
const { data } = await auth.getSession();
if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**DB update pattern** (Drizzle):
```ts
await db.update(questionBankItems)
  .set({ assignedDate: date })
  .where(and(inArray(questionBankItems.id, ids), eq(questionBankItems.teacherId, teacherId)));
```

---

## VISUAL SPEC

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Question Bank    [● Bell Ringer]  [ CFU ]  [ Exit Ticket ]   Refresh    │
├────────────────────┬─────────────────────────────────────────────────────┤
│  BANK              │  THIS WEEK                                           │
│  (scrollable)      │  MON 5/12  TUE 5/13  WED 5/14  THU 5/15  FRI 5/16  │
│                    │                                                       │
│  ≡ Day 2  (4 Qs)  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │
│  [Q1 card]         │  │Day 2 │  │  +   │  │  +   │  │  +   │  │  +   │ │
│  [Q2 card]         │  │4 Qs  │  │ drop │  │ drop │  │ drop │  │ drop │ │
│  [Q3 card]         │  │      │  │ here │  │ here │  │ here │  │ here │ │
│  [Q4 card]         │  │[→ Q1]│  │      │  │      │  │      │  │      │ │
│                    │  │[→ Q2]│  │      │  │      │  │      │  │      │ │
│  ≡ Day 3  (3 Qs)  │  │[→ Q3]│  │      │  │      │  │      │  │      │ │
│  [Q1 card]         │  │[→ Q4]│  │      │  │      │  │      │  │      │ │
│  [Q2 card]         │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘ │
│  [Q3 card]         │                                                       │
│                    │  Today (MON) column: → buttons active (live session) │
│  ≡ Day 4  (3 Qs)  │  Other columns: show assigned label only             │
└────────────────────┴─────────────────────────────────────────────────────┘
```

**Resource type tabs** filter BOTH sides:
- Bell Ringer → shows only bell-ringer questions in bank + bell-ringer assignments in columns
- CFU → same for CFU questions
- Exit Ticket → same for exit tickets

**Push buttons (→)**: only in today's column, only when a session is active (`activeSessionId` not null). Each → calls POST /api/sessions/[id]/question-push.

**Empty day column**: dashed border with "+" center — becomes solid indigo when a drag hovers over it.

**Filled day column**: shows day-group label ("Day 2") + question cards. Has an ✕ button in the header to unassign (calls PATCH with `date: null`).

---

## IMPLEMENTATION PLAN

### Phase 1: Schema + Migration
Add `topicDay` and `assignedDate` to `questionBankItems`.

### Phase 2: Extraction Update
Update Claude prompt to detect "Day N" section headers and tag each question.

### Phase 3: API Layer
- Update GET /api/questions to include new fields
- Update POST /api/questions/extract insert to store `topicDay`
- Add PATCH /api/questions/assign-date

### Phase 4: New Panel Component
Create `question-week-panel.tsx` with resource type tabs, split bank/week layout, DnD.

### Phase 5: Cockpit Page
Add server queries, swap QuestionBankPanel → QuestionWeekPanel.

---

## STEP-BY-STEP TASKS

### Task 1 — UPDATE `src/lib/db/schema.ts`

- **ADD** two columns to `questionBankItems` (after `sortOrder`):
  ```ts
  topicDay: integer("topic_day"),        // null = no day detected in PDF
  assignedDate: text("assigned_date"),   // null = unassigned; "YYYY-MM-DD" when assigned
  ```
- **VALIDATE**: `npx tsc --noEmit`

### Task 2 — CREATE migration SQL

- **CHECK** `drizzle/meta/_journal.json` for the next index number (look at the last entry's `idx` field, add 1)
- **CREATE** `drizzle/XXXX_question_day_fields.sql`:
  ```sql
  ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS topic_day integer;
  ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS assigned_date text;
  ```
- **UPDATE** `drizzle/meta/_journal.json` with new entry (tag, idx, when, breakpoints)
- **VALIDATE**: `npm run db:migrate` or note production runs on deploy

### Task 3 — UPDATE `src/lib/ai/question-extract.ts`

- **UPDATE** `ExtractedQuestion` type: add `topicDay: number | null`
- **UPDATE** `EXTRACTION_PROMPT` — add to the Rules section:
  ```
  - topicDay: integer day number from the section heading "Topic X: Day N" that appears above this question's page/section (e.g., 2 for "Topic 1: Day 2"). null if no day heading is visible for this question.
  ```
- **UPDATE** the JSON schema example in the prompt to include `"topicDay": 2` or `null`
- **GOTCHA**: Claude sees the whole PDF — each question must get the topicDay of the page-level section header that precedes it. The prompt must make clear this is per-section attribution, not a global field.
- **VALIDATE**: `npx tsc --noEmit`

### Task 4 — UPDATE `src/app/api/questions/extract/route.ts`

- **UPDATE** bulk insert: add `topicDay: q.topicDay ?? null` to each insert row
- **VALIDATE**: `npx tsc --noEmit`

### Task 5 — UPDATE `src/app/api/questions/route.ts`

- **UPDATE** select to include `topicDay: questionBankItems.topicDay` and `assignedDate: questionBankItems.assignedDate`
- **UPDATE** the response type annotation to include both fields
- **VALIDATE**: `npx tsc --noEmit`

### Task 6 — CREATE `src/app/api/questions/assign-date/route.ts`

```ts
// PATCH /api/questions/assign-date
// Body: { questionIds: string[], date: string | null }
// - auth check
// - validate: questionIds is non-empty string[], date is "YYYY-MM-DD" or null
// - DB: UPDATE question_bank_items SET assigned_date = date
//        WHERE id IN (questionIds) AND teacher_id = teacherId
// Returns: { updated: number }
```

- **IMPORTS**: `questionBankItems` from schema, `apiRateLimiter`, `auth`, `db`, `inArray`, `and`, `eq`
- **PATTERN**: Follow auth pattern from `src/app/api/questions/[id]/route.ts`
- **VALIDATE**: `npx tsc --noEmit`

### Task 7 — CREATE `src/app/(dashboard)/cockpit/question-week-panel.tsx`

`"use client"` — this is the main new component.

#### Props
```ts
type QuestionBankItem = {
  id: string;
  stem: string;
  choices: string[] | null;
  answer: string;
  questionType: string;
  standardCode: string | null;
  resourceType: string;
  sourceFilename: string;
  topicDay: number | null;
  assignedDate: string | null;
  extractedAt: string;
};

type Props = {
  today: string;                    // ISO date "YYYY-MM-DD"
  weekDates: string[];              // [Mon, Tue, Wed, Thu, Fri] ISO dates
  initialQuestions: QuestionBankItem[];  // server-fetched on RSC render
  activeSessionId: string | null;
};
```

#### State
```ts
const [questions, setQuestions] = useState<QuestionBankItem[]>(initialQuestions);
const [activeTab, setActiveTab] = useState<"bell-ringer" | "cfu" | "exit-ticket">("bell-ringer");
const [sending, setSending] = useState<string | null>(null);  // questionId being sent
const [activeId, setActiveId] = useState<string | null>(null); // DnD active drag
```

#### Data derivations (computed from `questions + activeTab`)
```ts
const RESOURCE_TABS = [
  { key: "bell-ringer", label: "Bell Ringer" },
  { key: "cfu",         label: "CFU" },
  { key: "exit-ticket", label: "Exit Ticket" },
] as const;

// Questions for the active tab
const filteredBank = questions.filter(q => q.resourceType === activeTab);

// Group by topicDay for the bank display
const groups = groupByTopicDay(filteredBank); // Map<number | null, QuestionBankItem[]>

// Week column contents: date → questions for that date+activeTab
const weekAssignments = buildWeekAssignments(filteredBank, weekDates);
// weekAssignments[date] = QuestionBankItem[] | undefined
```

#### Polling
```ts
useEffect(() => {
  const fetchQuestions = async () => {
    const res = await fetch("/api/questions");
    if (!res.ok) return;
    const json = await res.json();
    setQuestions(json.questions);
  };
  fetchQuestions();
  const id = setInterval(fetchQuestions, 10_000);
  return () => clearInterval(id);
}, []);
```

#### DnD handlers
```ts
// DragEnd:
// active.id = "day-group:bell-ringer:2"
// over.id   = "day-col:2026-05-13"
function handleDragEnd(event: DragEndEvent) {
  setActiveId(null);
  const { active, over } = event;
  if (!over) return;
  
  const activeStr = String(active.id);
  const overStr = String(over.id);
  
  if (!activeStr.startsWith("day-group:") || !overStr.startsWith("day-col:")) return;
  
  const [, resourceType, topicDayStr] = activeStr.split(":");
  const date = overStr.replace("day-col:", "");
  const topicDay = Number(topicDayStr);
  
  const ids = questions
    .filter(q => q.resourceType === resourceType && q.topicDay === topicDay)
    .map(q => q.id);
  
  if (ids.length === 0) return;
  
  // Optimistic update
  setQuestions(prev => prev.map(q =>
    ids.includes(q.id) ? { ...q, assignedDate: date } : q
  ));
  
  fetch("/api/questions/assign-date", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionIds: ids, date }),
  }).catch(() => {
    // Revert on failure
    setQuestions(prev => prev.map(q =>
      ids.includes(q.id) ? { ...q, assignedDate: null } : q
    ));
  });
}
```

#### Unassign handler (✕ button on a filled column)
```ts
async function handleUnassign(date: string) {
  const ids = questions
    .filter(q => q.resourceType === activeTab && q.assignedDate === date)
    .map(q => q.id);
  setQuestions(prev => prev.map(q =>
    ids.includes(q.id) ? { ...q, assignedDate: null } : q
  ));
  await fetch("/api/questions/assign-date", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionIds: ids, date: null }),
  });
}
```

#### Push handler (→ button in today's column)
```ts
async function handlePush(questionId: string) {
  if (!activeSessionId || sending) return;
  setSending(questionId);
  try {
    await fetch(`/api/sessions/${activeSessionId}/question-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    });
    toast.success("Question sent to students");
  } catch {
    toast.error("Failed to push question");
  } finally {
    setSending(null);
  }
}
```

#### Layout structure
```tsx
<div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
  {/* Header: icon + title + resource type tabs + refresh */}
  <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 flex-wrap">
    <BookOpenIcon className="h-4 w-4 text-indigo-400" />
    <span className="font-semibold text-slate-200 text-sm">Question Bank</span>
    <div className="flex gap-1 ml-2">
      {RESOURCE_TABS.map(tab => (
        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeTab === tab.key
              ? "bg-indigo-600 text-white"
              : "bg-slate-700/50 text-slate-400 hover:text-slate-200"
          }`}
        >{tab.label}</button>
      ))}
    </div>
    <button onClick={refetch} className="ml-auto text-xs text-slate-500 hover:text-slate-300">
      Refresh
    </button>
  </div>

  {/* Body: bank left | week right */}
  <DndContext sensors={sensors} onDragStart={...} onDragEnd={handleDragEnd}>
    <div className="flex divide-x divide-slate-700">

      {/* LEFT: Bank — scrollable, grouped by topicDay */}
      <div className="w-64 shrink-0 p-3 space-y-3 max-h-96 overflow-y-auto">
        {groups.size === 0 && (
          <p className="text-slate-600 text-xs text-center mt-8">
            Upload a PDF to extract questions
          </p>
        )}
        {Array.from(groups.entries()).map(([topicDay, qs]) => (
          <DayGroupSection key={topicDay ?? "null"} topicDay={topicDay} questions={qs} />
        ))}
      </div>

      {/* RIGHT: Week columns */}
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className="flex divide-x divide-slate-700/50 min-w-[520px]">
          {weekDates.map((date, i) => {
            const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
            const isToday = date === today;
            const assigned = weekAssignments[date] ?? [];
            return (
              <DayColumn
                key={date}
                date={date}
                dayShort={DAY_SHORT[i]}
                isToday={isToday}
                assignedQuestions={assigned}
                activeSessionId={activeSessionId}
                sending={sending}
                onPush={handlePush}
                onUnassign={() => handleUnassign(date)}
              />
            );
          })}
        </div>
      </div>

    </div>

    <DragOverlay dropAnimation={null}>
      {/* Show a "Day N · X Qs" pill while dragging */}
      {activeId && (() => {
        const [,, topicDayStr] = activeId.split(":");
        const count = groups.get(Number(topicDayStr))?.length ?? 0;
        return (
          <div className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xl rotate-2">
            Day {topicDayStr} · {count} Qs
          </div>
        );
      })()}
    </DragOverlay>
  </DndContext>
</div>
```

#### `DayGroupSection` sub-component
```tsx
// Draggable day-group header + collapsed question previews
// useDraggable({ id: `day-group:${resourceType}:${topicDay}` })
// Shows: "≡ Day 2 · 4 Qs" header (cursor-grab)
// Below: question cards (read-only, not draggable individually in this panel)
// Shows assignedDate badge on header if group is already assigned: "→ Tue 5/13"
```

#### `DayColumn` sub-component
```tsx
// useDroppable({ id: `day-col:${date}` })
// Empty state: dashed border, "+" icon centered, isOver → indigo ring
// Filled state:
//   - Header: "Day N · X Qs" + ✕ unassign button
//   - Question list (truncated stems)
//   - If isToday && activeSessionId: each question gets a → push button
// Today column has indigo/blue header highlight
```

- **IMPORTS**: All @dnd-kit from `@dnd-kit/core`, `GripVerticalIcon`, `SendIcon`, `BookOpenIcon`, `XIcon`, `PlusIcon` from lucide-react, `toast` from sonner
- **VALIDATE**: `npx tsc --noEmit`

### Task 8 — UPDATE `src/app/(dashboard)/cockpit/page.tsx`

**Add `questionBankItems` to schema imports.**

**Add two queries to the first `Promise.all`:**

```ts
// Query: full question bank for the panel
db.select({
  id: questionBankItems.id,
  stem: questionBankItems.stem,
  choices: questionBankItems.choices,
  answer: questionBankItems.answer,
  questionType: questionBankItems.questionType,
  standardCode: questionBankItems.standardCode,
  resourceType: questionBankItems.resourceType,
  sourceFilename: questionBankItems.sourceFilename,
  topicDay: questionBankItems.topicDay,
  assignedDate: questionBankItems.assignedDate,
  extractedAt: questionBankItems.extractedAt,
})
.from(questionBankItems)
.where(eq(questionBankItems.teacherId, teacherId))
.orderBy(desc(questionBankItems.extractedAt))
.limit(200),
```

**Replace** the `<QuestionBankPanel>` render with:
```tsx
<QuestionWeekPanel
  today={today}
  weekDates={weekDates}
  initialQuestions={questionBankRows}
  activeSessionId={activeSessionRow?.id ?? null}
/>
```

**Remove** import of `QuestionBankPanel`.  
**Add** import of `QuestionWeekPanel from "./question-week-panel"`.

- **NOTE**: `WeeklyResourcesPanel` was already removed from the cockpit page — no action needed
- **VALIDATE**: `npx tsc --noEmit`

### Task 9 — Validate everything

```bash
npm run validate
```

Fix any type errors or lint warnings before marking complete.

---

## TESTING STRATEGY

### Manual Steps

1. Upload `Grade 5 Topic 1 Bellringer.pdf` at `/cockpit` upload panel
2. Question bank shows groups: "Day 2 · 4 Qs", "Day 3 · 3 Qs", etc. under Bell Ringer tab
3. Switch to CFU tab → bank clears (no CFU questions yet) → week columns clear
4. Switch back to Bell Ringer → groups reappear
5. Drag "Day 2" group → hover Monday column → column lights up indigo
6. Drop → Monday column fills with "Day 2 · 4 Qs" + question list
7. Refresh page → Monday still shows Day 2 (DB persisted)
8. Click ✕ on Monday → column empties → refresh confirms it's gone
9. Start a session → → push buttons appear in today's column → push works

### Edge Cases

- `topicDay: null` — questions with no detected day appear as "Unassigned" group in bank; draggable but no day label
- Dropping onto a day that already has an assignment for this resource type — replaces it (unassign old group, assign new group; both in one PATCH call with sequential updates)
- No questions in bank → bank shows "Upload a PDF to extract questions"
- Session not active → push buttons hidden (or shown disabled with tooltip)

---

## VALIDATION COMMANDS

```bash
npx tsc --noEmit        # after every file change
npm run lint            # after all changes
npm run test:run        # full suite
npm run validate        # pre-commit gate
```

---

## ACCEPTANCE CRITERIA

- [ ] Bell ringer PDF extraction tags each question with `topicDay`
- [ ] Question bank groups by topicDay under the matching resource type tab
- [ ] Dragging a day-group to a week column assigns `assignedDate` via PATCH
- [ ] Assignment persists on page reload (DB-backed)
- [ ] Switching resource type tabs filters both bank and week columns
- [ ] Today's column shows → push buttons when session is active
- [ ] Pushing sends question to students via existing SSE infrastructure
- [ ] ✕ button on a column unassigns those questions
- [ ] WeeklyResourcesPanel (file link grid) is untouched
- [ ] `npm run validate` passes

---

## NOTES

**Why replace QuestionBankPanel entirely?** The "Today's Queue" mental model is gone — the week-view IS the queue. Keeping both would create confusing parallel workflows. The new panel supersedes it completely.

**WeeklyResourcesPanel stays separate.** It shows the PDF file links (bell-ringer.pdf ✓ per day). The new panel shows the extracted questions assigned to each day. They're complementary, not duplicates.

**DB persistence data flow:**
```
Drop → PATCH /api/questions/assign-date → assigned_date in Postgres
Reload → cockpit page RSC queries questionBankItems (includes assignedDate)
       → passed as initialQuestions to QuestionWeekPanel
       → component renders week columns from this data immediately (no flash)
```

**topicDay is permanent, assignedDate is mutable.** The PDF's "Day 2" label never changes. Which calendar date it's assigned to changes every time the teacher re-plans.
