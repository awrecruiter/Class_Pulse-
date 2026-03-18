---
name: commit
description: This skill should be used when the user asks to "commit", "create a commit", "commit my changes", or wants to stage and commit all uncommitted changes with an appropriate message.
---

# Commit Changes

Validate first, then commit. Never commit without a clean validate pass.

## Steps

1. **Run validation first**
   ```bash
   npm run validate
   ```
   - If it fails: report the errors, stop — do NOT commit. Tell the user what needs fixing.
   - If it passes: proceed to step 2.

2. **Inspect changes**
   ```bash
   git status && git diff HEAD && git status --porcelain
   ```

3. **Stage files** — add specific files by name, never `git add -A` or `git add .`

4. **Write the commit message**
   - Conventional commit tag: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
   - One sentence describing *why*, not *what*
   - Co-author line required

5. **Commit**
   ```bash
   git commit -m "$(cat <<'EOF'
   <tag>: <message>

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

6. **Verify**
   ```bash
   git status
   ```
