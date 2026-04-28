# Product Requirements Document
## Class Pulse — Classroom Intelligence Platform

**Last updated:** 2026-04-28
**Status:** All 12 phases shipped (Phases 9, 11, 12 partial) + post-roadmap features live

---

## Executive Summary

Class Pulse is a mobile-first classroom intelligence platform for 5th grade Florida math teachers. It combines an AI Instructional Coach, a real-time student comprehension system, an interactive adaptive learning engine, a classroom behavior/economy management system, a parent communication loop, a pacing calendar, and a lesson resource catalog — all built for the specific needs of FL BEST Math instruction.

The platform operates across five surfaces:
- **Teacher device** — AI coach, live class dashboard, behavior management, RAM Buck economy
- **Board** — projected classroom display: portal links, group coins, comprehension pulse, resource viewer
- **Student device** — interactive manipulatives, comprehension signal, mastery loop, reward store
- **Post-class** — gradebook, differentiation groups, behavior profiles, parent communications
- **Parent-facing** — public tokenized report with visual status tiles (no login required)

---

## Mission

**Help Florida teachers meet every student where they are — in the moment it matters, and across every dimension of the classroom.**

### Core Principles

1. **Grounded, not generic** — Every AI response references what was actually taught today.
2. **30-second executable** — Suggestions must be actionable with no prep, no materials, no delay.
3. **Privacy by architecture** — Student roster stores ID + initials only. No student PII in AI calls.
4. **Standards-anchored** — All gap analysis traces to specific FL BEST Math prerequisite codes (Gr 3–5).
5. **Mobile-first** — Teacher is moving. UI must work one-handed on a phone screen.
6. **Child-appropriate student UI** — Student-facing surfaces are colorful, engaging, Prodigy/Khan Academy Kids energy.

---

## Target Users

### Primary: 5th Grade Florida Math Teachers
- Teaching in FL public schools under FL BEST Math standards
- Multiple class periods (AM/PM groups, period blocks) with different student rosters
- Moving around the room during practice time, phone in hand
- Need instant, specific guidance — not a search tool or a lesson plan generator

### Secondary: Students (age ~10)
- Accessing on personal devices (phone, tablet, Chromebook)
- Interacting with manipulatives, signaling confusion, earning RAM Bucks
- Must never create accounts or enter PII

### Tertiary: Parents
- Receive a tokenized URL (shared by teacher via SMS or ClassDojo)
- View a read-only, public status report — no login required

---

## Architecture Overview

