# Product Requirements Document
## UnGhettoMyLife — Classroom Intelligence Platform

**Last updated:** 2026-02-28
**Status:** Phase 6 (Lecture Visualizer + Settings) shipped — Phases 1–6 of Classroom Intelligence System complete

---

## Executive Summary

UnGhettoMyLife is a mobile-first classroom intelligence platform for 5th grade Florida math teachers. It combines an AI Instructional Coach, a real-time student comprehension system, an interactive adaptive learning engine, and a classroom behavior/economy management system — all built for the specific needs of FL BEST Math instruction.

The platform operates across three surfaces:
- **Teacher device** — AI coach, live class dashboard, behavior management, RAM Buck economy
- **Student device** — interactive manipulatives, comprehension signal, mastery loop, reward store
- **Post-class** — gradebook, differentiation groups, behavior profiles, parent communications

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

---

## Architecture Overview

```
Teacher App (authenticated, /dashboard)
  ├── AI Instructional Coach (/coach)
  ├── Class Manager (/classes)
  │   ├── Multiple periods: AM Math, PM Math, Period 3...
  │   ├── Roster per class (student ID + initials)
  │   └── Groups: Dogs / Cats / Birds / Bears (max 6 per group)
  ├── Live Session Dashboard (/classes/[id]/session)
  │   ├── Comprehension pulse (aggregate only, real-time SSE)
  │   ├── AI behavior coach (persistent all-day voice assistant)
  │   └── RAM Buck awards/deductions (voice + touch)
  ├── Post-Class Report (/classes/[id]/report)
  │   ├── Comprehension timeline
  │   ├── Student mastery grid
  │   └── Differentiation groups + AI reteach recommendations
  ├── Gradebook (/gradebook) — CFU tracker, absent alerts, CSV export
  └── Settings (/settings) — mastery threshold, alert %, store schedule

Student App (no auth, /student)
  ├── Join screen — 6-char code + pick name from roster
  ├── Active session — comprehension signal + pushed manipulatives
  ├── Mastery loop — interactive manipulative → check questions → earn RAM Bucks
  └── RAM Buck store — view balance, browse menu, request purchases

Data Layer (Neon Postgres + Drizzle ORM)
  ├── Teacher: classes, roster_entries, class_sessions, teacher_settings
  ├── Economy: ram_buck_accounts, ram_buck_transactions, ram_buck_fee_schedule
  ├── Behavior: behavior_incidents, behavior_profiles, parent_notifications
  ├── Learning: comprehension_signals, manipulative_pushes, mastery_records
  └── Gradebook: cfu_entries, drawing_analyses
```

---

## Real-Time Transport

**Server-Sent Events (SSE) + DB polling every 5 seconds** — no new packages. Next.js 15 App Router handles SSE natively via `ReadableStream`. Student → server via normal `POST`; server → teacher/student via SSE.

---

## Student Identity Model

- Teacher creates roster per class: **student ID + first initial + last initial** (e.g. `10293847 — J.M.`)
- Students join via 6-char uppercase alphanumeric join code (no 0/O/I/1)
- Student auth = signed cookie `student_session` containing `{ sessionId, rosterId }` (HMAC-SHA256, no new package)
- No student Neon Auth accounts
- No student PII beyond initials + school-assigned ID
- Student balances, mastery, and behavior scoped per class (AM class Jordan ≠ PM class Jordan)

---

## Class / Session Model

| Concept | Definition | Example |
|---|---|---|
| **Class** | Recurring group of students, exists all semester | "AM Math", "PM Math", "Period 3" |
| **Session** | Single daily meeting of a class | "AM Math — Feb 28" |
| **Roster** | Belongs to the class, not the session | 23 students in AM |
| **Groups** | Belong to the class, persist all semester | AM Dogs/Cats/Birds/Bears |
| **RAM Buck balance** | Per student per class, accumulates across sessions | Jordan in AM has 340 bucks |

---

## RAM Buck Economy

- **Currency:** RAM Bucks (school mascot = Ram)
- **Earning — Academic (automatic):**
  - Check for understanding correct: configurable default 5 bucks
  - Mastery achieved on a standard: configurable default 25 bucks
  - iReady goal met (teacher voice confirmation): configurable default 20 bucks
  - Full day no incidents: configurable default 10 bucks
  - Group collective goal hit: configurable default 8 bucks each
