# Feature: Schedule Calendar Editor

> Read ALL referenced files before implementing. Validate with `npx tsc --noEmit` after every file edit.

## Feature Description

Replace the manual block-add form and flat block list in the Settings → Schedule section with a visual Mon–Fri weekly calendar grid. Blocks can be dragged to move, resized by dragging the bottom edge, and edited inline via a popover. The upload photo / .ics import flow is unchanged.

## User Story

As a teacher, I want to manage my schedule on a visual weekly grid so I can see the whole week at once and rearrange blocks intuitively.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: High
**Primary Systems Affected**: Settings page ScheduleManager component, new ScheduleCalendar component
**Dependencies**: @dnd-kit (already installed), radix-ui (already installed)

---

## CONTEXT REFERENCES

### Files YOU MUST READ BEFORE IMPLEMENTING

- `src/app/(dashboard)/settings/page.tsx` — full file. `ScheduleManager` starts ~line 82. Contains `ScheduleBlockRow` + `ProposedBlock` types to reuse. Note which state vars + JSX sections are removed vs kept.
- `src/components/classes/groups-kanban.tsx` — reference for @dnd-kit: `DndContext`, `useDraggable`, `useDroppable`, `PointerSensor`/`TouchSensor` sensor config, `DragOverlay`, optimistic update + rollback pattern.
- `src/app/api/schedule/route.ts` — GET with no params returns ALL teacher blocks (the `else` branch at the bottom). POST creates a block.
- `src/app/api/schedule/[blockId]/route.ts` — PUT accepts partial update (all fields optional). Used by drag-move and resize commits.
- `package.json` — confirm `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are installed.

### New Files to Create

- `src/components/schedule/schedule-calendar.tsx` — the full calendar grid component

### Files to Modify

- `src/app/(dashboard)/settings/page.tsx` — remove manual form + block list; add `<ScheduleCalendar>`

### No API Changes Required

`GET /api/schedule` (no params) already returns all blocks. `PUT /api/schedule/[blockId]` accepts partial updates. `POST /api/schedule` creates a block. `DELETE /api/schedule/[blockId]` deletes.

---

## CONSTANTS & MATH

```typescript
const SLOT_HEIGHT = 48;           // px per 30-min slot
const GRID_START  = 7 * 60;       // 420 minutes (7:00 AM)
const GRID_END    = 17 * 60;      // 1020 minutes (5:00 PM)
const TOTAL_SLOTS = (GRID_END - GRID_START) / 30;  // = 20 slots → 960px total

