# Feature: Phase 7 — Student Groups + Roster Import (Gaps Only)

The following plan should be complete, but validate documentation and codebase patterns before implementing.
Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

Phase 7 fills the remaining gaps in the student groups system. The backend APIs (groups CRUD, move student, rename, CSV import) and a basic 2-column groups UI are already built. This plan adds: Excel (.xlsx) import, performance-based auto-assign with prior-year score upload, drag-and-drop kanban board (replacing the select-dropdown UI), inline group rename, and max-6-per-group enforcement.

## User Story

As a 5th grade Florida math teacher
I want to drag students between group columns and import rosters from Excel
So that I can quickly organize my class into balanced performance groups without manual data entry

## Problem Statement

The existing groups UI uses a `<select>` dropdown for moving students — clunky on mobile. Auto-assign is naive round-robin with no performance awareness. Import only supports CSV. Groups have no size cap. Group names can't be changed from the UI.

## Solution Statement

Install `@dnd-kit` for touch-native drag-and-drop and replace the 2-column grid with a proper kanban (4 group columns + 1 Unassigned column). Add SheetJS `xlsx` for Excel import. Add optional `performanceScore` to `rosterEntries` so teachers can upload prior-year data; auto-assign uses it for snake-draft distribution. Enforce max-6 in the API. Add inline rename UI.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: Class detail page, roster import API, groups API, rosterEntries schema
**Dependencies**: `xlsx` (SheetJS), `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` (lines 103–122) — `rosterEntries` table definition; add `performanceScore` nullable integer here
- `src/app/api/classes/[id]/groups/route.ts` — full file; auto-assign logic to upgrade
- `src/app/api/classes/[id]/groups/[groupId]/route.ts` — full file; add max-6 guard to PUT handler
- `src/app/api/classes/[id]/roster/import/route.ts` — full file; extend for xlsx + optional score column
- `src/app/(dashboard)/classes/[id]/page.tsx` — full file; replace groups section with kanban, update file picker
- `src/app/api/classes/[id]/roster/route.ts` — pattern for single-student POST (Zod + owner check pattern)
- `src/lib/rate-limit.ts` — import `sessionRateLimiter` (used across all class routes)

### New Files to Create

- `src/components/classes/groups-kanban.tsx` — drag-and-drop kanban board component

### Relevant Documentation

- [@dnd-kit/core docs](https://docs.dndkit.com/api-documentation/context-provider) — `DndContext`, `DragOverlay`, `useDraggable`, `useDroppable`
- [@dnd-kit/sortable docs](https://docs.dndkit.com/presets/sortable) — not needed; we use `useDraggable`/`useDroppable` directly (students move between columns, not reorder within one)
- [SheetJS xlsx read API](https://docs.sheetjs.com/docs/api/parse-options) — `xlsx.read(buffer, { type: 'buffer' })` then `xlsx.utils.sheet_to_json(ws, { header: 1 })`

### Patterns to Follow

**API route pattern** (from every existing route):
```ts
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = sessionRateLimiter.check(ip);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ... Zod parse, then db ...
}
```

**Owner verification helper** (already in groups routes — copy it):
```ts
async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
  const [cls] = await db.select({ id: classes.id }).from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  return !!cls;
}
```

**Drizzle onConflictDoUpdate** — used in roster insert and group membership upsert; follow same pattern.

**Tailwind color maps** — already defined in class detail page as `GROUP_COLOR_CLASSES` and `GROUP_BADGE_CLASSES`; import or co-locate in kanban component.

**Client-side fetch + toast pattern**:
```ts
const res = await fetch(`/api/classes/${id}/groups/${groupId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ rosterId }),
});
if (!res.ok) throw new Error("Failed");
toast.success("Student moved");
```

---

## IMPLEMENTATION PLAN

### Phase 1: Schema + Migration

Add `performanceScore` to `rosterEntries`. Push schema to DB.

### Phase 2: Excel Import + Score Column

Update import API to detect content type and parse xlsx. Update CSV parser to handle optional 4th column (score). Update UI file picker.

### Phase 3: Performance-Based Auto-Assign

Upgrade auto-assign API to query `performanceScore`, snake-draft if data exists, show UI banner if not.

### Phase 4: Max-6 Enforcement

Add member count check to PUT groups/[groupId] API.

### Phase 5: Kanban Component

Build `GroupsKanban` with `@dnd-kit`. Columns: Dogs, Cats, Birds, Bears, Unassigned. Drag triggers existing PUT API. Inline rename via PATCH API.

### Phase 6: Wire Up Class Detail Page

Replace existing groups section (lines 531–607 in class detail page) with `<GroupsKanban>`. Update file picker. Add performance banner.

---

## STEP-BY-STEP TASKS

### TASK 1 — Install packages

```bash
npm install --force xlsx @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- **VALIDATE**: `cat package.json | grep -E '"xlsx|@dnd-kit'` — confirm all 4 appear in dependencies