```
Teacher App (authenticated, /dashboard)
  ├── AI Instructional Coach (/coach)
  │   ├── Lecture mic + rolling transcript (2500 words, ephemeral)
  │   ├── Orb push-to-talk → voice agent → coach query
  │   ├── Behavior chat (persistent behavior coach)
  │   ├── DI panel (differentiated instruction sessions)
  │   ├── Comprehension panel (live signal aggregate)
  │   ├── Groups sidebar
  │   ├── Parent comms panel
  │   ├── Schedule sidebar
  │   ├── Today's resources panel
  │   ├── Lecture Visualizer (30s debounce)
  │   └── Waveform walkie-talkie meter (teacher → student)
  ├── Class Manager (/classes)
  │   ├── Multiple periods: AM Math, PM Math, Period 3...
  │   ├── Roster per class (student ID + initials, CSV/Excel import)
  │   ├── Groups kanban (Dogs / Cats / Birds / Bears, max 6 per group)
  │   ├── RAM Bucks panel (balances + award)
  │   └── Coin Activities (group milestone goals)
  ├── Live Session Dashboard (/classes/[id]/session)
  │   ├── Comprehension pulse (aggregate only, real-time SSE)
  │   ├── Manipulative push controls
  │   └── Student correction request feed
  ├── Post-Class Report (/classes/[id]/report)
  │   ├── Comprehension timeline
  │   ├── Student mastery grid
  │   └── Differentiation groups + AI reteach recommendations
  ├── Pacing Calendar (/pacing) — YAAG 2025-2026, daily lesson assignment
  ├── Resources (/resources) — lesson resource catalog (per lesson, voice-openable)
  ├── Gradebook (/gradebook) — CFU tracker, CSV export
  ├── Store (/store) — privilege purchase approval queue
  ├── Parent Comms (/parent-comms) — parent contacts + intervention history
  └── Settings (/settings) — mastery threshold, alert %, store schedule, voice prefs, fee schedule

Board App (public, projected display, /board)
  ├── Portal panel — student app portals (iReady, IXL, Clever, etc.)
  ├── Groups panel — group coin balances + milestone progress
  ├── Pulse panel — live comprehension aggregate
  └── Resource viewer — lesson resource fullscreen overlay

Student App (no auth, /student)
  ├── Join screen — 6-char code + pick name from roster
  ├── Active session — comprehension signal + pushed manipulatives
  ├── Waveform display — teacher voice amplitude bar (walkie-talkie)
  ├── Mastery loop — interactive manipulative → check questions → earn RAM Bucks
  ├── Correction request ("I'm Lost" button) → teacher feed
  └── RAM Buck store — balance, transaction history, earning guide, browse menu, request purchases

Parent Report (public, tokenized, /report/[token])
  ├── Visual status tiles (RAM Bucks, behavior step, mastery %)
  ├── Behavior incident summary
  ├── Intervention recommendations
  └── IXL skill map suggestions

Data Layer (Neon Postgres + Drizzle ORM)
  ├── Auth: profiles, organizations, org_memberships, subscriptions
  ├── Class: classes, roster_entries, class_sessions
  ├── Learning: comprehension_signals, manipulative_pushes, mastery_records,
  │            check_question_responses (future), drawing_analyses
  ├── Economy: ram_buck_accounts, ram_buck_transactions, ram_buck_fee_schedule,
  │            group_accounts, group_milestones
  ├── Behavior: behavior_profiles, behavior_incidents, parent_notifications,
  │            parent_contacts, parent_messages, intervention_flags
  ├── Store: privilege_items, privilege_purchases
  ├── Gradebook: cfu_entries, confusion_marks
  ├── DI: di_sessions, di_groups, di_group_members
  ├── Schedule: schedule_blocks, schedule_doc_links
  ├── Pacing: pacing_overrides, blocked_days, pacing_lesson_placements,
  │           pacing_guide_entries, class_assignments
  ├── Resources: lesson_resource_defaults, lesson_resources
  ├── Reporting: parent_report_tokens
  └── Voice/AI: ambient_alerts, correction_requests
```

---

## Real-Time Transport

**Server-Sent Events (SSE) + DB polling every 5 seconds** — no new packages. Next.js 15 App Router handles SSE natively via `ReadableStream`. Student → server via normal `POST`; server → teacher/student via SSE.

Noise (waveform walkie-talkie) uses its own polling channel: teacher mic amplitude → `POST /api/sessions/[id]/noise` (max 5/sec, throttled client-side) → in-memory noise store → student SSE feed (`/api/sessions/[id]/student-feed`) delivers `{ type: "noise", level: 0–100 }` events every 200ms.

---

## Student Identity Model

- Teacher creates roster per class: **student ID + first initial + last initial** (e.g. `10293847 — J.M.`)
- Students join via 6-char uppercase alphanumeric join code (no 0/O/I/1)
- Student auth = signed cookie `student_session` containing `{ sessionId, rosterId }` (HMAC-SHA256, no new package)
- No student Neon Auth accounts
- No student PII beyond initials + school-assigned ID
- Student balances, mastery, and behavior scoped per class (AM class Jordan ≠ PM class Jordan)
- CSV and Excel (.xlsx) upload supported for roster import

---

## Class / Session Model

| Concept | Definition | Example |
|---|---|---|
| **Class** | Recurring group of students, exists all semester | "AM Math", "PM Math", "Period 3" |
| **Session** | Single daily meeting of a class | "AM Math — Apr 28" |
| **Roster** | Belongs to the class, not the session | 23 students in AM |
| **Groups** | Belong to the class, persist all semester | AM Dogs/Cats/Birds/Bears |
| **RAM Buck balance** | Per student per class, accumulates across sessions | Jordan in AM has 340 bucks |

