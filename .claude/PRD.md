# Product Requirements Document
## UnGhettoMyLife — AI Instructional Coach

**Last updated:** 2026-02-25
**Status:** Phase 1 shipped — link-in-bio builder removed, coach-only app

---

## Executive Summary

UnGhettoMyLife is a mobile-first AI assistant for 5th grade Florida math teachers. It solves a specific, high-stakes classroom problem: when a student is stuck during practice time, the teacher needs to know exactly what prerequisite concept is missing and exactly what to say and do — in 30 seconds, without leaving the student.

The app works in two modes. In Lecture Mode, the teacher speaks their lesson aloud and the app transcribes it in real time, building a rolling context buffer. In Coach Mode, the teacher describes a student's confusion and the AI — grounded in both today's lesson and the FL BEST Math prerequisite chain — returns a precise, teacher-executable remediation plan with a script, a gap analysis, a sketch prompt, and a 30-second hands-on activity.

The MVP is fully ephemeral: no student data is ever stored. The lesson transcript lives only in React state. Privacy is structural, not policy.

---

## Mission

**Help Florida teachers meet every student where they are, in the moment it matters.**

### Core Principles

1. **Grounded, not generic** — Every response references what was actually taught today, not a generic scaffold.
2. **30-second executable** — Suggestions must be actionable with no prep, no materials, no delay.
3. **Privacy by architecture** — No student PII is ever transmitted or stored. Transcript lives in memory only.
4. **Standards-anchored** — All gap analysis traces to specific FL BEST Math prerequisite codes (Gr 3–5).
5. **Mobile-first** — Teacher is moving. UI must work one-handed on a phone screen.

---

## Target Users

### Primary: 5th Grade Florida Math Teachers
- Teaching in FL public schools under FL BEST Math standards
- Moving around the room during practice time, phone in hand
- Need instant, specific guidance — not a search tool or a lesson plan generator
- Comfortable with basic smartphone apps; not necessarily tech-savvy

### Key Pain Points
- Generic "scaffold" suggestions don't connect to what was just taught
- Identifying the right prerequisite gap takes expertise and time they don't have mid-class
- Writing the exact right words to say while stressed is cognitively expensive

---

## MVP Scope

### In Scope ✅

**Core Functionality**
- ✅ Lecture Mode: continuous Web Speech API transcription, rolling 2,500-word / 15-min buffer
- ✅ Coach Mode: student query input (text + mic), AI response with Script / Gap / Draw / Go! tabs
- ✅ AI grounded in FL BEST Math standards corpus (108 benchmarks, Gr 3–5, with prereq chains)
- ✅ Copy button on each response tab
- ✅ Mode toggle with session storage persistence

**Technical**
- ✅ `POST /api/coach` — authenticated, rate-limited (10 req/min), returns CoachResponse JSON
- ✅ Claude Haiku model (`claude-haiku-4-5-20251001`), max 700 tokens, <3s target latency
- ✅ Neon Auth session protection on `/coach` route
- ✅ TypeScript strict mode, zero type errors

**Privacy**
- ✅ Transcript never written to DB, localStorage, or any log
- ✅ No student name or PII in any API payload
- ✅ Buffer clears on new session or tab close

### Out of Scope ❌

- ❌ Saving past coaching sessions
- ❌ Multi-student tracking or class roster
- ❌ Standards search / browse UI
- ❌ Push notifications or alerts
- ❌ Offline support
- ❌ DB schema changes for MVP
- ❌ Analytics on coach usage

---

## User Stories

1. **As a teacher mid-lesson**, I want to tap Start Listening so the app captures my lesson context automatically, without me having to type anything.

   *Example: Teacher starts Lecture Mode before introducing fraction multiplication. App transcribes "we're finding a part of a part" — that phrase becomes available to ground AI responses.*

2. **As a teacher during practice**, I want to describe a student's confusion and get exact words to say back to them, so I'm not fumbling for language under pressure.

   *Example: "Student says the answer to 2/3 × 3/4 should be a whole number" → Coach returns: "Tell them: remember the 'part of a part' example — the answer must be smaller than 2/3."*

