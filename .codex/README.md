# Codex Project Assets

This directory is the Codex-oriented counterpart to `.claude/`.

## What Is Here

- `skills/`: repo-local skill prompts in Codex `SKILL.md` format
- `commands/`: reusable prompt/command templates for common repo tasks
- `hooks/`: portable guard and logging scripts equivalent to the Claude hook scripts

## Important Limitation

Codex in this environment does not consume Claude's `.claude/settings.json` hook configuration directly.

That means:
- `.codex/hooks/` contains the equivalent scripts
- `AGENTS.md` and local workflow still need to reference and honor them
- if you want shell-level enforcement outside the agent, wrap Codex launch or terminal commands with these scripts

## Recommended Usage

- Treat `skills/*/SKILL.md` as the Codex versions of the corresponding Claude skills.
- Treat `commands/*.md` as reusable Codex prompt macros or operator runbooks.
- Use `hooks/protect-env.mjs` before running risky file reads or shell commands against local env files.
- Start Codex through `.codex/bin/codex-safe` so the process inherits a scrubbed environment.
- To make `codex` itself resolve to the safe wrapper in your current shell, run:

```bash
source .codex/activate.sh
```

## Safe Launcher

`.codex/bin/codex-safe` launches Codex with:
- a repo-root working directory
- a scrubbed environment that keeps basic terminal variables only
- no inherited app secrets by default
- optional extra non-secret env inheritance via `.codex/env.allowlist`

If you need extra non-secret variables, copy `.codex/env.allowlist.example` to `.codex/env.allowlist` and list them one per line.

## Mapping From `.claude`

- `.claude/skills/*` -> `.codex/skills/*`
- `.claude/commands/*` -> `.codex/commands/*`
- `.claude/hooks/*` -> `.codex/hooks/*`

## Notes

- These Codex versions are adapted to the current Next.js/PostgreSQL repo, not the stale Python examples present in parts of `.claude/`.
- Codex project rules live in `AGENTS.md`, not `CLAUDE.md`.
- The safe launcher protects environment inheritance. It does not give Codex a native hook engine equivalent to Claude's `.claude/settings.json`.