---

### TASK 2 — UPDATE `src/lib/db/schema.ts`

Add `performanceScore` to `rosterEntries` table:

- **IMPLEMENT**: Add after `isActive` column:
  ```ts
  performanceScore: integer("performance_score"), // nullable — prior-year score for auto-grouping
  ```
- **GOTCHA**: No `.notNull()` and no `.default()` — must remain nullable so existing rows are unaffected
- **VALIDATE**: `npx tsc --noEmit` — no type errors

---

### TASK 3 — Run DB migration

```bash
npm run db:push
```

- **VALIDATE**: Check Drizzle Studio or run `npm run db:studio` to confirm `performance_score` column exists on `roster_entries`

---

### TASK 4 — UPDATE `src/app/api/classes/[id]/roster/import/route.ts`

Extend to handle xlsx files and optional 4th score column.

- **IMPLEMENT**:
  1. Add `import * as XLSX from "xlsx";` at top
  2. Change handler: read raw bytes with `await request.arrayBuffer()` instead of `request.text()`
  3. Detect format by `Content-Type` header:
     - `application/octet-stream` or contains `spreadsheet` → parse with `XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' })`; get first sheet; convert to rows with `XLSX.utils.sheet_to_json(ws, { header: 1 })` (returns `unknown[][]`)
     - Otherwise → decode as UTF-8 text, split on `\r?\n` (existing CSV logic)
  4. For each row (both paths): columns are `[studentId, firstInitial, lastInitial, performanceScore?]`
     - `cols.length === 2` → existing `parseInitials()` path, no score
     - `cols.length >= 3` → first + last initials as separate cols; `cols[3]` is optional score
     - Parse score: `const score = cols[3] ? parseInt(String(cols[3]), 10) : null`; skip if NaN
  5. Update `db.insert(rosterEntries).values(...)` to include `performanceScore: score ?? null`
  6. Update `onConflictDoUpdate` set to also update `performanceScore` if provided
- **PATTERN**: `src/app/api/classes/[id]/roster/import/route.ts` — mirror existing error/skip/add tracking
- **IMPORTS**: `import * as XLSX from "xlsx";`
- **GOTCHA**: `XLSX.utils.sheet_to_json` with `header: 1` returns `unknown[][]` — cast each cell with `String(cell ?? "").trim()`
- **GOTCHA**: xlsx rows may have empty trailing cells; always use `cols[n] ?? ""` pattern
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 5 — UPDATE `src/app/api/classes/[id]/groups/route.ts` — performance auto-assign

Upgrade POST auto-assign to use `performanceScore` when available.

- **IMPLEMENT**: After fetching `roster`, sort by `performanceScore`:
  ```ts
  // Sort by performanceScore DESC if any student has a score; else keep original order
  const hasScores = roster.some((s) => s.performanceScore !== null);
  const sorted = hasScores
    ? [...roster].sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0))
    : roster;

  // Snake-draft distribution: round 1 → 0,1,2,3; round 2 → 3,2,1,0; ...
  const groupCount = groups.length;
  const membershipValues = sorted.map((student, i) => {
    const round = Math.floor(i / groupCount);
    const pos = i % groupCount;
    const groupIndex = round % 2 === 0 ? pos : groupCount - 1 - pos;
    return {
      classId,
      groupId: groups[groupIndex]!.id,
      rosterId: student.id,
    };
  });
  ```