3. **As a teacher**, I want to see which FL BEST prerequisite standard the student is missing, so I know whether this needs a quick fix now or a pull-out session later.

   *Example: Gap tab shows `MA.4.FR.2.4` (Gr 4) with explanation of why that gap causes the current confusion.*

4. **As a teacher**, I want a sketch I can draw in 10 seconds on the whiteboard that makes the connection visual.

   *Example: Draw tab: "Draw a pizza sliced into 4 parts. Shade 3. Now take half of those 3 shaded slices — that's ½ × ¾."*

5. **As a teacher**, I want a hands-on activity I can start immediately using things on the student's desk.

   *Example: Go! tab: "Have the student fold a piece of paper in thirds, shade 2/3, then fold that in half. Count the shaded sections out of total — that's their answer."*

6. **As a teacher**, I want to copy the script with one tap so I can read it aloud without fumbling.

7. **As a teacher concerned about privacy**, I want to know that nothing about my students is being stored anywhere.

   *Technical story: No DB writes for transcripts. No student data in logs. Transcript clears on reload.*

---

## Core Architecture & Patterns

### High-Level Architecture

```
Browser (React state only)
  ├── Lecture Mode: Web Speech API → rolling transcript buffer (2,500 words max)
  └── Coach Mode: transcript + query → POST /api/coach → Claude API → render response

Server (Next.js API Route)
  └── /api/coach: auth check → rate limit → validate → call Claude → return JSON

AI Layer
  └── Claude Haiku: system prompt (FL BEST corpus + instructions) + user message (transcript + query) → CoachResponse JSON
```

### Key Design Patterns

- **Ephemeral state**: Transcript lives only in `useRef` + `useState`. Never touches any persistence layer.
- **Rolling buffer**: `trimToWordLimit()` keeps only the last 2,500 words — limits token cost while preserving recency.
- **Strict JSON AI output**: System prompt demands exact JSON schema. Response validated before returning to client.
- **Auth pattern**: `auth.getSession()` from `@neondatabase/auth` — same as all other API routes.

### Directory Structure

```
src/
  data/fl-best-standards.ts         — 108 FL BEST benchmarks + prereq chains + formatStandardsForPrompt()
  lib/ai/coach.ts                   — Anthropic SDK, system prompt, getScaffold()
  app/api/coach/route.ts            — POST handler
  hooks/use-lecture-transcript.ts   — continuous STT hook
  hooks/use-speech-query.ts         — single-utterance STT hook
  components/coach/
    mode-toggle.tsx
    lecture-panel.tsx
    query-input.tsx
    scaffold-card.tsx
  app/(dashboard)/coach/page.tsx
  types/speech-recognition.d.ts     — Web Speech API type declarations
```

---

## Features

### Lecture Mode
- Continuous `SpeechRecognition` with `continuous = true`, `interimResults = true`
- Auto-restarts on browser silence timeout
- Live transcript display with word count (X / 2,500)
- Start / Stop / Clear controls
- Pulsing red indicator while listening

### Coach Mode
- Lesson context status bar (green if transcript captured, grey if not, with "Capture lesson →" CTA)
- Textarea for student query with mic button overlay
- Single-utterance mic (`continuous = false`, stops on 2s silence)
- Ask Coach button (disabled when empty or loading)
- Cmd+Enter keyboard shortcut to submit
- Loading skeleton while AI responds
- ScaffoldCard with 4 tabs: Script / Gap / Draw / Go!
- Copy button per tab with "Copied!" confirmation

### ScaffoldCard Tabs

| Tab | Content |
|-----|---------|
| **Script** | ≤30-word phrase to say, displayed in quotes |
| **Gap** | FL BEST code badge + grade + standard description + explanation |
| **Draw** | Whiteboard sketch description |
| **Go!** | 30-second hands-on intervention |

---