const DAYS = [
  { label: "Mon", dayOfWeek: 1 },
  { label: "Tue", dayOfWeek: 2 },
  { label: "Wed", dayOfWeek: 3 },
  { label: "Thu", dayOfWeek: 4 },
  { label: "Fri", dayOfWeek: 5 },
];
```

**Time ↔ pixel helpers:**
```typescript
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesToPx(minutes: number): number {
  return ((minutes - GRID_START) / 30) * SLOT_HEIGHT;
}
function snapToSlot(px: number): number {
  return Math.round(px / SLOT_HEIGHT) * SLOT_HEIGHT;
}
function pxToMinutes(px: number): number {
  return Math.round(px / SLOT_HEIGHT) * 30 + GRID_START;
}
function minutesToHhmm(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}
```

**Example — block 08:00–09:30:**
- `top = minutesToPx(480) = (480-420)/30*48 = 96px`
- `height = minutesToPx(570) - minutesToPx(480) = 240 - 96 = 144px`

---

## COLOR MAP

```typescript
const COLOR_BG: Record<string, string> = {
  blue:    "bg-blue-500/20 border-blue-500/40 text-blue-200",
  indigo:  "bg-indigo-500/20 border-indigo-500/40 text-indigo-200",
  violet:  "bg-violet-500/20 border-violet-500/40 text-violet-200",
  green:   "bg-green-500/20 border-green-500/40 text-green-200",
  emerald: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
  teal:    "bg-teal-500/20 border-teal-500/40 text-teal-200",
  cyan:    "bg-cyan-500/20 border-cyan-500/40 text-cyan-200",
  red:     "bg-red-500/20 border-red-500/40 text-red-200",
  orange:  "bg-orange-500/20 border-orange-500/40 text-orange-200",
  amber:   "bg-amber-500/20 border-amber-500/40 text-amber-200",
  pink:    "bg-pink-500/20 border-pink-500/40 text-pink-200",
  slate:   "bg-slate-500/20 border-slate-500/40 text-slate-200",
};
const COLOR_NAMES = Object.keys(COLOR_BG);
```

---

## STEP-BY-STEP TASKS

### Task 1 — CREATE `src/components/schedule/schedule-calendar.tsx`

**IMPLEMENT**: Full weekly calendar grid component. Use tabs (not spaces) throughout.

**File structure (top to bottom):**

1. `"use client"` directive
2. Imports: `react`, `@dnd-kit/core`, `@dnd-kit/utilities`, `radix-ui` (Popover), `lucide-react` (XIcon, Trash2Icon), `sonner` (toast), `@/lib/utils` (cn)
3. Type definitions (copy from settings/page.tsx):
   - `ScheduleDocLinkRow`
   - `ScheduleBlockRow`
4. Constants: `SLOT_HEIGHT`, `GRID_START`, `GRID_END`, `TOTAL_SLOTS`, `DAYS`, `COLOR_BG`, `COLOR_NAMES`
5. Helper functions: `timeToMinutes`, `minutesToPx`, `pxToMinutes`, `minutesToHhmm`, `formatHourLabel`
6. Sub-component `SlotDropTarget` (useDroppable)
7. Sub-component `CalendarBlock` (useDraggable + resize handle)
8. Sub-component `BlockEditForm` (popover content)
9. Main export `ScheduleCalendar`

**Props:**
```typescript
type ScheduleCalendarProps = {
  blocks: ScheduleBlockRow[];
  onBlocksChange: (blocks: ScheduleBlockRow[]) => void;
};
```

**State in ScheduleCalendar:**
```typescript
const [localBlocks, setLocalBlocks] = useState<ScheduleBlockRow[]>(blocks);
const [editingBlock, setEditingBlock] = useState<ScheduleBlockRow | null>(null);
const [resizingId, setResizingId] = useState<string | null>(null);