---

## Two Currency Systems

### Individual: RAM Bucks
- Earned academically (check question correct, mastery, iReady) and behaviorally (teacher voice, touch)
- Spent at the Privilege Store (`/store`) for personal privileges
- Deducted automatically per fee schedule when behavior consequence logged
- Stored in `ram_buck_accounts` + `ram_buck_transactions`

### Group: Coins
- Groups earn coins collectively (teacher voice: "give dogs two coins")
- Coin balance unlocks daily activities (PE, Gym, Recess, etc.) configured as Coin Activities
- Managed in `group_accounts` + `group_milestones`
- **These are completely separate systems** — privilege items are individual only

### Default RAM Buck Fee Schedule (teacher configures in `/settings`)

| Step | Label | Default Deduction |
|---|---|---|
| 1 | Ram Buck Fine | −5 bucks |
| 2 | No Games | −10 bucks |
| 3 | No PE | −15 bucks |
| 4 | Silent Lunch | −20 bucks |
| 5 | Call Home | −30 bucks |
| 6 | Write Up | −40 bucks |
| 7 | Detention | −60 bucks |
| 8 | Saturday School | −100 bucks |

---

## Behavior Ladder

**8-step consequence escalation.** Each incident moves student one step further.

- Step 1–4: classroom-level consequences, auto RAM Buck deduction
- Steps 5–8: auto-generate parent notification (ClassDojo-formatted message) + optional SMS via AWS SNS
- All incidents logged in `behavior_incidents` — teacher-only, exportable
- Reset interval: teacher-configured (daily/weekly/monthly/quarterly/manual)
- AI behavior coach is **child-psychology-aware** in all recommendations

---

## Groups

- Four groups per class: **Dogs, Cats, Birds, Bears** (teacher can rename)
- Max 6 students per group
- Auto-assigned by academic performance level on roster import
- Teacher can manually drag/reassign via kanban UI on `/classes/[id]`
- Groups collectively gated from specials (PE, games) based on coin balance vs. milestone threshold

---

## Privilege Menu (Store)

- Fixed baseline menu items + teacher daily specials
- Teacher configures from `/settings` — items stored in `privilege_items`
- Teacher schedules store window (daily/weekly/monthly/quarterly/manual open)
- Students at Step 5+ (Call Home or higher) automatically excluded — teacher can override
- Flow: student requests → teacher sees queue at `/store` → approve/reject via touch or voice
- Student sees balance, transaction history, and earning guide in the student app

---

## Voice Command System

The always-on voice command system is live for all teacher dashboard pages:

### Global Voice Mic (always-on when lecture mic is off)
Handles: navigation, RAM bucks, group coins, behavior log, move to group, start/end session, store open/close, DI panel, schedule, parent comms, resource open.

**Does NOT handle:** `ask_coach` (requires deliberate orb press — prevents ambient student speech from triggering AI coach).

### Orb (push-to-talk)
Teacher holds the orb to speak a command or academic question. Routes through voice agent. `ask_coach` only fires from this path.

### Board Voice Commands
Handles app switching (`iReady`, `IXL`, `Clever`, etc.) and panel switching on the board surface.

### Voice Agent API (`/api/coach/voice-agent`)
- Model: Claude Haiku, max 256 tokens, output-only JSON
- Classifies transcript → typed action schema (navigate, ram_bucks, consequence, ask_coach, etc.)
- Fast-path regex intercepts: navigation, move_to_group, RAM bucks, group coins, resource open — no AI needed
- Student name fuzzy matching: Levenshtein edit distance, handles phonetic/ethnic name variants

### Voice Priority Semaphore (mic manager)
| Priority | Slot | Description |
|---|---|---|
| 4 | `lecture` | Lecture transcript mic (highest — yields to nobody) |
| 3 | `dictation` | Parent comms dictation |
| 2 | `orb` | Push-to-talk orb |
| 1 | `globalVoice` | Always-on command mic |

### Voice Lock
Optional speaker verification via Web Audio API pitch analysis. Pitch samples buffered over 2s; avg compared against saved voice profile. Disabled in production handoff mode.

