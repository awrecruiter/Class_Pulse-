# OpenHands Task Template

Use this template for any task submitted to OpenHands from LangGraph or by hand.

## Task

Objective:

`<one narrow objective>`

## Scope

Files in scope:

- `<path>`
- `<path>`

Avoid touching unless required:

- `src/lib/db/schema.ts`
- `src/lib/auth/**`
- `src/app/api/teacher-settings/route.ts`
- `<additional sensitive paths>`

## Contracts To Preserve

- Existing settings semantics must remain intact.
- Do not reinterpret or collapse:
  - `scheduleDocOpenMode`
  - `voiceNavMode`
  - `voiceAppOpenMode`
  - queue behavior
  - handoff mode
- Reliability changes must be additive and opt-in.
- Do not silently replace configured behavior with a production-safe or handoff-safe shortcut.

## Privacy / FERPA Constraints

- Do not add unnecessary PII to prompts, traces, or logs.
- Avoid changing parent contact, auth, or student identity flows unless the task explicitly requires it.
- If a sensitive file must change, keep the diff minimal and explain why.

## Required Validation

Run:

```bash
npx tsc --noEmit
npm run lint
npm run test:run
```

If behavior or routing changes are broad, also run:

```bash
npm run build
```

## Test Requirements

- Add or update regression tests for any changed config-driven behavior.
- If settings behavior is touched, tests must prove current semantics remain intact.
- Do not ship a behavior change that lacks targeted coverage.

## Acceptance Criteria

- Change is limited to the declared scope.
- Existing settings contracts are preserved.
- No unrelated edits are included.
- Validation commands pass.
- Added or updated tests cover the changed behavior.
- Any sensitive-path edits are minimal and justified.

## Output Format

Return:

1. Summary of what changed
2. Files changed
3. Validation run and results
4. Known risks or follow-ups

## Example Follow-Up Repair Prompt

The previous attempt failed QA. Repair only the issues below.

Issues:

- `<failed command or test>`
- `<contract violation>`
- `<scope violation>`

Do not broaden scope. Preserve all original constraints.