## Technology Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js App Router | 15.5.12 |
| UI | React | 19.1.0 |
| Styling | Tailwind CSS v4 + shadcn/ui | 4.x |
| Auth | Neon Auth (`@neondatabase/auth`) | 0.1.0-beta.21 |
| Database | Neon serverless + Drizzle ORM | — |
| AI | `@anthropic-ai/sdk` | ^0.39.0 |
| AI Model | Claude Haiku | `claude-haiku-4-5-20251001` |
| Speech | Web Speech API | Browser-native |
| TypeScript | Strict mode | ^5 |
| Linting | Biome | 2.2.0 |

---

## Security & Configuration

### Authentication
- All `/coach` routes protected by Neon Auth session cookie middleware
- `auth.getSession()` called at start of every API handler
- Unauthorized → 401

### Rate Limiting
- `coachRateLimiter`: 10 requests/min per IP
- In-memory store (resets on server restart)
- Returns 429 with `{ error: "Too many requests" }`

### Input Validation
- `studentQuery`: required, max 2,000 chars
- `lessonTranscript`: required string, max 20,000 chars
- Both validated before calling Claude API

### Environment Variables
```
ANTHROPIC_API_KEY=sk-ant-...         # Required for coach feature
DATABASE_URL=...                      # Neon DB
NEON_AUTH_BASE_URL=...               # Neon Auth
NEON_AUTH_COOKIE_SECRET=...          # Cookie signing
```

### Privacy Architecture
- Transcript: React state only, never sent to server except as part of a coach request
- Coach request: contains lesson content and student confusion — no names, no IDs
- No logging of request bodies
- No DB writes for any coach data

---

## API Specification

### `POST /api/coach`

**Auth:** Required (Neon Auth session cookie)
**Rate limit:** 10 req/min per IP

**Request:**
```json
{
  "lessonTranscript": "string (max 20,000 chars)",
  "studentQuery": "string (required, max 2,000 chars)"
}
```

**Response 200:**
```json
{
  "script": "Tell them: remember the part-of-a-part example — the answer must be smaller than 2/3.",
  "missingConcept": {
    "code": "MA.4.FR.2.4",
    "grade": 4,
    "description": "Extend previous understanding of multiplication to multiply a fraction by a whole number or a whole number by a fraction.",
    "explanation": "The student lacks the foundational understanding that multiplying by a fraction makes a quantity smaller. Without MA.4.FR.2.4, they default to whole-number multiplication intuition where multiplication always increases."
  },
  "visual": "Draw a number line from 0 to 1. Mark 2/3. Now take half of that distance — shade it. The shaded part is smaller than 2/3, which is the answer.",
  "microIntervention": "Have the student hold up 3 fingers. Ask: what is half of 3 fingers? (1.5). So half of something is always smaller. Now apply that to fractions."
}
```

**Error responses:**
- `400` — missing/invalid fields
- `401` — not authenticated
- `429` — rate limit exceeded
- `500` — AI service error

---

## Success Criteria

### MVP Definition
A teacher can capture a live math lesson, describe a student's confusion, and receive a complete remediation plan in under 3 seconds — grounded in what was actually taught today.

### Functional Requirements
- ✅ Lecture Mode captures speech continuously with auto-restart
- ✅ Rolling 2,500-word buffer maintained in memory
- ✅ Coach Mode sends transcript + query to Claude Haiku
- ✅ All 4 response tabs populated on every request
- ✅ Script explicitly references today's lesson content
- ✅ Gap tab shows valid FL BEST standard code
- ✅ Copy button works on all tabs
- ✅ Mic input works for student query
- ✅ No student PII in any API payload
- ✅ `npx tsc --noEmit` passes clean
- ✅ Protected behind Neon Auth

### Quality Indicators
- AI response latency < 3 seconds (Haiku model, 700 max tokens)
- Zero TypeScript errors in strict mode
- Mobile usable one-handed on iPhone SE viewport

---

## Implementation Phases