---

## AI Systems

### Instructional Coach (`/api/coach`)
- Model: `claude-haiku-4-5-20251001`, max 2000 tokens
- Grounded in FL BEST Math standards corpus (108 benchmarks, Gr 3–5)
- Grounded in rolling 2500-word lecture transcript (React state only, never persisted)
- Returns: studentInterpretation, missingConcept, script, visual, microIntervention, guidingQuestions, manipulative, gradePrereq, below
- Accordion UI: tap card to expand → VoiceOrb + interactive content + grade-below section

### Voice Agent (`/api/coach/voice-agent`)
- Model: Claude Haiku, max 256 tokens
- Classifies teacher speech → typed action schema
- Fast-path regex for common patterns (no AI spend)

### Behavior Coach (`/api/coach/behavior`)
- Model: Claude Haiku, conversational with 20-message history
- Handles: behavior incidents, RAM buck awards/deductions, iReady logging, advice
- Student referred to by ID only — no names in API context
- Auto-executes RAM buck transactions and incident logs based on actionType

### Lecture Visualizer (`/api/coach/visualize`)
- Debounced 30s trigger during lecture recording
- Generates: concept name + text/ASCII whiteboard visual + 3 key points
- Collapsible card below transcript area

### DI Voice (`/api/coach/di-voice`)
- Routes orb speech to the active DI session
- Manages group transitions, mastery marks within a DI session

### Ambient Scan (`/api/coach/ambient-scan`)
- AI anomaly detector polling every 5 minutes while session active
- Analyzes comprehension signal patterns for at-risk detection

### Drawing Analyzer
- Claude Vision analyzes student canvas submission
- Identifies where mental model breaks against current FL BEST standard
- Image NOT stored — only analysis result persisted in `drawing_analyses`

### TTS (`/api/tts`)
- Edge-TTS synthesis for coach script narration and student feedback

### Manim Animation (`/api/coach/animate`)
- Renders mathematical animations for manipulative visualization

---

## Pacing Calendar

- Based on YAAG 2025–2026 district pacing guide (`src/data/yaag-2025-2026.ts`)
- Teacher view at `/pacing` — visual monthly calendar, topic/lesson grid
- Teacher assigns daily lessons: `POST /api/classes/[id]/assignment`
- Teacher can override pacing: blocked days, manual lesson shifts
- `getTodayPacing()` helper used across coach, board, and resource pages
- API: `/api/pacing/calendar`, `/api/pacing/overrides`, `/api/pacing/blocked-days`, `/api/pacing/placements`

---

## Lesson Resource Catalog

- Teacher view at `/resources` — per-lesson resource links
- Resource types: slides, book, worksheet, video
- Links configurable per lesson per teacher
- Voice-openable: "open slides" → voice agent → opens today's lesson resource
- OneDrive/Google Drive URL hints during link entry
- Import/export: CSV upload/download
- API: `/api/resources/lesson`, `/api/resources/lesson/import`, `/api/resources/lesson/export`

---

## Schedule System

- Teacher configures daily schedule blocks (Math, Reading, PE, etc.)
- Each block can have linked docs (Google Docs, OneDrive, ICS calendar)
- Schedule overlay available from any dashboard page (voice: "show my schedule")
- ICS file parsing: extracts schedule events from Apple/Google Calendar exports
- API: `/api/schedule`, `/api/schedule/[blockId]`, `/api/schedule/[blockId]/docs`, `/api/schedule/extract`

---

## Parent Communication Loop

- Parent contacts stored per class (`parent_contacts` table) — name, phone, email
- CSV import for bulk contact upload
- Behavior steps 5–8 auto-generate ClassDojo-formatted message + optional SMS via AWS SNS
- Teacher can manually send SMS from parent comms panel (`/parent-comms`)
- Cross-session pattern detection: `intervention_flags` tracks students across multiple sessions
- Parent report: teacher generates tokenized URL → shared via SMS/ClassDojo → parent views at `/report/[token]`
- Parent report shows: visual status tiles (RAM Bucks, behavior step, mastery %), incident summary, IXL skill map recommendations

