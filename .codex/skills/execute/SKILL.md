---
name: execute
description: Execute a markdown implementation plan with verification.
---

# Execute A Plan

Read the target plan completely, then implement it in order.

## Required Flow

1. Read all referenced files.
2. Make the planned changes using current repo patterns.
3. Add or update focused tests.
4. Run the validation commands from the plan.
5. Report what changed and what still needs attention.

## Non-Negotiables

- do not skip tests for settings-driven or auth-sensitive changes
- do not silently change user-facing setting semantics
- preserve voice behavior contracts unless explicitly asked otherwise