- **Earning — Behavior (teacher-narrated):**
  - Teacher speaks to AI agent throughout the day: "Give Marcus 10 bucks for helping clean up"
  - Teacher touch-awards: tap student card → `+` → enter amount
- **Deductions:** Per RAM Buck Fee Schedule (auto-fires when consequence logged)
- **Balance:** Carries over indefinitely + teacher can reset at any time (daily/weekly/monthly/quarterly/manual)
- **Store window:** Teacher configures when students can spend (daily/weekly/monthly/quarterly/manual open)
- **Group account:** Each group has a shared account alongside individual accounts
- **Student visibility:** Full (balance, group balance, menu, affordability) — teacher can toggle off

### Default RAM Buck Fee Schedule (teacher configures)

| Consequence Step | Label | Default Deduction |
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

**Structure:** Consequence escalation — each incident moves student one step further.
**Reset:** At teacher-configured interval (daily/weekly/monthly/quarterly/manual).

- Steps 5–8 auto-generate a parent notification (ClassDojo-formatted copy/paste message)
- All incidents logged in student behavior profile — **teacher-only, exportable**
- AI behavior coach is **child-psychology-aware** in all recommendations
- Groups are collectively gated from specials (PE, games, celebrations) based on group behavior level

---

## Groups

- Four groups per class: **Dogs, Cats, Birds, Bears** (teacher can rename)
- Max 6 students per group
- Auto-assigned by academic performance level on roster import
- Teacher can manually drag/reassign after auto-assign
- CSV and Excel (.xlsx) upload supported for roster import
- Groups held collectively accountable for special privileges

---

## Privilege Menu

Default items (teacher configures):

| Privilege | Default Cost | Duration |
|---|---|---|
| Brain Break | 15 bucks | 5–15 min |
| Library Time | 30 bucks | 20 min |
| Outdoor Recess | 25 bucks | 15 min |
| Computer Time | 20 bucks | 20 min |
| Phone Time | 40 bucks | 10 min |
| Class Game (Heads Up 7-Up etc.) | 20 bucks | 15 min |

- Fixed baseline menu + teacher daily specials
- Students request → teacher approves
- Students at Step 5+ (Call Home or higher) automatically excluded — teacher can override

---

## AI Systems

### Instructional Coach (existing)
- Model: `claude-haiku-4-5-20251001`, max 2000 tokens
- Grounded in FL BEST Math standards corpus (108 benchmarks, Gr 3–5)
- Returns: studentInterpretation, missingConcept, script, visual, microIntervention, guidingQuestions, manipulative, gradePrereq, below
- Privacy: transcript ephemeral (React state only, never persisted)

### Behavior Coach (Phase 11)
- Persistent all-day classroom assistant — teacher narrates naturally throughout the day
- Handles: RAM buck awards/deductions, iReady logging, behavior incidents, advice requests
- Proactive daily alerts: pattern detection, flagged students
- Child-psychology-aware in all recommendations
- AI notes saved to student behavior profile — teacher-only, exportable
- Parent messages formatted for ClassDojo copy/paste

### Drawing Analyzer (Phase 5)
- Claude Vision analyzes student canvas submission
- Identifies where mental model breaks against current FL BEST standard
- Feedback shown to student; breakpoint logged to teacher dashboard
- Image NOT stored — only analysis result persisted

### Lecture Visualizer (Phase 6)
- Debounced AI call every 30 seconds during lecture mode
- Generates quick visual spec for current concept being discussed
- Renders inline, collapsible

---

## Database Schema

### Existing Tables
- `profiles` — teacher profiles
- `link_items` — link-in-bio items (legacy)
- `click_events` — click analytics (legacy)

### Phase 1 (Session Foundation)
- `teacher_settings` — mastery threshold, alert %, store schedule, alias mode
- `classes` — recurring class periods (teacherId, label, periodTime)
- `roster_entries` — studentId + initials per class
- `class_sessions` — daily meetings with join code (classId FK)