---

## Board Surface (`/board`)

Projected classroom display, separate from teacher phone. Panels:

| Panel | Content |
|---|---|
| Portal | Student app portals with icons (iReady, IXL, Clever, McGraw-Hill, Schoology, Pinnacle, etc.) |
| Groups | Group coin balances, milestone progress bars, celebration animations |
| Pulse | Live comprehension aggregate (got-it / almost / lost donut) |
| Resource Viewer | Fullscreen resource embed/link |

- Voice-switchable: "board iReady", "show groups on board"
- Manages its own board voice mic (separate from teacher mic)

---

## Database Schema (complete)

### Auth / Org
- `profiles` — teacher profiles
- `link_items`, `click_events` — legacy (unused in active product)
- `organizations` — org/school groupings
- `organization_memberships` — teacher → org
- `subscriptions` — plan + status per org

### Class Foundation
- `teacher_settings` — mastery threshold, alert %, store schedule, voice prefs, fee schedule link
- `classes` — recurring class periods (teacherId, label, periodTime)
- `roster_entries` — studentId + initials per class, firstName optional
- `class_sessions` — daily meetings with join code (classId FK)
- `class_assignments` — daily lesson assignment per class

### Learning
- `comprehension_signals` — 3-state signal log per student per session
- `manipulative_pushes` — log of auto/teacher-triggered manipulative pushes
- `mastery_records` — per student per standard: status, consecutiveCorrect, lastModality
- `drawing_analyses` — Claude Vision results (no image stored)
- `correction_requests` — student "I'm Lost" requests per session
- `confusion_marks` — per-student confusion log
- `ambient_alerts` — AI anomaly scan results

### DI Sessions
- `di_sessions` — differentiated instruction session per class
- `di_groups` — groups within a DI session
- `di_group_members` — student → DI group assignment

### Economy
- `ram_buck_accounts` — individual balance per student per class
- `ram_buck_transactions` — full ledger (academic | behavior-positive | behavior-fine | purchase…)
- `ram_buck_fee_schedule` — infraction → deduction amount per teacher
- `group_accounts` — shared group coin balance
- `group_milestones` — coin thresholds → unlocked activity per class

### Behavior
- `behavior_profiles` — current step, history
- `behavior_incidents` — incident log per student per session
- `parent_notifications` — generated messages, sent status
- `parent_contacts` — name, phone, email per class
- `parent_messages` — sent message log
- `intervention_flags` — cross-session pattern detection per student

### Store
- `privilege_items` — menu items per teacher (label, cost, duration)
- `privilege_purchases` — request/approval log

### Gradebook
- `cfu_entries` — daily check-for-understanding scores per student per standard

### Schedule
- `schedule_blocks` — blocks per teacher (title, day, startTime, endTime)
- `schedule_doc_links` — linked docs per block (label, url)

### Pacing
- `pacing_overrides` — manual lesson shifts
- `blocked_days` — non-instruction days
- `pacing_lesson_placements` — computed lesson → date map
- `pacing_guide_entries` — per-teacher pacing guide customizations

### Resources
- `lesson_resource_defaults` — system-level defaults per lesson
- `lesson_resources` — teacher-level resources per lesson

### Reporting
- `parent_report_tokens` — tokenized access per student per class (expiry, generated by teacher)

---

## 12-Phase Roadmap (Shipped Status)

### ✅ Phase 0 — AI Instructional Coach
Core coach with FL BEST grounding, 4 remediation approaches, visual manipulatives, progressive deepening, interactive accordion cards, grade-below scaffolds, VoiceOrb narration.

### ✅ Phase 1 — Session Foundation
Classes, roster, join code, student cookie auth, `/classes` and `/student` surfaces.

### ✅ Phase 2 — Comprehension Pulse
Real-time 3-state signal (Got It / Almost / Lost). Teacher sees aggregate only via SSE. 60s stuck detection. `/classes/[id]/session` live dashboard.

### ✅ Phase 3 — Interactive Manipulatives (Student-Side)
Fraction bars, area model, number line on student devices. Teacher push via SSE. Manipulative overlay on student screen.

