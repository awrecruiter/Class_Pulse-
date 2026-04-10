---
name: commit
description: Validate and create a commit for the current changes.
---

# Commit Changes

Validate first, then commit.

## Steps

1. Run `npm run validate`.
2. If validation fails, stop and report the failures.
3. Review `git status --short` and `git diff --stat`.
4. Stage only the intended files.
5. Create a conventional commit message.
6. Verify the worktree state after commit.

## Rules

- never use `git add .` or `git add -A`
- do not amend unless the user explicitly asks