// Sync when parent refetches
useEffect(() => { setLocalBlocks(blocks); }, [blocks]);
```

**`SlotDropTarget` component:**
```typescript
function SlotDropTarget({ dayOfWeek, slotIndex, onClick }: {
  dayOfWeek: number; slotIndex: number; onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${dayOfWeek}-${slotIndex}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{ top: `${slotIndex * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
      className={cn(
        "absolute inset-x-0 border-b border-slate-800/60 cursor-pointer transition-colors",
        slotIndex % 2 === 0 ? "border-slate-800" : "border-slate-800/30",
        isOver && "bg-indigo-500/10",
      )}
    />
  );
}
```

**`CalendarBlock` component:**
```typescript
function CalendarBlock({ block, isEditing, onEdit, onEditClose, onResizeStart, isResizing, onUpdate, onDelete, onAddDoc, onDeleteDoc }: ...) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: block.id,
    data: { block },
  });

  const top = minutesToPx(timeToMinutes(block.startTime));
  const height = minutesToPx(timeToMinutes(block.endTime)) - top;

  return (
    <Popover.Root open={isEditing} onOpenChange={(open) => !open && onEditClose()}>
      <Popover.Anchor asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          style={{
            top: `${top}px`,
            height: `${Math.max(height, SLOT_HEIGHT)}px`,
            left: "2px",
            right: "2px",
            transform: CSS.Translate.toString(transform),
            touchAction: "none",
          }}
          className={cn(
            "absolute rounded border select-none overflow-hidden group z-10",
            COLOR_BG[block.color] ?? COLOR_BG.blue,
            isDragging ? "opacity-30 cursor-grabbing" : "cursor-grab",
          )}
          onClick={(e) => {
            if (isResizing) return;
            e.stopPropagation();
            onEdit(block);
          }}
        >
          <div className="px-1.5 py-1 text-[11px] font-semibold leading-tight truncate pointer-events-none">
            {block.title}
          </div>
          {height >= 48 && (
            <div className="px-1.5 text-[10px] opacity-60 tabular-nums pointer-events-none">
              {block.startTime}–{block.endTime}
            </div>
          )}
          {/* Resize handle */}
          <div
            style={{ touchAction: "none" }}
            className="absolute bottom-0 inset-x-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 flex items-center justify-center"
            onPointerDownCapture={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onResizeStart(block, e.clientY);
            }}
          >
            <div className="w-5 h-0.5 rounded-full bg-current opacity-40" />
          </div>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-72 rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl flex flex-col gap-3"
          sideOffset={6}
          align="start"
          onInteractOutside={() => onEditClose()}
        >
          <BlockEditForm
            block={block}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAddDoc={onAddDoc}
            onDeleteDoc={onDeleteDoc}
            onClose={onEditClose}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

**`BlockEditForm` component:**
```typescript
// Inside the popover — inline edit form
// Fields: title (input, onBlur saves), startTime/endTime (input type="time", onBlur saves)
// Color picker: 12 colored circle swatches (onClick saves immediately)
// Doc links: list existing docs with delete button
// Add doc: label input + url input + type select + Add button
// Delete block: red button at bottom
```

**`ScheduleCalendar` main component — resize handler:**
```typescript
function handleResizeStart(block: ScheduleBlockRow, startY: number) {
  setResizingId(block.id);
  const startEndMinutes = timeToMinutes(block.endTime);
  const startStartMinutes = timeToMinutes(block.startTime);

  const onPointerMove = (e: PointerEvent) => {
    const deltaY = e.clientY - startY;
    const deltaMins = Math.round(deltaY / SLOT_HEIGHT * 30);
    const newEndMins = Math.max(
      startStartMinutes + 30,
      Math.min(GRID_END, startEndMinutes + deltaMins),
    );
    setLocalBlocks((prev) =>
      prev.map((b) => b.id === block.id ? { ...b, endTime: minutesToHhmm(newEndMins) } : b)
    );
  };

  const onPointerUp = async () => {
    setResizingId(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    setLocalBlocks((prev) => {
      const updated = prev.find((b) => b.id === block.id);
      if (updated && updated.endTime !== block.endTime) {
        commitUpdate(block.id, { endTime: updated.endTime });
      }
      return prev;
    });
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}
```

**`ScheduleCalendar` — drag end handler:**
```typescript
function handleDragEnd(event: DragEndEvent) {
  const overId = String(event.over?.id ?? "");
  if (!overId.startsWith("slot-")) return;
  const [, dayStr, slotStr] = overId.split("-");
  const dayOfWeek = Number(dayStr);
  const slotIndex = Number(slotStr);
  const block = event.active.data.current?.block as ScheduleBlockRow;
  const duration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
  const newStart = GRID_START + slotIndex * 30;
  const newEnd = Math.min(newStart + duration, GRID_END);
  commitUpdate(block.id, {
    dayOfWeek,
    startTime: minutesToHhmm(newStart),
    endTime: minutesToHhmm(newEnd),
  });
}
```

**`commitUpdate` helper (inside ScheduleCalendar):**
```typescript
async function commitUpdate(blockId: string, patch: Record<string, unknown>) {
  // Apply optimistically first, then persist
  setLocalBlocks((prev) =>
    prev.map((b) => b.id === blockId ? { ...b, ...patch } : b)
  );
  const res = await fetch(`/api/schedule/${blockId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) toast.error("Failed to save change");
  else {
    const json = await res.json();
    setLocalBlocks((prev) =>
      prev.map((b) => b.id === blockId ? { ...json.block, docs: b.docs } : b)
    );
    // Update editingBlock if it's the one being modified
    setEditingBlock((prev) => prev?.id === blockId ? { ...prev, ...patch } : prev);
  }
}
```

**`createBlock` helper:**
```typescript
async function createBlock(dayOfWeek: number, slotIndex: number) {
  const startMins = GRID_START + slotIndex * 30;
  const endMins = Math.min(startMins + 60, GRID_END);
  const res = await fetch("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "New Block",
      color: "blue",
      startTime: minutesToHhmm(startMins),
      endTime: minutesToHhmm(endMins),
      dayOfWeek,
    }),
  });
  if (!res.ok) { toast.error("Failed to create block"); return; }
  const json = await res.json();
  const newBlock = { ...json.block, docs: [] };
  setLocalBlocks((prev) => [...prev, newBlock]);
  onBlocksChange([...localBlocks, newBlock]);
  setEditingBlock(newBlock);  // open popover immediately for rename
}
```

**`deleteBlock` helper:**
```typescript
async function deleteBlock(blockId: string) {
  setEditingBlock(null);
  setLocalBlocks((prev) => prev.filter((b) => b.id !== blockId));
  const res = await fetch(`/api/schedule/${blockId}`, { method: "DELETE" });
  if (!res.ok) toast.error("Failed to delete block");
}
```

**Grid JSX layout:**
```tsx
<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
  <div className="flex flex-col gap-0">
    {/* Day header row */}
    <div className="flex">
      <div className="w-10 shrink-0" />
      {DAYS.map((d) => (
        <div key={d.dayOfWeek} className="flex-1 text-center text-xs font-semibold text-slate-400 py-1.5 border-b border-slate-800">
          {d.label}
        </div>
      ))}
    </div>
    {/* Grid body */}
    <div className="overflow-y-auto" style={{ maxHeight: "520px" }}>
      <div className="flex" style={{ height: `${TOTAL_SLOTS * SLOT_HEIGHT}px` }}>
        {/* Time gutter */}
        <div className="w-10 shrink-0 relative">
          {Array.from({ length: TOTAL_SLOTS + 1 }, (_, i) => (
            <div
              key={i}
              className="absolute right-1.5 text-[9px] text-slate-600 tabular-nums leading-none"
              style={{ top: `${i * SLOT_HEIGHT - 5}px` }}
            >
              {formatHourLabel(GRID_START + i * 30)}
            </div>
          ))}
        </div>
        {/* Day columns */}
        {DAYS.map((d) => (
          <div key={d.dayOfWeek} className="flex-1 relative border-l border-slate-800/60 min-w-0">
            {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
              <SlotDropTarget
                key={i}
                dayOfWeek={d.dayOfWeek}
                slotIndex={i}
                onClick={() => createBlock(d.dayOfWeek, i)}
              />
            ))}
            {localBlocks
              .filter((b) => b.dayOfWeek === d.dayOfWeek && b.specificDate === null)
              .map((block) => (
                <CalendarBlock
                  key={block.id}
                  block={block}
                  isEditing={editingBlock?.id === block.id}
                  onEdit={setEditingBlock}
                  onEditClose={() => setEditingBlock(null)}
                  onResizeStart={handleResizeStart}
                  isResizing={resizingId === block.id}
                  onUpdate={(patch) => commitUpdate(block.id, patch)}
                  onDelete={() => deleteBlock(block.id)}
                  onAddDoc={addDoc}
                  onDeleteDoc={deleteDoc}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  </div>
  <DragOverlay>
    {/* Render ghost during drag — show title + time in a pill */}
  </DragOverlay>
</DndContext>
```

**Sensors config (same as groups-kanban.tsx):**
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
);
```

**GOTCHA**: `CSS.Translate.toString(transform)` from `@dnd-kit/utilities` — import as `import { CSS } from "@dnd-kit/utilities"`. Apply to the dragged block's `transform` style.

**GOTCHA**: The resize handle uses `onPointerDownCapture` (capture phase) to `stopPropagation()` before dnd-kit's PointerSensor fires on the block. This is critical — without it, dragging the resize handle starts a block move instead.

**GOTCHA**: `specificDate`-only blocks (`dayOfWeek === null`) are not shown in the weekly grid. They still exist in the DB and in `localBlocks` — just filter them out during rendering.

**VALIDATE**: `npx tsc --noEmit`

---

### Task 2 — MODIFY `src/app/(dashboard)/settings/page.tsx`

Read the full file first. Then:

**ADD** import at top:
```typescript
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar";
```

**REMOVE** from `ScheduleManager` function:
- State vars: `addTitle`, `addColor`, `addStartTime`, `addEndTime`, `addDayOfWeek`, `addSpecificDate`, `addDocLabel`, `addDocUrl`, `addDocType` (all the manual form state)
- Functions: `handleAddBlock`, `handleDeleteBlock`, `handleAddDoc`, `handleDeleteDoc` (these move into ScheduleCalendar)
- JSX: the `{/* Add block form */}` section entirely
- JSX: the `{/* Block list */}` section entirely

**KEEP**:
- `blocks`, `blocksLoading` state
- `proposedBlocks`, `showProposed`, `importing`, `extractStatus` state
- `photoInputRef`, `icsInputRef` refs
- `fetchBlocks` + `useEffect`
- `handlePhotoImport`, `handleIcsImport`, `handleConfirmProposed`
- The import buttons + extract status + proposed blocks JSX

**ADD** after proposed blocks review section:
```tsx
<ScheduleCalendar blocks={blocks} onBlocksChange={setBlocks} />
```

**REMOVE** icon imports no longer needed in ScheduleManager: `PlusIcon`, `Trash2Icon` (check if used elsewhere in the file before removing).

**VALIDATE**: `npx tsc --noEmit`

---

## TESTING STRATEGY

### Manual Validation Checklist

- [ ] Weekly grid renders Mon–Fri columns with time labels 7:00–17:00
- [ ] Clicking an empty slot creates a block and opens popover
- [ ] Drag block to new time slot → block moves, API PUT called
- [ ] Drag block to different day → dayOfWeek updates
- [ ] Drag bottom edge → end time updates, snaps to 30-min slots
- [ ] Click block → popover opens with title/color/times
- [ ] Edit title in popover → saves on blur
- [ ] Change color → saves immediately
- [ ] Delete block → removed from grid
- [ ] Add doc link in popover → appears in doc list
- [ ] Upload photo → blocks appear in grid after confirmation
- [ ] Extracted blocks from photo → "Add" button still works

---

## VALIDATION COMMANDS

```bash
# After every file edit:
npx tsc --noEmit

# Before done:
npm run lint:fix
npm run test:run
```

---

## ACCEPTANCE CRITERIA

- [ ] Weekly calendar grid renders in Settings → Schedule section
- [ ] All 3 drag interactions work (move, resize, click-to-edit)
- [ ] Manual add form is removed
- [ ] All changes persist to DB via existing API routes
- [ ] No TypeScript errors
- [ ] No lint errors

---

## NOTES

- Use `radix-ui` unified package for Popover: `import { Popover } from "radix-ui"`
- The file uses tabs throughout — do NOT use spaces
- Blocks with `specificDate !== null` and `dayOfWeek === null` are date-specific events — hide from weekly grid (no weekly column to put them in)
- `@dnd-kit/utilities` CSS helper is already available — check groups-kanban.tsx for import
- Overlap detection is not required — overlapping blocks stack visually, both remain clickable via z-index