### Phase 2 (Comprehension Pulse)
- `comprehension_signals` — 3-state signal log per student per session
- `manipulative_pushes` — log of auto/teacher-triggered manipulative pushes

### Phase 4 (Mastery Loop)
- `mastery_records` — per student per standard: status, consecutiveCorrect, lastModality
- `check_question_responses` — individual mastery check answers

### Phase 5 (Drawing + Dashboard)
- `drawing_analyses` — Claude Vision results (no image stored)

### Phase 7 (Groups)
- `student_groups` — Dogs/Cats/Birds/Bears per class
- `group_memberships` — student → group assignment

### Phase 8 (RAM Buck Economy)
- `ram_buck_accounts` — individual balance per student per class
- `ram_buck_transactions` — full ledger (academic|behavior-positive|behavior-fine|purchase...)
- `ram_buck_fee_schedule` — infraction → deduction amount per teacher
- `group_accounts` — shared group balance
- `group_transactions` — group ledger

### Phase 9 (Behavior Ladder)
- `behavior_incidents` — incident log per student per session
- `behavior_profiles` — current step, history, teacher notes
- `parent_notifications` — generated messages, sent status

### Phase 10 (Privilege Store)
- `privilege_items` — menu items per teacher
- `privilege_purchases` — request/approval log
- `teacher_store_settings` — store open schedule

### Phase 12 (Gradebook)
- `cfu_entries` — daily check-for-understanding scores per student per standard
- `cfu_alerts` — missing entry + makeup due alerts

---

## 12-Phase Roadmap

### ✅ Phase 0 — AI Instructional Coach (Shipped)
Core coach with FL BEST grounding, 4 remediation approaches, visual manipulatives, progressive deepening, interactive accordion cards, grade-below scaffolds.

### ✅ Phase 1 — Session Foundation (Shipped)
**Goal:** Teacher creates classes with rosters. Students join on their device with a join code.

Deliverables:
- [ ] `teacher_settings`, `classes`, `roster_entries`, `class_sessions` DB tables
- [ ] `POST/GET /api/classes` — create and list classes
- [ ] `GET/PUT/DELETE /api/classes/[id]` — manage single class
- [ ] `POST /api/classes/[id]/roster` — add student (ID + initials)
- [ ] `DELETE /api/classes/[id]/roster/[rosterId]` — remove student
- [ ] `POST /api/sessions` — start a session, generate join code
- [ ] `PUT /api/sessions/[id]/end` — end session
- [ ] `POST /api/sessions/join` — student joins by code, receives signed cookie
- [ ] `GET/PUT /api/teacher-settings` — teacher preferences
- [ ] `/classes` teacher page — list + create classes
- [ ] `/classes/[id]` teacher page — roster manager + session start
- [ ] `/student` join screen — enter code + pick name (colorful, child-appropriate)
- [ ] `/student/[sessionId]` — waiting screen
- [ ] Student signed cookie auth (HMAC-SHA256, no new package)
- [ ] Updated dashboard nav

### ✅ Phase 2 — Comprehension Pulse (Shipped)
Real-time 3-state student signal (Got It / Almost / Lost). Teacher sees aggregate only (never names) during class via SSE. 60s "stuck" detection flags students in teacher view. `/classes/[id]/session` live dashboard. Auto-push manipulative content pending Phase 3.

### ✅ Phase 3 — Interactive Manipulatives (Student-Side, Shipped)
Tap-to-build fraction bars, area model, number line on student devices. Teacher push via SSE — 3 presets (Fraction Bar, Area Model, Number Line). `manipulative_pushes` DB table. Student SSE feed (`/api/sessions/[id]/student-feed`). Manipulative appears as overlay card on student screen with dismiss. Teacher push panel in live session view.

### ✅ Phase 4 — Mastery Loop (Shipped)
After manipulative: 1–3 check questions. Wrong → switch modality or drop to grade-below. Right → harder variant. Mastery = N consecutive correct (teacher-configured, default 3).

### ✅ Phase 5 — Drawing Analysis + Teacher Dashboard (Shipped)
Claude Vision analyzes student canvas. Post-class report: comprehension timeline (donut chart), student mastery grid, AI-generated differentiation groups (Extension/Practice/Reteach) with reteach recommendations. Drawing prompt offered after quiz completion. `/classes/[id]/report` page with `?session=ID` param.

