# Lean tutoring scope and bloat audit

Status: the user confirmed this is an adaptation of Class Pulse. The broader audit below remains proposed scope. Student booking is now implemented as an additive setting and Calendly dialog on the existing quiz/session screen; the database migration and tutor configuration are required before use. Existing classroom features and settings remain contracts, not removal candidates.

## Product boundary

Help a tutor run a session using their preferred tools, record what the learner demonstrated, and give the parent one useful next step. Keep the first surface to **Learners, Sessions, and Progress**. A session contains the meeting link, activity links, a short evidence record, and a parent update preview.

Platform agnostic means a tutor can choose Blooket, Wayground, Khan Academy, another service, or an offline activity without the product requiring a particular provider. It does not imply automatic score imports, shared logins, or equivalent scoring across services. Provider capabilities have not been researched or verified in this audit.

User agnostic means supporting tutor-defined learners, skills, subjects, and goals without hardcoded school mascots, Florida standards, or grade-five pacing. Tutor, learner, and parent still need distinct permissions. Do not erase those distinctions in pursuit of generality.

## Keep, reuse carefully, and defer

| Capability | Lean tutoring decision | Existing implementation / constraint |
| --- | --- | --- |
| Learner and session records | Reuse ownership and session patterns; decide whether a tutoring workspace needs separate records before changing the class model. | `src/lib/db/schema.ts`: `classes`, `rosterEntries`, `classSessions`; `src/lib/auth/student.ts` |
| Preferred learning tools | Store a provider label and activity URL; support “Other” and offline work. Tutor launches the chosen tool. | `linkItems` in `src/lib/db/schema.ts` is a useful link pattern, but belongs to a profile, not a learner/session. |
| Booking and video | First accept the tutor's booking URL and session meeting URL. Tutor can use their Calendly→Zoom setup; this app initially stores the resulting link. | No Calendly or Zoom integration implementation found in the inspected `src` tree. Existing `scheduleBlocks` describe classroom scheduling, not external booking synchronization. |
| Interactive learning | Let the tutor use their chosen activity during the video call and record a short independent check afterward. | `src/components/coach/manipulatives/student/quiz.tsx` and `src/app/student/[sessionId]/student-session.tsx` may be optional later; a native quiz engine is not required for the first tutoring loop. |
| Parent reinforcement | Reuse report and delivery patterns, after separating reports from classroom intervention assumptions. Require tutor preview before sending. | `src/app/report/[token]/page.tsx`, `src/app/api/report/token/route.ts`, `src/app/api/classes/[id]/parent-message/route.ts`, `src/lib/sms.ts` |
| Progress evidence | Add explicit provenance and assistance level; show a dated skill history. | `masteryRecords` and `src/app/api/sessions/[id]/report/route.ts` supply session evidence patterns, not a provider-neutral mastery model. |
| AI coach | Defer from the required tutoring flow. Optional drafting can follow once evidence capture works. | `src/app/(dashboard)/coach/page.tsx`, `src/lib/ai/coach.ts`; lesson transcripts remain ephemeral. |
| Classroom operations | Omit from a new tutoring surface: projected board, behavior ladder/fines, group economy, store, whole-class pulse, DI competitions, and school pacing. Preserve all current classroom routes and behavior. | `src/app/board/`, `src/app/(dashboard)/store/page.tsx`, `src/lib/ram-bucks.ts`, `src/app/(dashboard)/pacing/page.tsx`, `src/components/coach/` |
| Voice and automation | Do not make them prerequisites for tutoring. Do not globally disable or rewrite them. | `src/lib/ui-prefs.ts`, `src/lib/voice/registry.ts`, `docs/voice-command-matrix.md` |

## “True progress” needs evidence beyond a score

The current mastery POST accepts a student-client `isCorrect` boolean and tracks consecutive correct answers per session and standard. The configured threshold defaults to three; once achieved, the record stays mastered. That is an existing classroom rule to preserve. It is not proof of independent retention or transferable understanding, and must not silently become a universal tutoring mastery claim.

A lean tutoring evidence record should include learner, session/date, tutor-defined skill, source/tool, activity reference, result (including denominator when known), assistance level, a brief observed explanation or misconception, and who recorded or confirmed it. Distinguish tutor observation, manually entered platform result, imported result, and learner/parent self-report. Missing data stays unknown, never zero. Do not average unrelated platform scores into a universal percentage.

Use a simple proposed progression: **Not checked → Practicing with help → Demonstrated independently → Retained on a later check**. Record the criteria and evidence behind each transition. A tutor can mark an independent demonstration after a fresh problem and explanation; retention requires a later check. This is a new tutoring rubric, not a replacement for the configured classroom mastery threshold. Tutor-defined skills may optionally map to curriculum standards.

Two existing report assumptions need explicit adaptation before reuse:

- `src/app/api/report/token/route.ts` creates on-demand reports through intervention flags using the fixed standard `MA.5.NSO.1.1`. A general report must be grounded in the learner's actual evidence and selected time period, not a placeholder standard.
- `src/app/report/[token]/page.tsx` derives a current topic from today's pacing date and offers a Khan search containing “grade 5 math.” Tutoring reports need the actual session skill and tutor-selected practice resource. A generic search link must not be described as a verified activity or synchronized result.

A parent update should show: **what we practiced; what the learner did independently; what still needs help; one five-minute home activity; what we will check next time**. Example: “Compared 3 of 4 fraction pairs without prompts; needed a drawing for unlike denominators. At home, ask which is larger, 1/2 or 2/3, and have them explain with a sketch. We will check a new example next session.” Clearly label this as an example, not learner data. Keep behavior and reward balances out of the learning evidence.