### ✅ Phase 4 — Mastery Loop
After manipulative: check questions. Wrong → switch modality or grade-below. Right → harder variant. Mastery = N consecutive correct (default 3, teacher-configurable).

### ✅ Phase 5 — Drawing Analysis + Teacher Dashboard
Claude Vision analyzes student canvas. Post-class report: comprehension timeline, mastery grid, AI differentiation groups (Extension/Practice/Reteach). `/classes/[id]/report`.

### ✅ Phase 6 — Lecture Visualizer + Settings
Lecture Visualizer: debounced AI call every 30s. Teacher Settings at `/settings`: mastery threshold, alert %, alias mode, store schedule, voice preferences.

### ✅ Phase 7 — Student Groups + Roster Import
CSV/Excel upload. Auto-group by performance. Dogs/Cats/Birds/Bears (max 6). Teacher drag-to-adjust. Kanban UI on class page.

### ✅ Phase 8 — RAM Buck Economy
Individual + group accounts. Academic auto-earning. Teacher narrates to AI agent (voice + touch). Fee schedule auto-deducts on consequence. Configurable store window. Teacher ledger sheet (tap student balance → transaction history).

### ✅ Phase 9 — Behavior Ladder + Consequence Tracking *(partial)*
8-step consequence escalation ✅. Auto RAM Buck deduction ✅. Auto parent message (ClassDojo-formatted) at Step 5+ ✅. SMS via AWS SNS ✅. Parent contacts CRUD ✅. Behavior profiles ✅. **Not shipped:** behavior profile export, group behavior gating of specials.

### ✅ Phase 10 — Privilege Menu + Store
Fixed baseline + teacher specials ✅. Teacher-scheduled store window ✅. Student request → teacher approve ✅. Behavior gate ✅. Student RAM Bucks ledger (balance + history + earning guide) ✅. Real-time approval/rejection via SSE ✅.

### ✅ Phase 11 — AI Behavior Coach *(partial)*
Behavior coach chat ✅. RAM buck/incident auto-execution ✅. **Not shipped:** proactive daily alerts, cross-session pattern push notifications, ambient intelligence, persistent all-day context.

### ✅ Phase 12 — Gradebook + CFU Tracker *(partial)*
CFU entry ✅. CSV export ✅. **Not shipped:** standard picker in gradebook, trend view, absent alerts, makeup tracking.

### Post-Roadmap Features (Shipped)
- **Voice Command System** — universal voice agent, orb push-to-talk, board voice, mic priority semaphore, voice lock with pitch analysis
- **Board Surface** (`/board`) — projected classroom display with portal, groups, pulse, resource viewer panels
- **Pacing Calendar** (`/pacing`) — YAAG 2025–2026, daily lesson assignment, blocked days
- **Lesson Resource Catalog** (`/resources`) — per-lesson links, voice-openable, CSV import/export
- **Schedule System** — daily blocks + doc links, overlay, ICS parsing, voice trigger
- **Parent Intervention Loop** — cross-session pattern detection, `intervention_flags`, parent report tokens
- **Parent Report** (`/report/[token]`) — public tokenized report with visual tiles, IXL skill map
- **IXL Skill Map** (`src/data/ixl-skill-map.ts`) — FL BEST standard → IXL skill recommendations
- **Waveform Walkie-Talkie** — teacher mic amplitude → student waveform display (noise SSE channel)
- **DI Sessions** — differentiated instruction group sessions with voice routing
- **TTS** (`/api/tts`) — edge-TTS narration for coach content
- **Manim Animation** (`/api/coach/animate`) — math animation rendering
- **Organizations + Subscriptions** — multi-org support, entitlement gates
- **Parent Comms Panel** (`/parent-comms`) — contacts management, intervention history, message drafting

---

