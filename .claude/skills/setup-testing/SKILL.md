---
name: setup-testing
description: Sets up round-the-clock automated testing: pre-commit hook (blocks bad commits), vitest watch reminder, and GitHub Actions CI. Run once per project to wire up all three layers.
---

# Setup Round-the-Clock Testing

Wire up all three testing layers so validation runs automatically at every stage — on save, on commit, and on push.

## Layer 1: Vitest Watch (on save)

Check if `"test"` script already runs vitest in watch mode:

```bash
grep '"test"' package.json
```

If it's `"vitest"` (no `--run` flag), watch mode is already available via `npm test`. No change needed — remind the user to run `npm test` during active development.

## Layer 2: Pre-commit Hook (on commit)

1. Check if hook already exists:
```bash
cat .git/hooks/pre-commit 2>/dev/null || echo "NOT FOUND"
```

2. If not found, create it:
```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
echo "Running pre-commit validation..."
npm run validate
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Validation failed. Commit blocked."
  echo "Fix the errors above, then commit again."
  exit 1
fi
echo "✅ Validation passed."
EOF
chmod +x .git/hooks/pre-commit
```

3. Verify:
```bash
cat .git/hooks/pre-commit
```

## Layer 3: GitHub Actions CI (on push)

1. Check if workflow already exists:
```bash
ls .github/workflows/ 2>/dev/null || echo "NOT FOUND"
```

2. If not found, create the directory and workflow file:

Create `.github/workflows/validate.yml`:

```yaml
name: Validate

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - name: Install dependencies
        run: npm install --force
      - name: Validate (tsc + lint + tests)
        run: npm run validate
```

3. Verify the file was created correctly.

## Verify All Three Layers

Run a final check confirming everything is in place:

```bash
echo "=== Layer 1: Watch mode ===" && grep '"test"' package.json
echo "=== Layer 2: Pre-commit hook ===" && ls -la .git/hooks/pre-commit
echo "=== Layer 3: GitHub Actions ===" && cat .github/workflows/validate.yml
```

## Summary Output

After setup, report to the user:

| Layer | Trigger | Command |
|---|---|---|
| Watch | File save | `npm test` |
| Pre-commit | `git commit` | auto (blocks bad commits) |
| CI | `git push` | GitHub Actions |

Remind the user: `.git/hooks/` is not committed to the repo — if other contributors clone the project they need to run `/setup-testing` too. For a shared team, suggest Husky as a follow-up.
