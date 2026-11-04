# Class Pulse workspaces

Classroom, Distance learning and Homeschool are additive workspaces within the same application and login.

## Preserved classroom template

`classroom-template-2026-11-03` tags the source before workspace separation. Existing classes migrate to `workspace_mode = 'classroom'`. Classroom routes, voice controls, currency behavior, settings and the public homeschool landing page remain available. The original classroom navigation gains an explicit Tutoring entry; it never switches modes automatically.

## New learning workspaces

- `/tutoring`: the shared classroom teaching desk, scoped to distance-learning spaces.
- `/tutoring?mode=homeschool`: the same teaching desk, scoped to homeschool spaces.
- `/tutoring/[id]`: teaching desk with the selected private learning space.
- `/tutoring/spaces`: learning-space creation and management (`?mode=homeschool` for homeschool).
- `/tutoring/[id]/setup`: family invitations, quiz link preview, Zoom links, learning evidence, recipient confirmation and parent reports.
- `/tutoring/settings`: a light booking setup surface using the existing Calendly preference. It sends only that field; the link is explicitly shared across the teacher's workspaces.

The warm background, lavender accents, soft cards and rounded controls follow the orientation design. The shared warm design now applies across the app, including classroom screens, all student portals and public orientation/report surfaces. The original classroom template remains available in the tag above. Existing saved light/dark preferences still apply; this update does not write or replace them.

## Data and behavior contracts

`classes.workspace_mode` is an explicit choice on creation. Existing API clients default to Classroom. `GET /api/classes` returns only the authenticated teacher's classroom records; `?mode=distance` and `?mode=homeschool` opt into their own records. Mode selection is navigation, not a global preference or a rewrite of existing classes.

The new routes require teacher authentication and verify record ownership. Classroom records cannot be opened through the tutor detail route. New spaces reuse the existing roster, family orientation, student cookies, quiz-room lifecycle, provider links and parent-report paths. Booking stays in Calendly and meeting links come from Zoom/Calendly setup; external quiz results still require tutor review. Opening a quiz room does not enable the lecture microphone.

Parent recipient confirmation remains required for orientation families before sharing reports. Existing voice-open modes, queue settings, currency settings and mastery thresholds are not changed. No lesson transcript persistence is added.

Migration: `0027_workspace_modes.sql`, additive column and index. No existing records are moved to a new workspace automatically.


## Shared reservations sidebar

The tutoring teaching desk reuses the actual classroom implementation (`TeachingDesk`), including its three-panel layout, roster, comprehension, lesson recording, session controls, groups and parent communication panels. Its existing left schedule slot displays Calendly reservations as an hourly timeline with date navigation. The classroom desk retains its original school schedule feed without an extra reservations card. Other teacher dashboard pages keep their reservations sidebar. Desktop preserves the classroom columns; mobile tutoring stacks them. Student/public pages never mount the teacher schedule. Each reservation shows learner name, subject, topic and local start time. Teacher-owned linked learning spaces are clickable.

At `/tutoring/settings#calendly-connection`, a teacher can connect a Calendly personal access token with profile, scheduled-event and invitee read permissions. The existing booking-link setting remains independent and unchanged. Credentials are validated with `/users/me`, encrypted with AES-256-GCM using the required auth secret, and never returned to the browser. Secret rotation requires reconnection. Disconnect deletes the saved credential.

The integration reads active events for the connected user over the next 60 days (up to 50 events, up to 100 invitees each). A partial-results notice appears when more pages exist. It refreshes every 60 seconds while visible, with a manual refresh button. No Calendly events are created, canceled or modified. Failed refreshes show an error and omit unverified external reservations. A real account connection is required to verify provider behavior in production; a public scheduling URL cannot provide a reservation feed.

Add Calendly questions named `Student name` (or `Learner name`), `Subject` and `Topic` to populate the cards. A unique parent-email match can fill missing details from the teacher's enrolled learner; shared family emails are not matched automatically. Teachers can edit card metadata locally or add clearly labeled manual reservations. Local annotations never change Calendly bookings. All APIs scope records to the authenticated teacher and reject unauthenticated access.

Migration `0028_reservations.sql` adds credentials and local reservations/annotations. Demo reservations are explicitly labeled and do not represent a real booking, attendance or mastery. The dedicated demo learner uses a native quiz without an asserted curriculum standard or parent-report delivery.


Teaching-desk state is explicitly scoped by workspace. Classroom keeps its legacy class/session/board storage keys and existing tab-based stale-session cleanup. Distance and homeschool use separate keys (`pulse:distance:*`, `pulse:homeschool:*`). Opening a tutoring desk restores an existing quiz room without ending it; closing a room still requires the existing explicit action. Scoped voice queues read their own session key for question pushes. Existing voice navigation, app-open, schedule-doc-open and handoff preferences keep their semantics. The tutor schedule overlay reads reservations; the classroom overlay and document behavior remain intact.
