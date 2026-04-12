# QA Gates

These gates are the minimum acceptance workflow for agent-driven implementation in this repo. LangGraph should orchestrate these gates after OpenHands completes a task.

## Gate Order

1. `scope_gate`
2. `static_gate`
3. `test_gate`
4. `contract_gate`
5. `build_gate`
6. `privacy_gate`
7. `human_gate` when required

## 1. Scope Gate

Purpose:

- prevent unrelated edits
- prevent accidental changes in sensitive areas

Fail if:

- changed files are outside declared task scope without justification
- settings, auth, or FERPA-sensitive files were touched unintentionally
- task claims a narrow change but diff is broad

Sensitive paths:

- `src/lib/db/schema.ts`
- `src/lib/auth/**`
- `src/app/api/teacher-settings/route.ts`
- `src/app/api/classes/[id]/parent-message/route.ts`
- `src/app/api/classes/[id]/behavior/incident/route.ts`

## 2. Static Gate

Commands:

```bash
npx tsc --noEmit
npm run lint
```

Fail if:

- TypeScript errors
- lint errors
- domain contracts weakened through broad `any` usage or unsafe casts

## 3. Test Gate

Commands:

```bash
npm run test:run
```

Plus:

- targeted tests for touched subsystem
- new regression tests when config-driven behavior changes

Fail if:

- tests fail
- changed config-driven behavior has no new or updated coverage
- settings semantics changed without regression tests

## 4. Contract Gate

Purpose:

- preserve behavior that users already depend on

Must verify:

- `scheduleDocOpenMode` semantics unchanged unless explicit additive mode introduced
- `voiceNavMode` semantics unchanged unless explicit additive mode introduced
- `voiceAppOpenMode` semantics unchanged unless explicit additive mode introduced
- queue behavior not implicitly bypassed
- handoff mode not silently replacing configured nav or app-open behavior

Fail if:

- any existing setting behavior is collapsed, bypassed, or reinterpreted

## 5. Build Gate

Commands:

```bash
npm run build
```

Fail if:

- production build fails
- server/client boundary issues appear
- route imports or runtime assumptions break build output

## 6. Privacy Gate

Purpose:

- keep agent workflows from expanding PII exposure

Fail if:

- logs include raw parent phone numbers
- logs include raw parent message content without need
- prompts or traces include unnecessary student-identifying data
- broad tasks modify sensitive data paths without explicit approval

Recommended checks:

- grep diffs for obvious phone logging
- inspect any new agent prompt payloads
- inspect any new execution traces or audit logs

## 7. Human Gate

Human verification is still required for:

- parent comms changes
- voice UX changes
- schedule doc open behavior changes
- external app open behavior changes
- behavior ladder semantics
- grading or mastery semantics

Automated QA supplements human testing. It does not replace classroom workflow validation.

## Pass / Fail Outcomes

### Pass

- all required gates succeeded
- no blocked contracts violated

### Fail: Repair

- bounded technical issue
- send result back to OpenHands with concrete failures

### Fail: Human Review

- change is semantically risky
- change touches sensitive contracts
- change is ambiguous even if tests pass

## Minimum Evidence Per Task

Each completed task should produce:

- changed file list
- command results for static, test, and build gates
- explicit contract review notes
- privacy review notes when sensitive paths are touched