### Phase 1 — Core Coach (SHIPPED ✅)
**Goal:** Working end-to-end coach on `/coach` route

**Deliverables:**
- ✅ FL BEST standards data file (108 benchmarks, Gr 3–5)
- ✅ `getScaffold()` with Claude Haiku + full standards corpus in system prompt
- ✅ `POST /api/coach` route with auth + rate limiting
- ✅ `useLectureTranscript` hook (continuous STT, rolling buffer)
- ✅ `useSpeechQuery` hook (single-utterance STT)
- ✅ 4 coach components + main page
- ✅ Middleware protection for `/coach`
- ✅ Nav link in dashboard layout

**Validation:** Teacher can speak a lesson, describe student confusion, receive 4-tab response in <3s.

---

### Phase 2 — Polish & Reliability (Next)
**Goal:** Production-ready for classroom use

**Deliverables:**
- [ ] Error boundary + graceful degradation when Speech API unavailable
- [ ] Loading/error toasts via Sonner
- [ ] Transcript pause/resume (currently stop clears recognition instance)
- [ ] Response history within session (last 3 queries, in-memory only)
- [ ] Haptic feedback on mobile for mic button state changes
- [ ] Rate limit UI feedback (show remaining requests)

**Validation:** No crashes observed in 30-minute classroom simulation.

---

### Phase 3 — Standards Intelligence (Future)
**Goal:** Deeper FL BEST integration

**Deliverables:**
- [ ] Auto-detect likely standard from lesson transcript (show in Lecture Mode)
- [ ] Prerequisite chain visualizer — tap any standard code to see full chain
- [ ] "Quick pick" standard selector so teacher can confirm what they taught
- [ ] Standard pinning — pin today's standard so Coach Mode always references it

---

### Phase 4 — Teacher Workflow (Future)
**Goal:** Fit into real classroom routines

**Deliverables:**
- [ ] Session summary — end-of-class summary of confusion patterns (no student names, aggregate only)
- [ ] Saved interventions — teacher can star a response for reuse
- [ ] Shareable coach cards — export a response as a PDF card for the student's folder
- [ ] Grade level configuration (currently hardcoded to Gr 5)

---

## Future Considerations

- **Other grade bands:** FL BEST covers K–8. Extending to Gr 6–8 is a config change + data file expansion.
- **Other subjects:** ELA, Science scaffolding follow the same architecture pattern.
- **School/district deployment:** Multi-tenant auth, school roster import, admin dashboard.
- **Offline mode:** Cache last N responses in IndexedDB for use in no-WiFi classrooms.
- **Student-facing mode:** Simplified UI where student can ask the question themselves (privacy controls remain).

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Web Speech API not available (non-Chrome browser, HTTP) | Medium | Graceful fallback to text-only input; show "use Chrome" message |
| Claude API latency > 3s during class | Low | Haiku model, 700 max tokens, streaming fallback in Phase 2 |
| Teacher forgets to start Lecture Mode | High | Coach Mode shows clear "No lesson captured" CTA; AI still works without transcript |
| API key exposure in client | None | Key is server-only, never in client bundle |
| Student confusion described with PII | Low | System prompt instructs Claude to ignore/strip names; no server-side logging of request bodies |

---

## Appendix

### Strategic Decision
The app originally scaffolded as a link-in-bio page builder. That feature has been removed. UnGhettoMyLife is now a single-purpose AI Instructional Coach for Florida math teachers.

### Related Files
- `.claude/PRD.md` — this document
- `src/data/fl-best-standards.ts` — authoritative FL BEST corpus
- `src/lib/ai/coach.ts` — AI system prompt

### FL BEST Standards Source
Florida Department of Education — [B.E.S.T. Standards for Mathematics](https://www.fldoe.org/academics/standards/subject-areas/math-science/mathematics/)

### Key Dependencies
- `@anthropic-ai/sdk` ^0.39.0
- `@neondatabase/auth` ^0.1.0-beta.21
- Web Speech API (Chrome 33+, Edge 79+, Safari 14.1+)
