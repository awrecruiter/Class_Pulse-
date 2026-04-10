# Mobile Voice Controller

This document defines the recommended architecture for a phone or wearable push-to-talk controller that drives the existing classroom app voice layer more reliably in a noisy room.

## Goal

- Improve recognition stability by moving capture closer to the teacher.
- Preserve all existing settings contracts for navigation, schedule docs, queueing, and app opens.
- Add remote execution as an explicit opt-in capability instead of silently changing current behavior.

## Why Mobile First

- A phone plus headset or lapel mic will outperform the board microphone in classroom noise.
- Push-to-talk reduces accidental triggers compared with always-listening browser voice.
- The mobile device can act as the teacher's trusted approval surface even when the board is across the room.

## Recommended Architecture

1. Mobile controller
- Phone web app or native shell with a hold-to-talk button.
- Optional watch companion forwards a push-to-talk request to the phone.
- The phone captures audio and sends transcript or audio to the backend.

2. Command broker
- Server validates the teacher session and class context.
- Server classifies the command using the same action schema used by `/api/coach/voice-agent`.
- Server emits a signed command event to the active board session.

3. Board subscriber
- The board app subscribes over WebSocket or SSE.
- The board only executes commands that already exist in the shared voice layer.
- Commands that remain browser-restricted still require their current settings-driven handling.

## Settings Contract

Current settings are behavioral contracts and must stay intact:

- `scheduleDocOpenMode`
- `voiceNavMode`
- `voiceAppOpenMode`
- queue behavior
- handoff mode

Remote or mobile execution must be additive. Do not reinterpret an existing setting to mean "remote approval is enough."

## Additive Setting Model

If remote execution is added, it should use a new opt-in setting rather than altering existing ones. Recommended examples:

- `remoteCommandMode`: `off` | `listen-only` | `trusted-remote`
- `remoteExternalOpenMode`: `inherit` | `confirm-on-mobile`

Recommended semantics:

- `off`: current app behavior only
- `listen-only`: mobile can transcribe and classify, but board still behaves exactly as it does now
- `trusted-remote`: mobile-issued commands may execute without board-side queue approval where the app already supports direct execution
- `confirm-on-mobile`: the approval action happens on the mobile device, then the board receives an already-approved command

`remoteExternalOpenMode` must not replace `voiceAppOpenMode`. It should layer on top of it and only affect remote-issued commands.

## Browser Constraint

Remote approval does not guarantee that a browser tab can always open arbitrary external windows without popup restrictions. For that reason:

- internal navigation can use the existing immediate routing path
- schedule docs can continue to honor `scheduleDocOpenMode`
- external app opens may still need a browser-safe fallback unless the board is wrapped in a native shell or extension

## Scope Already Supported By The Current App

These command categories already have app-side execution paths:

- move student to group
- queue or draft parent message
- send parent message when Parent Comms is mounted
- show schedule
- open schedule doc
- class navigation
- board panel switching
- board app opens
- start and end session
- start and stop lecture
- ask coach

## Scope Still Needed For A Full Remote Controller

- persistent board session channel for remote-issued commands
- explicit remote settings in teacher settings and settings UI
- route-independent event consumers for commands that currently only work when a page is mounted
- optional native wrapper or extension if guaranteed background tab opening is required
