---
name: e2e-test
description: End-to-end testing workflow for this app using browser automation and focused verification.
---

# End-To-End Testing

## Preflight

- confirm the repo has a browser-accessible frontend
- start the local app
- confirm browser tooling is available

## Test Flow

1. Identify the user journeys to cover.
2. Exercise each journey in the browser.
3. Capture screenshots at important points.
4. Check console or runtime errors when available.
5. Validate any expected persisted changes in the database when relevant.
6. Fix issues found and re-test.

## Responsive Pass

Re-check important pages at:
- mobile
- tablet
- desktop

## Output

Report:
- journeys tested
- issues found
- issues fixed
- remaining risks