### ✅ Phase 6 — Lecture Visualization + Polish (Shipped)
Lecture Visualizer: debounced AI call every 30s while listening → concept name + text/ASCII whiteboard visual + 3 key points, collapsible violet card below transcript. Teacher Settings UI at `/settings`: mastery threshold stepper, confusion alert % slider, alias mode toggle, RAM Buck store schedule picker + open toggle.

### Phase 7 — Student Groups + Roster Import
CSV/Excel upload. Auto-group by performance level. Dogs/Cats/Birds/Bears (max 6). Teacher drag-to-adjust. Group board kanban UI.

### Phase 8 — RAM Buck Economy
Individual + group accounts. Academic auto-earning. Teacher narrates to AI agent all day (voice + touch). Fee schedule auto-deducts on consequence. Configurable store window.

### Phase 9 — Behavior Ladder + Consequence Tracking
8-step consequence escalation. Auto RAM buck deduction per fee schedule. Auto parent message (ClassDojo-formatted) at Step 5+. Student behavior profiles (teacher-only, exportable).

### Phase 10 — Privilege Menu + Store
Fixed baseline + daily teacher specials. Teacher-scheduled store window. Student request → teacher approve. Behavior gate blocks Step 5+ students.

### Phase 11 — AI Behavior Coach
Persistent daily classroom assistant. Teacher narrates naturally all day. Proactive pattern alerts. Child-psychology-aware advice. Voice logging for iReady. Parent message generation.

### Phase 12 — Gradebook + CFU Tracker
Daily check-for-understanding entry (standard + lesson + scores). Absent student documentation + makeup alerts. Teacher alerted if CFU not entered by end of day. Individual grid + class aggregate view. CSV export.

---

## Technology Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js App Router | 15.5.12 |
| UI | React | 19.1.0 |
| Styling | Tailwind CSS v4 + shadcn/ui | 4.x |
| Auth (teacher) | Neon Auth (`@neondatabase/auth`) | 0.1.0-beta.21 |
| Auth (student) | Signed cookie, HMAC-SHA256, Node crypto | built-in |
| Database | Neon serverless + Drizzle ORM | — |
| Real-time | SSE via Next.js ReadableStream | built-in |
| AI | `@anthropic-ai/sdk` | ^0.39.0 |
| AI Model | Claude Haiku | `claude-haiku-4-5-20251001` |
| Speech | Web Speech API | Browser-native |
| TypeScript | Strict mode | ^5 |
| Linting | Biome | 2.2.0 |

---

## Security & Privacy

### Teacher Auth
- All `/coach`, `/classes`, `/sessions`, `/settings`, `/gradebook` routes protected by Neon Auth
- `auth.getSession()` called at start of every API handler

### Student Auth
- Signed cookie `student_session` = HMAC-SHA256(`{ sessionId, rosterId }`, NEON_AUTH_COOKIE_SECRET)
- No Neon Auth account, no email, no password
- Cookie expires when session ends

### Student Data Privacy
- Roster stores: student ID (school-assigned) + first initial + last initial only
- No full names, no email, no photos stored
- AI calls never include student names — student ID only in API context
- Drawing images sent to Claude Vision but NOT stored — only analysis result persisted
- Parent notifications are teacher-exported text — no automated outbound messaging

### Rate Limiting (in-memory, per IP)
- `coachRateLimiter`: 10 req/min
- `sessionRateLimiter`: 30 req/min
- `joinRateLimiter`: 20 req/min

---

## Environment Variables

```bash
DATABASE_URL=             # Neon Postgres
NEON_AUTH_BASE_URL=       # Neon Auth
NEON_AUTH_COOKIE_SECRET=  # Cookie signing (also used for student tokens)
ANTHROPIC_API_KEY=        # Required for all AI features
```

---

## Related Files

- `.claude/PRD.md` — this document
- `src/data/fl-best-standards.ts` — authoritative FL BEST corpus
- `src/lib/ai/coach.ts` — AI system prompt + CoachResponse type
- `src/lib/db/schema.ts` — all database tables