- **GOTCHA**: The `onConflictDoUpdate` target is `[groupMemberships.classId, groupMemberships.rosterId]` — the existing `set` updates `groupId` for the first value only (bug in existing code). Fix: use `sql\`excluded.group_id\`` or structure the upsert properly with a loop if needed. Actually, examine existing code carefully — the current onConflictDoUpdate uses `membershipValues[0]!.groupId` which is wrong for bulk upserts. **Do not reproduce this bug.** Use `drizzle-orm/pg-core` `sql` helper: `set: { groupId: sql\`excluded.group_id\`, assignedAt: new Date() }`
- **IMPORTS**: Add `sql` from `"drizzle-orm"` if needed, or just `import { sql } from "drizzle-orm/pg-core"` — check existing imports in schema; actually Drizzle exports `sql` from `"drizzle-orm"`. Add it to the existing `import { and, eq } from "drizzle-orm"` import.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 6 — UPDATE `src/app/api/classes/[id]/groups/[groupId]/route.ts` — max-6 guard

Add member count check before upsert in PUT handler.

- **IMPLEMENT**: After verifying group ownership, before the upsert:
  ```ts
  // Count current members (excluding the student being moved — they may already be in this group)
  const currentMembers = await db
    .select({ rosterId: groupMemberships.rosterId })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.classId, classId)));

  const alreadyInGroup = currentMembers.some((m) => m.rosterId === rosterId);
  if (!alreadyInGroup && currentMembers.length >= 6) {
    return NextResponse.json({ error: "Group is full (max 6 students)" }, { status: 400 });
  }
  ```
- **GOTCHA**: If the student is already in this group (just confirming position), allow it. Only block if they're NEW to the group and count is at 6.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 7 — CREATE `src/components/classes/groups-kanban.tsx`

New drag-and-drop kanban board component.

