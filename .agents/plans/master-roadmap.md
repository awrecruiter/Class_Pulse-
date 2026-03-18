# Class Pulse — Master Roadmap
_Last updated: 2026-03-17_

---

## 1. Curriculum Calendar Auto-Population
**Goal:** Teacher uploads a pacing guide or year-at-a-glance (PDF, CSV, or Excel) → lessons appear on the right calendar days automatically, with resource links attached to each block so the teacher can open materials directly from the coach view.

### File formats supported
- [ ] **PDF** — pacing guide scans, district-issued calendars
- [ ] **CSV** — simple `date, lesson title, standard, url` exports
- [ ] **Excel (.xlsx)** — most district pacing guides come in this format; use `xlsx` / `exceljs` npm package to parse sheets
- [ ] **ICS** — Apple/Google calendar exports (parser at `src/lib/ics-parser.ts` already exists)

### What needs building

#### Upload & parsing
- [ ] Upload endpoint: `POST /api/schedule/import` — accepts multipart/form-data with file + classId
- [ ] File type detection by MIME + extension; route to correct parser
- [ ] Excel parser: iterate rows, map columns → `{ date, title, unit?, standard?, links[] }` — handle merged cells and multi-row headers
- [ ] PDF parser: send text content to Claude for extraction (same prompt as CSV path)
- [ ] AI extraction pipeline (`src/lib/ai/schedule-parser.ts`): Claude reads raw text → returns `[{ date: "YYYY-MM-DD", title, unit?, standard?, docs: [{ label, url }] }]`

#### Auto-linked resources (key requirement)
- [ ] For each extracted lesson, Claude also identifies any **resource links** mentioned in the pacing guide (McGraw Hill chapter URLs, IXL skill URLs, iReady lesson codes, document titles)
- [ ] Known portal base URLs (`src/lib/portal-urls.ts`) are used to construct deep links automatically — e.g. "IXL Skill B.4" → `https://www.ixl.com/math/grade-5/...`
- [ ] Each created schedule block gets its `docs[]` array pre-populated with these links
- [ ] In the coach view, the schedule sidebar and overlay show these links as clickable buttons — teacher taps to open the resource without ever leaving the app
- [ ] Voice command: "open [lesson resource]" → opens the linked doc (already wired in voice agent `open_doc` action)

#### UI
- [ ] Upload UI in Schedule settings tab — drag-drop zone accepting PDF/CSV/XLSX/ICS
- [ ] Preview table before confirm: shows parsed `date | lesson | standard | links` — teacher can edit/remove rows
- [ ] Conflict detection: if a day already has a block, highlight in yellow; let teacher choose merge or skip per row
- [ ] Progress indicator during AI extraction (can take 5–15s for large guides)
- [ ] After confirm: bulk-create blocks via existing `POST /api/schedule/bulk`; refresh calendar

### Already built (no rework needed)
- `ScheduleDocLinkRow` type + `docs[]` array on every `ScheduleBlockRow` ✅
- `POST /api/schedule/[blockId]/docs` and `DELETE /api/schedule/[blockId]/docs/[docId]` ✅
- Doc add/delete UI in block edit popover ✅
- `open_doc` voice action in voice agent ✅
- `src/lib/portal-urls.ts` — portal base URLs for auto-linking ✅

### Important: docs are shown in edit popover but NOT as clickable open buttons on the block face or sidebar
- Need to add a clickable link row on the block card face (small icon buttons) so teacher can tap to open without opening the edit dialog
- Sidebar panel should show today's block docs as tap-to-open links

### Files to touch
- `src/app/api/schedule/import/route.ts` (new)
- `src/lib/ai/schedule-parser.ts` (new) — Claude extraction prompt for pacing guides
- `src/lib/excel-parser.ts` (new) — xlsx row → structured lesson
- `src/app/(dashboard)/settings/page.tsx` — add Import tab with drag-drop
- `src/components/schedule/schedule-calendar.tsx` — add clickable doc link buttons on block face
- `src/components/schedule/schedule-sidebar-panel.tsx` — show doc links as tap-to-open in today's view
- `package.json` — add `xlsx` or `exceljs` dependency

---

## 2. SMS / Text Sending
**Goal:** Parent messages actually send via AWS SNS. Currently the backend exists but may not be firing correctly.

