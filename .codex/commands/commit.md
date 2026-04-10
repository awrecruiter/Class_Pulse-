Stage and commit the current repo changes with a conventional commit message.

Required flow:
1. Run `npm run validate` first. If it fails, stop and report the failures.
2. Review `git status --short` and `git diff --stat`.
3. Stage only the relevant files, never `git add .` or `git add -A`.
4. Use a conventional prefix like `feat`, `fix`, `docs`, `refactor`, `test`, or `chore`.
5. Keep the commit message focused on why the change exists.
6. Finish by showing `git status --short` so the post-commit state is clear.

Do not amend existing commits unless explicitly asked.
