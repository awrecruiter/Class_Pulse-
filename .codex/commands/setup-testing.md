Set up the repo testing layers.

Required checks:
- `npm test` should run Vitest in watch mode
- `.git/hooks/pre-commit` should run `npm run validate`
- `.github/workflows/validate.yml` should run CI validation on push and pull request

If missing, add them using the project’s existing Node and GitHub Actions conventions.
