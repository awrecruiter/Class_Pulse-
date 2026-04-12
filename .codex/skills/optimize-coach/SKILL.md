---
name: optimize-coach
description: Reduce token usage and latency in the AI coach without changing the external response contract.
---

# Optimize The AI Coach

Focus on `src/lib/ai/coach.ts` and related standards/transcript inputs.

## Goals

- reduce prompt size
- preserve output contract
- avoid regressions in teacher-facing behavior

## Expected Work

- narrow standards context dynamically
- compress transcript context when safe
- keep validation and response typing intact
- add targeted tests if logic changes are non-trivial
