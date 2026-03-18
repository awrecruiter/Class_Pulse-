# Feature: Teacher Schedule + Doc Launcher

Validate all patterns and file paths before implementing. Pay close attention to existing type
names, import paths, and tab indentation throughout all TSX/TS files. The coach page
(`coach/page.tsx`) is 1400+ lines — use targeted edits only, never rewrite the whole file.

---

## Feature Description

An iCal-style schedule overlay that slides in from the left over **any dashboard page** when
triggered by voice ("show my schedule") or a UI button. Teachers see today's schedule, with
the current block highlighted and a "NOW" badge, and can tap any linked document to open it
hands-free. A secondary access point is a collapsible section in the coach page left sidebar.

Schedule supports:
- **Weekly repeating blocks** (every Monday period 1) — base schedule
- **Date-specific overrides** (field trip on 2026-03-17 replaces that Tuesday's block)
- Date-specific blocks override weekly blocks when both match the same day

Doc links per block support all types:
- External URL (https://...)
- Internal path (/board, /classes, etc.)
- Portal apps (iReady, Clever, Schoology — see `portal-panel.tsx` for the full list)
- PDF uploads (stored as URLs after upload)

Photo/image upload: Claude Vision extracts blocks + times (for printed schedules, Google
Calendar screenshots). `.ics` file import: parsed directly with a lightweight text parser —
no Vision needed.

Doc open behavior: **tappable toast by default** (matches existing board command pattern in
`voice-command-provider.tsx`). A setting in teacher settings switches to **immediate new tab**.

---

## User Story

As a 5th-grade math teacher using the cockpit on any page, I say "show my schedule" and a
schedule overlay slides in showing what period it is and what doc I need. I tap the doc link,
it opens. I say "close schedule" and I'm back where I was.

---

## Architecture

### Global Overlay — Primary Access
`src/components/schedule/schedule-overlay.tsx` — fixed overlay, slides from left.
Injected into `src/app/(dashboard)/layout.tsx` (shared layout — works on every page).
Reads `scheduleOverlayOpen` from VoiceQueueContext (extend the context, not a new one).

### Coach Page Sidebar — Secondary Access
A collapsible section in the coach page left sidebar showing the same schedule inline.
Uses the same data-fetching hook as the overlay. Panel pattern mirrors `GroupsSidebarPanel`.

### Voice Actions (immediate, no queue)
Two new action types added to `QueueItemData`:
- `{ type: "show_schedule" }` — opens the overlay from anywhere; executes immediately like `navigate`
- `{ type: "open_doc"; label: string; url: string }` — opens a doc via toast or new tab depending on setting

### Data Flow
- Schedule data fetched from `GET /api/schedule?day={0-6}&date={YYYY-MM-DD}`
- Date-specific overrides returned instead of weekly blocks when the date matches
- Block color, doc links, times all returned in a single response
- "Active block" computed client-side: current wall-clock time is within `startTime`–`endTime`

---

## DB Schema Additions

Add to `src/lib/db/schema.ts` (append before the Relations section):

```ts
// ─── Teacher Schedule ─────────────────────────────────────────────────────────

export const scheduleBlocks = pgTable(
	"schedule_blocks",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: text("teacher_id").notNull(),
		title: text("title").notNull(),
		color: text("color").notNull().default("blue"),
		// HH:MM 24-hour format, e.g. "08:00"
		startTime: text("start_time").notNull(),
		endTime: text("end_time").notNull(),
		// 0=Sun, 1=Mon, ..., 6=Sat — null means "applies to specific date only"
		dayOfWeek: integer("day_of_week"),
		// YYYY-MM-DD — if set, this is a date-specific override or one-off block
		// Takes priority over weekly block on the same day
		specificDate: text("specific_date"),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_schedule_blocks_teacher_id").on(table.teacherId),
		index("idx_schedule_blocks_day_of_week").on(table.dayOfWeek),
		index("idx_schedule_blocks_specific_date").on(table.specificDate),
	],
);

export const scheduleDocLinks = pgTable(
	"schedule_doc_links",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		blockId: uuid("block_id")
			.notNull()
			.references(() => scheduleBlocks.id, { onDelete: "cascade" }),
		label: text("label").notNull(), // e.g. "Math Slides", "iReady Dashboard"
		// Full URL, internal path like "/board", or portal key like "iready"
		url: text("url").notNull(),
		// "url" | "internal" | "portal" | "pdf"
		linkType: text("link_type").notNull().default("url"),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("idx_schedule_doc_links_block_id").on(table.blockId)],
);
```

Also add `scheduleDocOpenMode` column to `teacherSettings` (append inside the existing table
definition):

```ts
// "toast" = tappable toast (default, matches board open_app pattern)
// "new-tab" = immediate window.open
scheduleDocOpenMode: text("schedule_doc_open_mode").notNull().default("toast"),
```

Add Drizzle relations at end of Relations section:

```ts
export const scheduleBlocksRelations = relations(scheduleBlocks, ({ many }) => ({
	docLinks: many(scheduleDocLinks),
}));

export const scheduleDocLinksRelations = relations(scheduleDocLinks, ({ one }) => ({
	block: one(scheduleBlocks, {
		fields: [scheduleDocLinks.blockId],
		references: [scheduleBlocks.id],
	}),
}));
```

---

## Portal Keys Reference

From `src/components/board/portal-panel.tsx`, the portal apps and their URLs:

| Key | URL |
|-----|-----|
| `portal` | https://www3.dadeschools.net |
| `outlook` | https://outlook.office365.com |
| `onedrive` | https://portal.office.com/onedrive |
| `pinnacle` | https://gradebook.dadeschools.net/Pinnacle/Gradebook/ |
| `schoology` | https://dadeschools.schoology.com |
| `clever` | https://clever.com/in/miami/teacher/resourceHub |
| `iready` | https://login.i-ready.com/educator/dashboard/math |
| `ixl` | (long Clever OAuth URL — see portal-panel.tsx line 57) |
| `bigideas` | https://www.bigideasmath.com/MRL/public/app/#/teacher/dashboard |
| `mcgrawhill` | (long URL — see portal-panel.tsx line 67) |

When `linkType === "portal"`, the `url` field stores the key (e.g. `"iready"`). The overlay
resolves the full URL from this table at open time. Store the full URL map as a constant in
`src/lib/portal-urls.ts` (new file, shared by overlay + api route).

---

## New Voice Action Types

Extend `QueueItemData` union in `src/contexts/voice-queue.tsx`:

```ts
| { type: "show_schedule" }
| { type: "open_doc"; label: string; url: string }
```

Both execute **immediately** (no queue, no confirmation) — same as `navigate` and
`move_to_group`. Add handling in `handleCommand` in `voice-command-provider.tsx`:

```ts
if (data.type === "show_schedule") {
	setScheduleOverlayOpen(true);  // via context
	return;
}
if (data.type === "open_doc") {
	handleDocOpen(data.label, data.url, scheduleDocOpenMode);
	return;
}
```

`handleDocOpen(label, url, mode)`:
- If `mode === "new-tab"`: call `window.open(url, "_blank")` directly (no toast)
- If `mode === "toast"` (default): show tappable toast matching board `open_app` pattern:
  ```ts
  toast.success(`Open ${label}?`, {
  	description: `Heard: "open ${label}"`,
  	duration: 8000,
  	action: { label: "Open", onClick: () => window.open(url, "_blank") },
  });
  ```

Note: `window.open` from speech recognition is popup-blocked (not a user gesture). The toast
approach is the correct pattern — matches `handleBoardCommand` in `voice-command-provider.tsx`
line 144–149. Internal paths use `window.location.href = url` instead of `window.open`.

---

## VoiceQueueContext Extensions

Add to `VoiceQueueCtx` interface and `VoiceQueueProvider` in `src/contexts/voice-queue.tsx`:

```ts
// Schedule overlay state
scheduleOverlayOpen: boolean;
setScheduleOverlayOpen: (open: boolean) => void;
```

Provide via `useState(false)`. This is how the overlay knows to show/hide, and how
`voice-command-provider.tsx` opens it on `show_schedule`.

---

## API Routes

### GET /api/schedule
`src/app/api/schedule/route.ts`

Query params:
- `day` (0-6) — day of week
- `date` (YYYY-MM-DD) — the specific date; if date-specific blocks exist for this date,
  they are returned instead of the weekly blocks for that day. Weekly blocks for OTHER days
  are unaffected.

Algorithm:
1. Fetch all blocks for authenticated teacher
2. Collect `specificDate` blocks matching `date` param → these win for that date
3. Collect `dayOfWeek` blocks matching `day` param, EXCLUDING any `startTime` that has a
   date-specific override for the same date
4. Merge, sort by `startTime`
5. For each block, join `scheduleDocLinks` ordered by `sortOrder`
6. Return `{ blocks: ScheduleBlock[] }`

Response shape:
```ts
type ScheduleBlock = {
	id: string;
	title: string;
	color: string;
	startTime: string;   // "HH:MM"
	endTime: string;     // "HH:MM"
	dayOfWeek: number | null;
	specificDate: string | null;
	sortOrder: number;
	docs: Array<{
		id: string;
		label: string;
		url: string;       // full URL (portal keys resolved server-side)
		linkType: string;
	}>;
};
```

### POST /api/schedule
Create a schedule block. Body: `{ title, color, startTime, endTime, dayOfWeek?, specificDate?, sortOrder? }`
Returns `{ block }`.

### PUT /api/schedule/[blockId]
Update a block. Same optional fields as POST. Returns `{ block }`.

### DELETE /api/schedule/[blockId]
Delete a block (cascades to doc links). Returns `{ ok: true }`.

### POST /api/schedule/[blockId]/docs
Add a doc link. Body: `{ label, url, linkType, sortOrder? }`. Returns `{ doc }`.

### DELETE /api/schedule/[blockId]/docs/[docId]
Remove a doc link. Returns `{ ok: true }`.

### POST /api/schedule/extract
Accepts either:
- `{ type: "image"; data: string; mimeType: string }` — base64 image, runs Claude Vision
- `{ type: "ics"; content: string }` — raw .ics text, parsed directly (no Vision)

Returns `{ blocks: Array<{ title, startTime, endTime, dayOfWeek, color }> }` — these are
proposed blocks, not yet saved. The UI lets the teacher review and confirm before POSTing
each block to `/api/schedule`.

Rate limited by `scheduleExtractLimiter` (5/min).

---

## Rate Limiter

Add to `src/lib/rate-limit.ts`:

```ts
export const scheduleExtractLimiter = createRateLimiter(5, 60_000); // 5 req/min (Vision + ics extract)
```

---

## .ics Parsing

No ical library is in `package.json`. Do NOT install a heavy library.

Use lightweight inline text parsing in `src/lib/ics-parser.ts` (new file):

```ts
// Parse a raw .ics string into proposed schedule blocks.
// Handles VEVENT components only. Extracts:
//   SUMMARY → title
//   DTSTART → date + time → dayOfWeek + startTime (HH:MM)
//   DTEND   → endTime (HH:MM)
// RRULE BYDAY → dayOfWeek array (for recurring events, emit one block per day)
// Returns only events with valid start/end times. Strips timezone suffixes.
export function parseIcs(content: string): ProposedBlock[] { ... }
```

The parser should handle:
- `DTSTART:20260317T083000Z` — UTC datetime → local time via `new Date(...).toLocaleTimeString()`
- `DTSTART;TZID=America/New_York:20260317T083000` — strip TZID, parse datetime
- `DTSTART;VALUE=DATE:20260317` — date-only, skip (no time → no time block)
- `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR` → emit one block per listed day with `dayOfWeek` set

Do not over-engineer: the parser just needs to handle standard Google Calendar and Apple
Calendar .ics exports. Edge cases (all-day events, complex recurrence rules) should be
silently skipped.

---

## Claude Vision for Calendar Images

In `src/app/api/schedule/extract/route.ts`, when `type === "image"`:

Mirror the pattern from `src/lib/ai/drawing-analysis.ts`:

```ts
const response = await client.messages.create({
	model: "claude-haiku-4-5-20251001",
	max_tokens: 1024,
	messages: [{
		role: "user",
		content: [
			{
				type: "image",
				source: { type: "base64", media_type: mimeType, data: imageData },
			},
			{
				type: "text",
				text: `This is a teacher's school schedule (printed, handwritten, or screenshot).
Extract all visible time blocks as JSON. Output ONLY valid JSON, no markdown:
{
  "blocks": [
    {
      "title": "string — class or activity name",
      "startTime": "HH:MM — 24-hour format",
      "endTime": "HH:MM — 24-hour format",
      "dayOfWeek": 0-6 or null,
      "color": "blue"
    }
  ]
}
Rules:
- If the schedule shows a single day, set dayOfWeek to null and let the teacher assign.
- If the schedule shows a weekly grid, set dayOfWeek per column (0=Sun, 1=Mon, ..., 6=Sat).
- If a time is ambiguous (no AM/PM), assume school hours (6:00–17:00 window).
- Convert all times to 24-hour HH:MM format.
- Skip non-time items (headers, footers, room numbers).
- Color is always "blue" by default — teacher can change it.`,
			},
		],
	}],
});
```

Parse response text same as `drawing-analysis.ts` (strip markdown fences, JSON.parse,
catch parse errors and return `{ blocks: [] }`).

---

## Voice Agent System Prompt Update

In `src/app/api/coach/voice-agent/route.ts`, add two new action schemas to `SYSTEM_PROMPT`:

```
{"type":"show_schedule"}
{"type":"open_doc","label":"<display name of the doc>","url":"<full URL>"}
```

Add to the Rules section:

```
- "show my schedule" / "what's next" / "open schedule" / "show schedule" → show_schedule
- "open [doc name]" when the name matches a schedule doc → open_doc with label and URL from context
- "close schedule" → treat as ignore (handled client-side by overlay dismiss)
```

The voice agent route also needs schedule context added to the user content string and schema.
Add optional `scheduleBlocks` to the context schema:

```ts
scheduleBlocks: z.array(z.object({
	title: z.string(),
	docs: z.array(z.object({ label: z.string(), url: z.string() })),
})).optional(),
```

And in `voice-command-provider.tsx` `callVoiceAgent`, fetch today's schedule before calling
the agent and pass it in context:

```ts
const scheduleRes = await fetch(
	`/api/schedule?day=${new Date().getDay()}&date=${new Date().toISOString().slice(0, 10)}`
);
const scheduleData = scheduleRes.ok ? await scheduleRes.json() : { blocks: [] };
```

Pass `scheduleBlocks: scheduleData.blocks` in the context object.

In the user content string, append:
```
- Schedule docs available: ${scheduleBlockDocLabels}
```

---

## Schedule Overlay Component

`src/components/schedule/schedule-overlay.tsx`

Design:
- Fixed overlay: `fixed inset-y-0 left-0 z-50 flex`
- Backdrop: `fixed inset-0 bg-black/40 z-40` — click to dismiss
- Panel: `relative z-50 w-80 h-full bg-[#0d1525] border-r border-slate-700/60 flex flex-col`
- Slide transition: `transform transition-transform duration-300 ease-in-out`
  - Open: `translate-x-0`
  - Closed: `-translate-x-full`
- Render always in DOM (controlled by `scheduleOverlayOpen` from context), animate with CSS
  transform — do NOT conditionally mount/unmount (causes animation flash)

Content layout:
```
[Header] "Schedule" + today's date + close button (shrink-0)
[Scrollable block list] — overflow-y-auto flex-1 min-h-0
  For each block:
    - Time range (HH:MM – HH:MM)
    - Title (bold)
    - Color accent stripe on left border
    - "NOW" pulsing badge if current time is within startTime–endTime
    - Doc links list — each is a tappable button
[Footer] "Edit Schedule" link → /settings#schedule (shrink-0)
```

"Active block" detection: on mount and on a 60-second interval, compare current wall-clock
`HH:MM` against each block's `startTime`/`endTime`. Use `useState` for `activeBlockId`.

Doc link tap behavior:
```ts
function handleDocTap(doc: ScheduleDocLinkRow) {
	if (scheduleDocOpenMode === "new-tab") {
		if (doc.linkType === "internal") {
			window.location.href = doc.url;
		} else {
			window.open(doc.url, "_blank");
		}
	} else {
		// toast mode
		if (doc.linkType === "internal") {
			toast.success(`Go to ${doc.label}?`, {
				duration: 8000,
				action: { label: "Go", onClick: () => { window.location.href = doc.url; } },
			});
		} else {
			toast.success(`Open ${doc.label}?`, {
				duration: 8000,
				action: { label: "Open", onClick: () => window.open(doc.url, "_blank") },
			});
		}
	}
}
```

The component reads `scheduleOverlayOpen` and `setScheduleOverlayOpen` from `useVoiceQueue()`.
It also reads `scheduleDocOpenMode` from teacher settings (fetched once on mount, same as other
components that call `/api/teacher-settings`).

---

## Dashboard Layout Injection

In `src/app/(dashboard)/layout.tsx`:

```tsx
import { ScheduleOverlay } from "@/components/schedule/schedule-overlay";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-[#0d1525]">
			<AiPresenceBorder />
			<NavBar />
			<main>{children}</main>
			<ScheduleOverlay />
		</div>
	);
}
```

`ScheduleOverlay` is a client component. It uses `useVoiceQueue()` which requires being inside
`VoiceQueueProvider`. Confirm the provider wraps the layout in the root layout or the dashboard
layout — check `src/app/layout.tsx` before editing.

---

## Coach Page Left Sidebar Panel

In `src/app/(dashboard)/coach/page.tsx`, add a collapsible "Schedule" section to the left
sidebar (the column that already has Groups and other sections).

Pattern to follow: the existing collapsible sections in the left sidebar use a chevron toggle.
Read the left sidebar section (search for "sidebar" or the first column's JSX) before touching
anything. The coach page is tab-indented throughout — do not introduce spaces.

Add a `scheduleOpen` boolean state. The section header toggles it. When `scheduleOpen`, render
`<ScheduleSidebarPanel />` (a thin wrapper that renders the same schedule block list as the
overlay, but inline, not in a fixed overlay).

`ScheduleSidebarPanel` props: none (reads from API directly). Shares the same data-fetching
hook `useScheduleToday()` with the overlay.

---

## Shared Data Hook

`src/hooks/use-schedule-today.ts`

```ts
export function useScheduleToday() {
	const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
	const [loading, setLoading] = useState(true);
	const today = new Date();
	const day = today.getDay();
	const date = today.toISOString().slice(0, 10);

	useEffect(() => {
		fetch(`/api/schedule?day=${day}&date=${date}`)
			.then((r) => r.ok ? r.json() : { blocks: [] })
			.then((j) => setBlocks(j.blocks ?? []))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [day, date]);

	// Active block = current time within startTime–endTime
	const [now, setNow] = useState(() => getCurrentHHMM());
	useEffect(() => {
		const t = setInterval(() => setNow(getCurrentHHMM()), 60_000);
		return () => clearInterval(t);
	}, []);

	const activeBlockId = blocks.find(
		(b) => b.startTime <= now && now < b.endTime
	)?.id ?? null;

	return { blocks, loading, activeBlockId };
}

function getCurrentHHMM(): string {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
```

---

## Settings Page Addition

In `src/app/(dashboard)/settings/page.tsx`:

1. Add `scheduleDocOpenMode: "toast" | "new-tab"` to the `Settings` type (line 15–22 area).

2. Add a new section **"Schedule Settings"** (after existing sections, before footer).
   Pattern matches existing toggle rows (see store/alias mode toggles in the page):

```tsx
{/* Schedule Doc Open Mode */}
<div className="flex items-center justify-between gap-4">
	<div>
		<p className="text-sm font-medium text-slate-200">Document open mode</p>
		<p className="text-xs text-slate-500 mt-0.5">
			How schedule doc links open when tapped or triggered by voice
		</p>
	</div>
	<select
		value={settings.scheduleDocOpenMode ?? "toast"}
		onChange={(e) =>
			setSettings((s) => s ? { ...s, scheduleDocOpenMode: e.target.value as "toast" | "new-tab" } : s)
		}
		className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5"
	>
		<option value="toast">Tappable toast (confirm first)</option>
		<option value="new-tab">Open immediately in new tab</option>
	</select>
</div>
```

3. `handleSave` already sends `settings` to `PUT /api/teacher-settings` — no change needed
   there as long as the Zod schema and DB column are updated.

4. Add a **"Manage Schedule"** section link pointing to `/settings#schedule` or a dedicated
   schedule editor UI (see Phase 2 of implementation steps below).

---

## Teacher Settings API Update

In `src/app/api/teacher-settings/route.ts`, add `scheduleDocOpenMode` to the Zod schema:

```ts
scheduleDocOpenMode: z.enum(["toast", "new-tab"]).optional(),
```

The `onConflictDoUpdate` pattern already handles partial updates — no further changes needed.

---

## Schedule Management UI

The schedule CRUD UI lives in the settings page under a `#schedule` anchor section.
It does NOT live on the coach page (coach page is already large and focused on live class).

UI sections in settings:
1. **Block list** — shows all blocks, sorted by day+time. Edit/delete buttons per block.
2. **Add block form** — inline form: title, color picker, day of week OR specific date, start
   time, end time. Submit → `POST /api/schedule`.
3. **Add doc link** — per block, inline expandable section: label, URL, link type selector,
   portal key dropdown (if portal). Submit → `POST /api/schedule/[blockId]/docs`.
4. **Import** — two options:
   - "Upload photo" — file input (image/*), converts to base64, `POST /api/schedule/extract`
     with `type: "image"`. Shows proposed blocks in a review modal — teacher confirms each.
   - "Import .ics" — file input (.ics), reads as text, `POST /api/schedule/extract` with
     `type: "ics"`. Same review flow.

---

## Implementation Steps (Dependency Order)

### Step 1 — DB Schema
File: `src/lib/db/schema.ts`

Actions:
- Add `scheduleDocOpenMode` column to `teacherSettings` table
- Append `scheduleBlocks` table definition
- Append `scheduleDocLinks` table definition
- Append relations for both new tables

VALIDATE: `npx tsc --noEmit`

Then: `npm run db:generate && npm run db:migrate`

---

### Step 2 — Rate Limiter
File: `src/lib/rate-limit.ts`

Add one line:
```ts
export const scheduleExtractLimiter = createRateLimiter(5, 60_000); // 5 req/min (Vision + ics extract)
```

VALIDATE: `npx tsc --noEmit`

---

### Step 3 — Portal URL Map
New file: `src/lib/portal-urls.ts`

```ts
export const PORTAL_URLS: Record<string, string> = {
	portal: "https://www3.dadeschools.net",
	outlook: "https://outlook.office365.com",
	onedrive: "https://portal.office.com/onedrive",
	pinnacle: "https://gradebook.dadeschools.net/Pinnacle/Gradebook/",
	schoology: "https://dadeschools.schoology.com",
	clever: "https://clever.com/in/miami/teacher/resourceHub",
	iready: "https://login.i-ready.com/educator/dashboard/math",
	// Add IXL and McGraw Hill full URLs from portal-panel.tsx lines 56–69
};

export function resolveDocUrl(url: string, linkType: string): string {
	if (linkType === "portal") return PORTAL_URLS[url] ?? url;
	return url;
}
```

VALIDATE: `npx tsc --noEmit`

---

### Step 4 — .ics Parser
New file: `src/lib/ics-parser.ts`

```ts
export type ProposedBlock = {
	title: string;
	startTime: string; // HH:MM
	endTime: string;   // HH:MM
	dayOfWeek: number | null;
	color: string;
};

export function parseIcs(content: string): ProposedBlock[] { ... }
```

Parse VEVENT blocks. For each VEVENT:
- Extract `SUMMARY` → title
- Extract `DTSTART` → parse date+time → `dayOfWeek` (from JS Date.getDay()) + `startTime`
- Extract `DTEND` → `endTime`
- If `RRULE` contains `BYDAY`, emit one block per listed day
- Skip DTSTART;VALUE=DATE (all-day events)
- Default color: `"blue"`

VALIDATE: `npx tsc --noEmit`

---

### Step 5 — API Routes

Create directory: `src/app/api/schedule/`

Files to create:
- `src/app/api/schedule/route.ts` — GET (list today) + POST (create block)
- `src/app/api/schedule/[blockId]/route.ts` — PUT + DELETE
- `src/app/api/schedule/[blockId]/docs/route.ts` — POST (add doc)
- `src/app/api/schedule/[blockId]/docs/[docId]/route.ts` — DELETE
- `src/app/api/schedule/extract/route.ts` — POST (Vision + ics)

All routes: rate limit → auth check → Zod validate → DB → return.

Use `sessionRateLimiter` for CRUD routes. Use `scheduleExtractLimiter` for extract route.

GET /api/schedule: joins `scheduleDocLinks`, resolves portal URLs with `resolveDocUrl`.

VALIDATE after each file: `npx tsc --noEmit`

---

### Step 6 — VoiceQueueContext Extension
File: `src/contexts/voice-queue.tsx`

Actions:
1. Add to `QueueItemData` union (after `ask_coach` entry):
   ```ts
   | { type: "show_schedule" }
   | { type: "open_doc"; label: string; url: string }
   ```
2. Add to `VoiceQueueCtx` interface:
   ```ts
   scheduleOverlayOpen: boolean;
   setScheduleOverlayOpen: (open: boolean) => void;
   ```
3. Add `useState(false)` for `scheduleOverlayOpen` in `VoiceQueueProvider`
4. Expose in provider value object

**Tab indentation is critical.** If Edit tool fails silently (wrong whitespace), fall back to:
```bash
python3 -c "
content = open('src/contexts/voice-queue.tsx').read()
content = content.replace('OLD', 'NEW')
open('src/contexts/voice-queue.tsx', 'w').write(content)
"
```

VALIDATE: `npx tsc --noEmit`

---

### Step 7 — Voice Command Provider Update
File: `src/components/voice/voice-command-provider.tsx`

Actions:
1. Destructure `scheduleOverlayOpen` (suppress unused), `setScheduleOverlayOpen` from `useVoiceQueue()`
2. Add `scheduleDocOpenMode` state — fetched once from `/api/teacher-settings` on mount
3. In `handleCommand`, before the existing `move_to_group` check, add:
   ```ts
   if (data.type === "show_schedule") {
   	setScheduleOverlayOpen(true);
   	return;
   }
   if (data.type === "open_doc") {
   	handleDocOpen(data.label, data.url, data.linkType ?? "url", scheduleDocOpenMode);
   	return;
   }
   ```
4. Add `handleDocOpen` function above `handleCommand`
5. In `callVoiceAgent`, fetch schedule context and pass to voice agent API

**Read lines 114–140 of this file before touching `handleCommand`.** The structure is a
callback wrapping immediate-execute branches followed by queueing.

VALIDATE: `npx tsc --noEmit`

---

### Step 8 — Voice Agent System Prompt
File: `src/app/api/coach/voice-agent/route.ts`

Actions:
1. Add two new action schemas to `SYSTEM_PROMPT` action schemas list
2. Add schedule-related rules to Rules section
3. Add `scheduleBlocks` optional field to the `schema` Zod object (context)
4. Append schedule context line to `userContent` string

VALIDATE: `npx tsc --noEmit`

---

### Step 9 — Shared Hook
New file: `src/hooks/use-schedule-today.ts`

Implement `useScheduleToday()` as described above.

VALIDATE: `npx tsc --noEmit`

---

### Step 10 — Schedule Overlay Component
New directory: `src/components/schedule/`
New file: `src/components/schedule/schedule-overlay.tsx`

"use client" — uses `useVoiceQueue`, `useScheduleToday`, `useState`, `useEffect`.

CSS:
- Overlay panel: `fixed inset-y-0 left-0 z-50 w-80 flex flex-col bg-[#0d1525] border-r border-slate-700/60 shadow-2xl`
- Slide transition via `style={{ transform: scheduleOverlayOpen ? 'translateX(0)' : 'translateX(-100%)' }}`
  and `transition-transform duration-300 ease-in-out` class
- Backdrop: render when open: `fixed inset-0 bg-black/40 z-40` with `onClick` to close
- Always rendered in DOM (no conditional mount) — just hidden off-screen

Block list rendering:
- Each block: left color border (4px, color from block.color field mapped to Tailwind hex or inline style)
- Active block: `ring-2 ring-indigo-400 animate-pulse` on the left border, "NOW" badge
- Docs: small pill buttons, tap calls `handleDocTap`

VALIDATE: `npx tsc --noEmit`

---

### Step 11 — Dashboard Layout Injection
File: `src/app/(dashboard)/layout.tsx`

**Read the current file first** (it is only 12 lines — already shown above). Add:
```tsx
import { ScheduleOverlay } from "@/components/schedule/schedule-overlay";
```
And render `<ScheduleOverlay />` inside the outermost div, after `<main>{children}</main>`.

Confirm `VoiceQueueProvider` wraps this layout — check `src/app/layout.tsx` before editing.
If the provider is NOT in the root layout, wrap the dashboard layout content with it here
(but check first — double-wrapping a context causes bugs).

VALIDATE: `npx tsc --noEmit`

---

### Step 12 — Coach Page Sidebar Panel
File: `src/app/(dashboard)/coach/page.tsx`

**Read the left sidebar section before any edits** — find the area where `GroupsSidebarPanel`
is rendered (search for "GroupsSidebarPanel"). The sidebar section pattern uses a header button
with a chevron icon to toggle open/close.

Add:
1. `import { ScheduleSidebarPanel } from "@/components/schedule/schedule-sidebar-panel";`
2. `const [scheduleOpen, setScheduleOpen] = useState(false);` near other sidebar state
3. A new collapsible section block in the left sidebar JSX

Create: `src/components/schedule/schedule-sidebar-panel.tsx` — thin wrapper using
`useScheduleToday()`. Renders the same block list as the overlay but without the fixed
positioning. Inline, no backdrop.

**Tab indentation required. Do not add spaces. If Edit tool fails, use Python str.replace.**

VALIDATE: `npx tsc --noEmit`

---

### Step 13 — Settings Page Update
File: `src/app/(dashboard)/settings/page.tsx`

Actions:
1. Add `scheduleDocOpenMode` to the `Settings` type
2. Add schedule doc open mode selector in a "Schedule" settings section
3. Add `#schedule` anchor for deep-linking from the overlay footer

VALIDATE: `npx tsc --noEmit`

---

### Step 14 — Teacher Settings API Update
File: `src/app/api/teacher-settings/route.ts`

Add `scheduleDocOpenMode: z.enum(["toast", "new-tab"]).optional()` to `updateSettingsSchema`.

VALIDATE: `npx tsc --noEmit`

---

### Step 15 — Schedule Management UI in Settings
File: `src/app/(dashboard)/settings/page.tsx`

Add CRUD UI below the `scheduleDocOpenMode` selector:
- Block list with edit/delete
- Add block form
- Per-block doc link management
- Import buttons (photo + .ics)

This is the largest UI addition. Read the full page structure before editing. The page is
tab-indented. Do targeted edits — do not rewrite the whole page.

VALIDATE: `npx tsc --noEmit`

---

## Gotchas and Critical Rules

### Tab Indentation
**Every TSX/TS file in this project uses TABS not spaces.** The Edit tool fails silently when
indentation does not match exactly. When an Edit call does not change the file:
1. Do NOT retry the same Edit call
2. Use Python `str.replace()` via Bash instead:
   ```bash
   python3 << 'EOF'
   content = open('/path/to/file.tsx').read()
   content = content.replace(
       'exact old string with tabs',
       'exact new string with tabs'
   )
   open('/path/to/file.tsx', 'w').write(content)
   EOF
   ```

### coach/page.tsx is 1400+ Lines
Never rewrite the full file. Always:
1. Read the section you need + 20 lines above and below first
2. Make one small targeted edit at a time
3. Run `npx tsc --noEmit` after each edit

### Layout Rules for New Overlays
The schedule overlay is `fixed` positioned — it does NOT affect the page flow. The backdrop is
also `fixed`. Neither should use `pointer-events-none` since they are interactive. The overlay
renders above everything (`z-50`), backdrop at `z-40`.

Do NOT add `position: fixed` elements inside a scrollable column — add them as siblings to
`<main>` in the layout, not inside a page's content columns.

### VoiceQueueContext Double-Wrap Check
Before injecting `VoiceQueueProvider` anywhere, confirm it only wraps once. Check
`src/app/layout.tsx` and `src/app/(dashboard)/layout.tsx`. If `VoiceCommandProvider` is
already wrapping children somewhere, `useVoiceQueue` calls inside its subtree work — do not
add a second provider.

### window.open Blocked by Popup Blockers
`window.open` from inside speech recognition callbacks (not a direct user gesture) is blocked
by browsers. Always use the tappable toast pattern for external URLs unless the user explicitly
switches to "new-tab" mode in settings. Internal paths (`/board`, `/classes`, etc.) use
`window.location.href` instead and are never blocked.

### DB Migration Required
After schema changes: `npm run db:generate && npm run db:migrate`. The `teacherSettings` table
alter (adding `scheduleDocOpenMode`) must be run before any API route that reads/writes it.

### .ics Parser — No Heavy Library
Do NOT run `npm install ical.js` or any ical package. The package.json has no ical library and
adding one requires `npm install --force` on macOS arm64. The lightweight inline text parser in
`src/lib/ics-parser.ts` is sufficient for Google Calendar and Apple Calendar exports.

### Type Safety for New QueueItemData Union Members
After adding `show_schedule` and `open_doc` to `QueueItemData`, TypeScript will flag the
`executeCommand` switch in `voice-command-provider.tsx` as non-exhaustive if it checks all
variants. The existing code does not use exhaustive checks — it uses `else if` chains — so
new types will just fall through to the `catch` block. Add explicit handlers to avoid silent
failures.

### scheduleDocOpenMode Default
DB default is `"toast"`. The settings page type must be nullable-safe:
`settings.scheduleDocOpenMode ?? "toast"` in all render code. The API returns the column value
which defaults to `"toast"` even for rows created before the migration (Postgres `DEFAULT`
applies to new rows only — existing rows will have NULL until first settings save). Handle
`null` defensively everywhere: `(scheduleDocOpenMode ?? "toast") === "new-tab"`.

---

## File Checklist

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Add `scheduleBlocks`, `scheduleDocLinks` tables + `scheduleDocOpenMode` column + relations |
| `src/lib/rate-limit.ts` | Add `scheduleExtractLimiter` |
| `src/lib/portal-urls.ts` | New — portal key → URL map + `resolveDocUrl()` |
| `src/lib/ics-parser.ts` | New — lightweight .ics text parser |
| `src/app/api/schedule/route.ts` | New — GET + POST |
| `src/app/api/schedule/[blockId]/route.ts` | New — PUT + DELETE |
| `src/app/api/schedule/[blockId]/docs/route.ts` | New — POST |
| `src/app/api/schedule/[blockId]/docs/[docId]/route.ts` | New — DELETE |
| `src/app/api/schedule/extract/route.ts` | New — Vision + ics parse |
| `src/app/api/teacher-settings/route.ts` | Add `scheduleDocOpenMode` to Zod schema |
| `src/contexts/voice-queue.tsx` | Add `show_schedule`, `open_doc` types + overlay state |
| `src/components/voice/voice-command-provider.tsx` | Handle new actions + pass schedule context to agent |
| `src/app/api/coach/voice-agent/route.ts` | Add action schemas + rules + context field |
| `src/hooks/use-schedule-today.ts` | New — shared data hook |
| `src/components/schedule/schedule-overlay.tsx` | New — fixed overlay component |
| `src/components/schedule/schedule-sidebar-panel.tsx` | New — inline panel for coach page |
| `src/app/(dashboard)/layout.tsx` | Inject `<ScheduleOverlay />` |
| `src/app/(dashboard)/coach/page.tsx` | Add schedule sidebar section (targeted edit) |
| `src/app/(dashboard)/settings/page.tsx` | Add `scheduleDocOpenMode` + schedule CRUD UI |