### Known issues to diagnose
- [ ] Verify AWS env vars are set in production (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SNS_FROM_NUMBER`)
- [ ] Test `POST /api/classes/[id]/parent-message` end-to-end with a real phone number
- [ ] Confirm behavior ladder step 5+ auto-triggers message (check `src/app/api/classes/[id]/behavior/incident/route.ts`)
- [ ] Add delivery status logging — store `smsStatus: "sent" | "failed" | "no_number"` on parent message record
- [ ] Surface send failures as toast in Parent Comms panel so teacher knows when a message didn't go out
- [ ] Rate limit: confirm `smsRateLimiter` (10/min) is registered in `src/lib/rate-limit.ts`

### Files to touch
- `src/app/api/classes/[id]/parent-message/route.ts`
- `src/app/api/classes/[id]/behavior/incident/route.ts`
- `src/lib/sms.ts`
- `src/components/coach/parent-comms-panel.tsx`

---

## 3. Voice Commands — Full Coverage & Reliability
**Goal:** Everything in the app is voice-operable. No command silently fails.

### Missing / broken commands to fix
- [ ] **DI group assignment by performance** — "move Marcus to the red group" after session results
- [ ] **Store commands** — "open store", "close store", "approve [student]'s purchase"
- [ ] **Session commands** — "start session", "end session", "push fraction bar to class"
- [ ] **Gradebook** — "log score for Marcus, 8 out of 10"
- [ ] **Behavior fine** — "fine Marcus 5 bucks" → `ram_bucks_deduct`
- [ ] **Group coins** — "give Dogs 10 coins" → `group_coins`
- [ ] **Consequence steps** — "give Marcus a warning" → step 1; "Marcus gets silent lunch" → step 4
- [ ] **Parent message** — "send a message to Marcus's parents: he had a great day"
- [ ] **Ask coach** — "hey coach, what's a good way to teach fractions?"
- [ ] **Lecture** — "start recording", "stop recording"

### System improvements
- [ ] **Confirmation toast for every command** — currently some commands execute silently; every action must show a toast (success or failure)
- [ ] **Voice feedback (TTS)** — optionally read back what was executed: "Done — moved Marcus to Dogs"
- [ ] **Retry on AI timeout** — if voice agent call fails, retry once before dropping
- [ ] **Offline fast-path expansion** — extend regex fast-path to cover RAM bucks, consequence steps, group coins so they work even if AI is rate-limited
- [ ] **Voice status indicator** — always-visible mic state (idle / listening / processing) in the nav bar
- [ ] **"What can I say?"** — voice command: "help" or "what can I say" → TTS reads available commands

### Files to touch
- `src/app/api/coach/voice-agent/route.ts` — expand SYSTEM_PROMPT schemas
- `src/components/voice/voice-command-provider.tsx` — add regex fast-paths, improve `handleCommand`
- `src/contexts/voice-queue.tsx` — add toast for every queued item
- `src/hooks/use-global-voice-commands.ts`

---

## 4. DI Groups — Upload Assessment Data & Auto-Assign
**Goal:** Teacher uploads DI groups CSV or assessment export → students auto-placed into groups; teacher can navigate to and view each student's data.

### What needs building
- [ ] **Assessment data upload**: `POST /api/classes/[id]/roster/assessment-import` — accepts iReady CSV, teacher-made CSV (`[studentId, score, level]`)
- [ ] **Auto-assign to groups** by score percentile: bottom 25% → group A, 25–50% → group B, 50–75% → group C, top 25% → group D (configurable)
- [ ] **DI session view per student**: when teacher navigates to a student in the DI panel, show their assessment score + level + iReady reading/math percentile
- [ ] **Voice command**: "show me Marcus's DI data" → opens student detail in DI panel
- [ ] **Voice command**: "move top performers to Eagles" → reassigns students above threshold
- [ ] **CSV export of groups** with scores for sharing with admin
- [ ] **iReady deep link**: if iReady URL is in portal URLs, "open Marcus's iReady" navigates directly

### Files to touch
- `src/app/api/classes/[id]/roster/assessment-import/route.ts` (new)
- `src/components/coach/di-panel.tsx` — student detail view with score
- `src/app/api/coach/voice-agent/route.ts` — add `show_student_data` action
- `src/components/voice/voice-command-provider.tsx`

---

## 5. Student View Optimization
**Goal:** Student-facing UI (`/student`) is polished, fast, and child-appropriate.

### Issues / improvements
- [ ] **Loading state** — replace blank screen during session join with animated spinner + "Finding your class..."
- [ ] **Disconnection recovery** — if SSE drops, auto-reconnect with backoff; show "Reconnecting..." banner
- [ ] **Manipulative transitions** — smooth slide-in when teacher pushes a new manipulative
- [ ] **RAM Buck balance display** — show student's current RAM Buck balance on their screen
- [ ] **Celebration animation** — when student earns RAM Bucks, show burst animation (component exists at `ram-buck-burst.tsx`, needs wiring to student view)
- [ ] **Quiz feedback** — after answering, show correct/incorrect with brief explanation before moving on
- [ ] **Dark/light mode** — student view should auto-follow system preference (currently forced dark)
- [ ] **Accessibility** — font size increase button; high-contrast option
- [ ] **Performance** — reduce re-renders in `student-session.tsx`; SSE polling interval tuning

### Files to touch
- `src/app/student/[sessionId]/student-session.tsx`
- `src/app/student/[sessionId]/page.tsx`
- `src/components/coach/manipulatives/student/`

---

## 6. QA Test Plan
**Goal:** Every feature has a verified passing state before shipping.

### Test matrix

| Feature | Test type | Status |
|---------|-----------|--------|
| Voice → navigate | Unit (regex fast-path) | ⬜ |
| Voice → move_to_group (English name) | Unit | ⬜ |
| Voice → move_to_group (ethnic name fuzzy) | Unit | ⬜ |
| Voice → ram_bucks | Unit | ⬜ |
| Voice → consequence step | Unit | ⬜ |
| Voice → group_coins | Unit | ⬜ |
| Voice → parent_message | Unit | ⬜ |
| SMS send success | Integration | ⬜ |
| SMS send failure (no number) | Integration | ⬜ |
| Schedule import (CSV) | Integration | ⬜ |
| Schedule import (PDF pacing guide) | Integration | ⬜ |
| DI group auto-assign | Integration | ⬜ |
| Student join flow | E2E | ⬜ |
| Student manipulative push | E2E | ⬜ |
| Teacher behavior ladder step 1–8 | E2E | ⬜ |
| Store open/close/purchase | E2E | ⬜ |
| Calendar overlap labels | Visual | ⬜ |
| Groups sidebar scroll | Visual | ⬜ |

### Infrastructure needed
- [ ] Vitest unit tests for voice command parser (`resolveStudent`, `resolveGroup`, regex fast-paths)
- [ ] Vitest unit tests for `ics-parser.ts` and schedule bulk import
- [ ] E2E test expansion (Playwright) — student join, session flow, behavior ladder
- [ ] GitHub Actions already wired (`.github/workflows/validate.yml`) — add E2E job

---

---

## 7. Voice Reminders
**Goal:** Teacher speaks a reminder → it is created on the correct calendar day automatically.

### Examples
- "Remind me on Friday to bring the fraction manipulatives"
- "Add a reminder for March 25th — parent-teacher conferences"
- "Remind me next Monday to submit grades"

### What needs building
- [ ] New voice action: `{"type":"create_reminder","text":"<reminder text>","date":"YYYY-MM-DD"}` in voice agent SYSTEM_PROMPT
- [ ] Claude extracts the date from natural language ("Friday", "next Monday", "March 25th") relative to today's date (pass `today` in context)
- [ ] `POST /api/schedule/reminders` — stores reminder as a special schedule block with `blockType: "reminder"` and a fixed color (yellow)
- [ ] Reminder blocks show on the calendar day with a bell icon instead of a time range
- [ ] Optional: at session start, if today has reminders, TTS reads them aloud ("You have 2 reminders for today")
- [ ] Voice command to dismiss: "dismiss reminder about manipulatives"

### Fast-path regex (no AI needed for simple cases)
```
/remind(?:er)?\s+(?:me\s+)?(?:on\s+)?(.+?)\s+(?:to|about|that)\s+(.+)/i
```

### Files to touch
- `src/app/api/schedule/reminders/route.ts` (new) — or extend existing `POST /api/schedule`
- `src/app/api/coach/voice-agent/route.ts` — add `create_reminder` action + date context
- `src/components/voice/voice-command-provider.tsx` — handle `create_reminder`, call reminders API
- `src/components/schedule/schedule-calendar.tsx` — render reminder block type with bell icon
- `src/lib/db/schema.ts` — add `blockType` column to `scheduleBlocks` (or use existing `color` field as discriminant)

---

## Priority Order

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | SMS diagnosis & fix | S | High — core feature broken |
| 2 | Voice command full coverage + toasts | M | High — voice is the key UX |
| 3 | Voice reminders (speak → calendar day) | S | High — daily friction point |
| 4 | DI assessment upload + auto-assign | M | High — daily teacher workflow |
| 5 | Curriculum calendar import (PDF/CSV/XLSX) + auto-linked resources | L | High — reduces setup time |
| 6 | Student view polish | M | Medium — student-facing |
| 7 | QA test suite | M | Medium — confidence/reliability |

---

## Notes
- All voice commands must show a toast on success AND failure — silent failures are unacceptable
- Student names in voice commands must always use phonetic fuzzy matching (Levenshtein, threshold 40%)
- Calendar import should never silently overwrite existing blocks — always confirm conflicts
- SMS failures must never crash the behavior ladder — always degrade gracefully and log
