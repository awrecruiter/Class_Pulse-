---
name: setup-testing
description: Ensure on-save, pre-commit, and CI validation layers are wired correctly.
---

# Setup Testing Layers

Verify all three layers:

1. Watch mode: `npm test`
2. Pre-commit: `.git/hooks/pre-commit` runs `npm run validate`
3. CI: `.github/workflows/validate.yml` runs validation on push and PR

If a layer is missing, add it using the repo’s existing Node and GitHub Actions conventions.
