---
name: commit
description: This skill should be used when the user asks to "commit", "create a commit", "commit my changes", or wants to stage and commit all uncommitted changes with an appropriate message.
---

# Commit Changes

Create a new commit for all uncommitted changes.

## Steps

1. Run `git status && git diff HEAD && git status --porcelain` to see what files are uncommitted
2. Add the untracked and changed files
3. Write an atomic commit message that accurately describes the changes
4. Add a conventional commit tag (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, etc.) that reflects the work
