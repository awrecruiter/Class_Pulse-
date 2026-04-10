---
name: prime
description: Prime Codex with repo understanding before implementation or review.
---

# Prime The Repo

Build a quick working model of the project before making changes.

## Read First

- `AGENTS.md`
- `README.md`
- `package.json`
- `tsconfig.json`
- `drizzle.config.ts`
- `.claude/PRD.md` when product context matters

## Inspect Current State

- `git status --short`
- `git log -10 --oneline`
- `rg --files src docs .claude .codex`

## Output

Summarize:
- product purpose
- main runtime and framework choices
- auth and database shape
- likely files to touch for the current task
- risks or project rules that matter
