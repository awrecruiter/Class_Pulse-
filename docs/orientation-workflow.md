# Family orientation workflow

Class Pulse now connects family intake to the existing student portal and parent reports.

## Tutor setup

1. Open a class and select **Family orientation**.
2. Add the learning topic and, optionally, an external quiz link and an individual Zoom link.
3. Create one private invitation per new learner, then copy it to share with that family. Invitations expire after 30 days.
4. In **Settings → Student booking**, save the tutor's Calendly scheduling link. Connect Zoom in Calendly and select Zoom as the event location for meeting details in confirmations. The workflow does not create or infer a booking from opening Calendly.

## Family journey

Parent/guardian name, email, US phone → student first name and last initial, optional grade/level, learning content → **How are you doing?** → Calendly booking → Zoom details → external quiz or the existing Class Pulse classroom → parent-progress instructions.

Grade/level is per learner and may be blank, K–12, mixed, or adult. Intake creates a roster entry and existing parent contact in one transaction; the email and learner-specific goals are kept in the orientation record. The self-check is confidence, not assessment evidence. It initializes the existing comprehension signal only for the learner's first orientation-linked session. Subsequent session check-ins are not overwritten.

Classroom access requires a live, unexpired session and an active roster entry. The invitation signs the same student cookie used by the join-code flow. It never starts a session or a lecture. Students can return from the quiz portal to orientation and parent-progress instructions.

## Parent reinforcement

In the class orientation manager, the tutor records source/date, independent performance, assistance, gaps and next checks in **Reviewed learning evidence**, then adds a concrete **At-home reinforcement** activity. Saving reviewed progress enables **Create parent report link**, using the existing `/api/report/token` → `/report/[token]` path. Draft evidence is not displayed to parents. The tutor previews/copies the report; no email or SMS is sent automatically.

External quiz scores are not automatically imported. Calendly confirmations carry Zoom details when configured; a tutor can also supply an individual Zoom link. Missing links remain visibly unavailable rather than pretending a booking or meeting exists.

## Privacy and deployment

- Teacher endpoints enforce class ownership. Public orientation endpoints use private, high-entropy, expiring invitation tokens; they never return parent details or learner identifiers.
- Intake retries lock the invitation and cannot duplicate or overwrite enrollment.
- Public responses are not cached, and orientation pages suppress referrers and indexing.
- Existing settings, voice routing, classroom currency and transcript ephemerality remain unchanged.
- Additive migration: `0024_orientation.sql`; preceding changes use `0022_student_booking.sql` and `0023_optional_grade.sql`.
- Validation: full TypeScript/lint suite and 279 tests passed; production build passed. Live Calendly/Zoom booking requires the tutor's real scheduling setup and is not simulated as a successful reservation.

Browser QA completed with synthetic records: intake → self-check → booking setup state → Zoom instructions → signed student classroom → return to parent progress → private parent report. No actual Calendly booking or Zoom meeting was created.

## Parent destination confirmation

The family sees only the current screen, with no visible step list or guardian checkbox. Tutoring, booking and quizzes continue while the number is unconfirmed. After contacting the parent, the tutor confirms the exact number in Family orientation. Orientation report creation, SMS delivery and existing report access require confirmation matching the current active parent contact. Confirmation records the tutor and time and revokes previously issued tokens. Changing the contact number invalidates the match. Legacy classroom contacts retain their existing sharing behavior. No confirmation message is automatically sent by this change.

## School selection and layout

Learner intake includes a searchable school field beside grade and topic. Tutors manage school choices per invitation, one school per line, and families can enter an unlisted school. School names are stored with the learner orientation and shown to the tutor. No school directory is inferred from other learners. Buttons and explanatory text are centered; inputs use left-aligned placeholders with accessible labels.