## Coins and incentives

Keep incentives optional and outside the first progress loop. Coins are an extrinsic reward mechanic; adding them does not establish intrinsic motivation. First make growth visible, let the learner choose a goal or activity, and show which strategy helped. Treat the motivation effect as an open product question.

If the user elects to pilot coins, introduce an explicit tutoring control, default off for new tutoring workspaces, with a small non-monetary recognition system tied to a tutor-confirmed milestone. Show why a milestone was earned, prevent duplicate awards, and keep evidence valid when rewards are disabled. Defer shops, purchases, leaderboards, streak pressure, penalties, and pooled group balances.

Do not repurpose the existing economy silently. `src/app/api/sessions/[id]/mastery/route.ts` awards RAM Bucks for correct answers and mastery; `src/lib/ram-bucks.ts` also couples awards/deductions to group coins. `teacherSettings` already has currency branding, reward amounts, reset schedules, and mastery configuration. These behaviors must remain intact for current users.

## Practical implementation phases

1. **Resolve product location, then ship the manual loop.** Choose an additive tutoring workspace or a separate product. Add learner goals, session time and meeting URL, arbitrary activity links, evidence capture, and a previewable parent summary. Keep curriculum mapping optional. Start with an explicit copy/share action; integrate existing SMS only when delivery is needed. Acceptance: a tutor can complete one session with any provider or offline activity and produce an evidence-grounded parent update without AI, coins, or a native quiz.
2. **Make evidence durable and reports trustworthy.** Add skill history across sessions, independent/retention checks, corrections, and a report scoped to selected evidence. Reuse token patterns only after reviewing expiration, recipient scope, and access isolation. Acceptance: unrelated learners cannot access each other's records; expired report access fails; a score alone cannot create a retention claim; missing results remain unknown; correction history is visible to the tutor.
3. **Automate only a demonstrated bottleneck.** Verify official provider support and account requirements before choosing any connector. For booking automation, handle event creation, cancellation, rescheduling, time zones, and duplicate webhook delivery. For results, map learner and skill explicitly, retain source details, and deduplicate imports. Prefer a reviewed manual/CSV import before building multiple live connectors. Acceptance: retries do not create duplicate sessions or evidence, and unsupported providers still work through manual entry.
4. **Pilot optional motivation.** Only after the learning loop is useful, test milestone recognition with a small group. Compare learner engagement and willingness to explain/retry; do not use coin totals as learning outcomes. Acceptance: rewards off still permits the entire session/report flow; repeated milestone events cannot grant duplicate awards; classroom balances/settings remain unchanged.

For implementation in this repository, add focused regression tests whenever settings, voice, auth, or environment-sensitive paths change, as required by `AGENTS.md`. Verify existing classroom mastery thresholds, app/nav/doc-open preferences, queue behavior, and currency behavior remain enforced. No transcript persistence, auth-provider migration, or platform-wide schema rewrite is needed for this scope.

## Deliberate omissions

No universal quiz synchronization, replacement video platform, native scheduling system, all-subject content library, mandatory AI coach, billing system, or reward marketplace in the first release. These are deferred product bets, not deletions from Class Pulse. The smallest useful result is a completed tutor session followed by a clear, supported parent action.

## Implemented first slice: student booking

- Apply `drizzle/0022_student_booking.sql` through the project migration workflow before deploying the new code. It adds a blank-by-default `teacher_settings.student_booking_url`. The additive migration was applied to the production database during the authorized orientation release.
- In Settings → Student booking, paste a Calendly scheduling link and save. Clear it to hide booking. Students get the session owner's link, never another tutor's client-supplied ID. Existing portal pages read the latest setting on reload.
- “Book time with your tutor” opens an in-portal calendar alongside the existing quiz workflow. Closing it preserves quiz state. It also appears on the live session-ended screen. The existing signed student session is still required; this does not introduce a permanent student account or extend cookie lifetime.
- Connect Zoom in Calendly and select Zoom as the event location to include meeting details in Calendly's confirmations. See [Calendly's Zoom instructions](https://calendly.com/help/calendly-zoom).
- The dialog uses [Calendly's supported iframe approach](https://calendly.com/help/how-to-embed-calendly-with-an-iframe), with an explicit new-tab fallback. It does not prefill student records, create local appointments, or infer booking success from opening the calendar. Availability and confirmation remain in Calendly.
- No live Calendly booking was submitted. Provider availability, Zoom setup, and confirmations need a configured tutor event to verify end to end.

## Implemented adaptation: optional grade and measured audio

New classes default to no grade. The existing grade field accepts a short tutor-defined level (for example K, 8, 12, mixed, adult) and existing class grades are preserved. Apply `drizzle/0023_optional_grade.sql` to align the database default; it does not rewrite existing records.

The coach receives the selected class level; its scaffold override supports K–12. General AI instructions and practice questions no longer assume a fifth grader or ten-year-old. Explicit curriculum codes still supply their original context. The optional built-in FL BEST library still covers grades 3–5; its UI now states that limitation. Grade-five pacing and existing prescribed resources remain curriculum-specific tools, not universal support for every grade or subject.

New on-demand parent reports use a general-progress marker instead of inventing a fifth-grade intervention. Existing historical reports are not rewritten. Practice searches use the class level if supplied; the report no longer substitutes today's fifth-grade pacing topic for session evidence.

The student waveform stays idle without measured tutor audio. Synthetic amplitudes are removed, the coach meter captures only while listening, and stale samples expire after two seconds. An open quiz/booking session alone no longer claims that the tutor is live. These changes are included in the orientation release. The additive database changes were applied during the authorized release.