- **IMPLEMENT**: Client component (`"use client"`) that receives:
  ```ts
  type Props = {
    classId: string;
    groups: StudentGroup[]; // includes members[]
    allRoster: RosterEntry[]; // all active students
    onGroupsChange: (groups: StudentGroup[]) => void;
    onRenameGroup: (groupId: string, name: string, emoji: string) => Promise<void>;
  }
  ```

  **Data logic:**
  - `unassigned`: `allRoster.filter(s => !groups.some(g => g.members.some(m => m.rosterId === s.id)))`
  - Treat unassigned as a virtual column with id `"unassigned"`

  **dnd-kit setup:**
  ```tsx
  import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  ```

  **Draggable student card** (inner component):
  ```tsx
  import { useDraggable } from "@dnd-kit/core";

  function StudentCard({ member, groupColor }: { member: GroupMember; groupColor: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: member.rosterId,
      data: { rosterId: member.rosterId },
    });
    // Apply transform style; isDragging → opacity-40
  }
  ```

  **Droppable group column** (inner component):
  ```tsx
  import { useDroppable } from "@dnd-kit/core";

  function GroupColumn({ group, isOver, isFull }: ...) {
    const { setNodeRef } = useDroppable({ id: group.id });
    // isFull (members.length >= 6): show red border + "Full" badge, no drop allowed
    // isOver: highlight with ring
  }
  ```

  **DragEnd handler:**
  ```ts
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const rosterId = String(active.id);
    const targetGroupId = String(over.id);
    if (targetGroupId === "unassigned") return; // can't drop to unassigned

    // Optimistic update
    const prev = groups;
    // ... move member between groups in local state ...
    setGroups(updated);

    try {
      const res = await fetch(`/api/classes/${classId}/groups/${targetGroupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to move student");
      }
    } catch (err) {
      setGroups(prev); // rollback
      toast.error(err instanceof Error ? err.message : "Failed to move student");
    }
  }
  ```

  **Inline rename:** clicking a group name shows an `<input>` inline. On blur/Enter:
  ```ts
  await fetch(`/api/classes/${classId}/groups/${group.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });
  ```

  **Layout:**
  - Mobile: single column, groups stacked
  - Desktop (md+): horizontal scroll with 5 columns (4 groups + Unassigned)
  - Unassigned column: neutral/gray, listed first or last (last preferred)
  - Each group column shows: emoji (editable via emoji picker or just text input) + group name (editable) + member count badge (red if 6/6) + student cards

- **IMPORTS**:
  ```ts
  import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
  import { useDraggable, useDroppable } from "@dnd-kit/core";
  import { cn } from "@/lib/utils";
  import { toast } from "sonner";
  ```
- **GOTCHA**: `@dnd-kit` requires `"use client"` — this is already a client component
- **GOTCHA**: `DragOverlay` renders in a portal — use it to show a floating clone of the dragged card so it doesn't clip within overflow-hidden columns
- **GOTCHA**: `TouchSensor` delay is important — prevents scroll conflicts on mobile
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 8 — UPDATE `src/app/(dashboard)/classes/[id]/page.tsx`

Replace groups section with kanban; update file import; add performance banner.

- **IMPLEMENT**:
  1. **Import** `GroupsKanban` from `@/components/classes/groups-kanban.tsx`
  2. **File picker**: change `accept=".csv,.txt"` → `accept=".csv,.xlsx,.txt"`
  3. **Update `handleCsvImport`**: for `.xlsx` files, read as `ArrayBuffer` and send with `Content-Type: application/octet-stream`; for CSV/txt, existing `file.text()` + `Content-Type: text/plain` path stays
     ```ts
     const isXlsx = file.name.endsWith(".xlsx");
     let body: string | ArrayBuffer;
     let contentType: string;
     if (isXlsx) {
       body = await file.arrayBuffer();
       contentType = "application/octet-stream";
     } else {
       body = await file.text();
       contentType = "text/plain";
     }
     ```
  4. **Remove** the existing groups JSX block (lines 531–607): the `<div className="flex flex-col gap-3">` groups section with the auto-assign button, groups grid, and select dropdowns
  5. **Replace with**:
     ```tsx
     {/* Groups */}
     <div className="flex flex-col gap-3">
       <div className="flex items-center justify-between">
         <p className="text-sm font-semibold text-foreground">Groups</p>
         <Button size="sm" variant="outline" onClick={handleAutoAssign} disabled={autoAssigning || roster.length === 0}>
           {autoAssigning ? "Assigning..." : "Auto-assign"}
         </Button>
       </div>

       {/* Performance data banner — shown when roster has no performance scores */}
       {roster.length > 0 && groups.length === 0 && (
         <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
           <strong>Tip:</strong> For performance-based grouping, include a 4th column in your CSV/Excel with each student's prior-year score (e.g. iReady scale score). Auto-assign will use it to balance groups.
         </div>
       )}

       {groupsLoading ? (
         <div className="h-32 rounded-lg bg-muted/30 animate-pulse" />
       ) : (
         <GroupsKanban
           classId={id}
           groups={groups}
           allRoster={roster}
           onGroupsChange={setGroups}
           onRenameGroup={async (groupId, name, emoji) => {
             await fetch(`/api/classes/${id}/groups/${groupId}`, {
               method: "PATCH",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ name, emoji }),
             });
             fetchGroups();
           }}
         />
       )}
     </div>
     ```
  6. **Remove** now-unused state: `movingStudent` (was only for the select dropdown)
  7. **Keep** `autoAssigning`, `groupsLoading`, `groups`, `fetchGroups`, `handleAutoAssign` — these are still used

- **GOTCHA**: The `roster` state in the page uses `RosterEntry` type (has `id`, `studentId`, `firstInitial`, `lastInitial`, `isActive`) — pass the full array to `GroupsKanban` as `allRoster`
- **VALIDATE**: `npx tsc --noEmit`

---

## TESTING STRATEGY

### Unit Tests

No new unit test files required — the existing `src/lib/__tests__/rate-limit.test.ts` pattern shows vitest is used only for pure utility functions. The import parsing logic (CSV + xlsx row extraction) is worth a unit test if extracted into a helper.

### Manual Validation Checklist

1. **CSV import**: upload a 3-col CSV (`student_id,F,L`) → students appear in roster
2. **CSV with score**: upload a 4-col CSV (`student_id,F,L,score`) → check DB `performance_score` column set
3. **Excel import**: upload an `.xlsx` file with same columns → same result
4. **Auto-assign (no scores)**: click Auto-assign with no performance data → round-robin distribution, banner visible
5. **Auto-assign (with scores)**: after uploading CSV with scores, click Auto-assign → highest-scored students spread across all groups (snake-draft)
6. **Drag-and-drop**: drag a student from one group to another → student moves, API called
7. **Max-6**: fill a group to 6 → drag a 7th student → error toast, rollback
8. **Inline rename**: click group name → type new name → blur → name updates
9. **Unassigned column**: add a student after auto-assign → new student appears in Unassigned column
10. **Mobile**: test drag on touch device (or DevTools mobile emulation) — drag works with 200ms delay

---

## VALIDATION COMMANDS

### Level 1: Type Check
```bash
npx tsc --noEmit
```

### Level 2: Lint
```bash
npm run lint:fix
```

### Level 3: Unit Tests
```bash
npm run test:run
```

### Level 4: Build Check (requires env vars)
```bash
# Only if env vars are set:
npm run build
```

---

## ACCEPTANCE CRITERIA

- [ ] `.xlsx` files import successfully with same result as CSV
- [ ] Optional 4th column in CSV/Excel saves `performanceScore` to DB
- [ ] Auto-assign with score data uses snake-draft distribution (top performers spread across groups)
- [ ] Auto-assign without score data stays round-robin + shows tip banner
- [ ] Groups display as a kanban with drag-and-drop on both mouse and touch
- [ ] Dragging a student to a full group (6 members) shows an error and reverts
- [ ] Group names can be edited inline with click-to-edit
- [ ] Students added after auto-assign appear in "Unassigned" column
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint:fix` passes with zero errors
- [ ] Existing test suite passes: `npm run test:run`

---

## COMPLETION CHECKLIST

- [ ] All 8 tasks completed in order
- [ ] `npm install --force` ran successfully with all 4 packages
- [ ] `npm run db:push` ran, `performance_score` column confirmed in DB
- [ ] Each task: `npx tsc --noEmit` passed immediately after
- [ ] Manual checklist (10 items) validated
- [ ] `npm run lint:fix` — zero errors
- [ ] `npm run test:run` — no regressions

---

## NOTES

### Packages
- `xlsx` (SheetJS): use `import * as XLSX from "xlsx"` — package has default CJS export but the namespace import is safest for Next.js
- `@dnd-kit/core` v6+: supports React 19. Uses `PointerSensor` + `TouchSensor` for cross-device support
- All installed with `npm install --force` due to macOS arm64 Linux-specific rollup/tailwind packages in peer deps

### Auto-assign Bug Fix
The existing `onConflictDoUpdate` in the groups POST route incorrectly uses `membershipValues[0]!.groupId` for all rows — this is a bug that would assign everyone to the same group on re-assign. Task 5 fixes this using `sql\`excluded.group_id\``.

### Performance Score Semantics
Higher score = higher performer. Snake-draft ensures each group gets one top performer, one bottom performer, and middle performers spread evenly. If scores are tied or absent, the sort is stable (preserves original order).

### No Emoji Picker
Group emoji inline edit uses a plain text `<input>` — keep it simple. Teachers can type any emoji character directly.
