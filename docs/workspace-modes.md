# Class Pulse workspaces

Classroom, Distance learning and Homeschool are additive workspaces within the same application and login.

## Preserved classroom template

`classroom-template-2026-11-03` tags the source before workspace separation. Existing classes migrate to `workspace_mode = 'classroom'`. Classroom routes, voice controls, currency behavior, settings and the public homeschool landing page remain available. The original classroom navigation gains an explicit Tutoring entry; it never switches modes automatically.

## New learning workspaces

- `/tutoring`: distance-learning spaces.
- `/tutoring?mode=homeschool`: homeschool spaces.
- `/tutoring/[id]`: private learner/group workspace with family invitations, quiz link preview, Zoom links, learning evidence, recipient confirmation and parent reports.
- `/tutoring/settings`: a light booking setup surface using the existing Calendly preference. It sends only that field; the link is explicitly shared across the teacher's workspaces.

The warm background, lavender accents, soft cards and rounded controls follow the orientation design. Student quiz sessions use the lighter presentation only for distance or homeschool spaces. Classroom student sessions retain their original presentation.

## Data and behavior contracts

`classes.workspace_mode` is an explicit choice on creation. Existing API clients default to Classroom. `GET /api/classes` returns only the authenticated teacher's classroom records; `?mode=distance` and `?mode=homeschool` opt into their own records. Mode selection is navigation, not a global preference or a rewrite of existing classes.

The new routes require teacher authentication and verify record ownership. Classroom records cannot be opened through the tutor detail route. New spaces reuse the existing roster, family orientation, student cookies, quiz-room lifecycle, provider links and parent-report paths. Booking stays in Calendly and meeting links come from Zoom/Calendly setup; external quiz results still require tutor review. Opening a quiz room does not enable the lecture microphone.

Parent recipient confirmation remains required for orientation families before sharing reports. Existing voice-open modes, queue settings, currency settings and mastery thresholds are not changed. No lesson transcript persistence is added.

Migration: `0027_workspace_modes.sql`, additive column and index. No existing records are moved to a new workspace automatically.