## Technology Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router |
| UI | React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui (radix-ui) |
| Auth (teacher) | Neon Auth (`@neondatabase/auth`) |
| Auth (student) | Signed cookie, HMAC-SHA256, Node crypto |
| Database | Neon serverless + Drizzle ORM |
| Real-time | SSE via Next.js ReadableStream |
| AI | `@anthropic-ai/sdk` — Claude Haiku (`claude-haiku-4-5-20251001`) |
| Speech (input) | Web Speech API (browser-native) |
| Speech (output) | Edge-TTS via `/api/tts` |
| SMS | AWS SNS (`@aws-sdk/client-sns`) |
| Drag-and-drop | `@dnd-kit` |
| TypeScript | Strict mode |
| Linting | Biome |
| Testing | Vitest + Testing Library |
| Icons | lucide-react |
| Toasts | sonner |

---

## Rate Limiters (in-memory, per IP)

| Limiter | Rate | Used by |
|---|---|---|
| `coachRateLimiter` | 10/min | Instructional coach |
| `behaviorCoachLimiter` | 20/min | Behavior coach chat |
| `sessionRateLimiter` | 30/min | Class/session management |
| `joinRateLimiter` | 20/min | Student join |
| `smsRateLimiter` | 10/min | AWS SNS SMS sends |
| `ambientScanLimiter` | 300/min | Waveform amplitude (5/sec per teacher) |
| `correctionRateLimiter` | 5/min | Student "I'm Lost" |
| `animateLimiter` | 12/min | Manim render |
| `diRateLimiter` | 30/min | DI session CRUD |
| `ttsRateLimiter` | 30/min | Edge-TTS synthesis |
| `voiceAgentLimiter` | 20/min | Universal voice agent |
| `scheduleExtractLimiter` | 5/min | ICS/Vision schedule extract |
| `remindersRateLimiter` | 20/min | Voice reminders |

---

## Security & Privacy

### Teacher Auth
- All `/coach`, `/classes`, `/sessions`, `/settings`, `/gradebook`, `/store`, `/pacing`, `/resources`, `/parent-comms` routes protected by Neon Auth middleware
- `auth.getSession()` called at start of every API handler

### Student Auth
- Signed cookie `student_session` = HMAC-SHA256(`{ sessionId, rosterId }`, NEON_AUTH_COOKIE_SECRET)
- No Neon Auth account, no email, no password
- Cookie expires when session ends

### Parent Report
- Tokenized URL (`/report/[token]`) — no login required
- Token scoped to a single student + class, with configurable expiry
- No student PII in URL — token maps to student in DB server-side

### Student Data Privacy
- Roster stores: student ID (school-assigned) + first initial + last initial only
- AI calls never include student names — student ID only in API context
- Drawing images sent to Claude Vision but NOT stored — only analysis result persisted
- Parent notifications are teacher-generated text; SMS sent via AWS SNS

---

## Environment Variables

```bash
DATABASE_URL=               # Neon Postgres connection string
NEON_AUTH_BASE_URL=         # Neon Auth endpoint
NEON_AUTH_COOKIE_SECRET=    # Cookie signing secret (also used for student tokens)
ANTHROPIC_API_KEY=          # Required for all AI features
AWS_REGION=                 # AWS region for SNS SMS
AWS_ACCESS_KEY_ID=          # AWS credentials
AWS_SECRET_ACCESS_KEY=      # AWS credentials
AWS_SNS_FROM_NUMBER=        # E.164 phone number for outbound SMS
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | All database tables and relations |
| `src/lib/ai/coach.ts` | Instructional coach system prompt + CoachResponse type |
| `src/lib/rate-limit.ts` | All rate limiter instances |
| `src/middleware.ts` | Protected route list |
| `src/data/fl-best-standards.ts` | FL BEST Math corpus (108 benchmarks, Gr 3–5) |
| `src/data/yaag-2025-2026.ts` | District pacing guide data |
| `src/data/ixl-skill-map.ts` | FL BEST standard → IXL skill recommendations |
| `src/types/index.ts` | Shared TypeScript types |
| `src/lib/pacing.ts` | `getTodayPacing()` and pacing calendar logic |
| `src/lib/voice-profile.ts` | Voice lock pitch analysis |
| `src/lib/voice/registry.ts` | Voice surface registry for agent context |
| `src/hooks/use-mic-manager.ts` | Mic slot priority semaphore |
