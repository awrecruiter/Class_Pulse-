---
name: optimize-coach
description: Reduce token usage and API cost for the AI instructional coach without degrading response quality
---

# Optimize AI Coach Token Usage

Reduce the cost and latency of `POST /api/coach` (the main instructional scaffold call) by implementing smart standards filtering and transcript compression in `src/lib/ai/coach.ts`.

## Context

The coach call is the most expensive AI call in the system:
- **Model**: `claude-haiku-4-5-20251001`
- **Max tokens**: 6000 (output)
- **System prompt**: includes the FULL FL BEST standards corpus on every call (~3000+ tokens)
- **User message**: raw lesson transcript up to 2500 words (~3000+ tokens)
- **Total input**: can exceed 8000 tokens per call

## What to implement

### 1. Smart standards filtering (biggest win)

Instead of dumping all FL BEST standards into the system prompt every call, dynamically select only the relevant subset.

Read `src/data/fl-best-standards.ts` to understand the `FL_BEST_STANDARDS` array structure (each entry has `code`, `grade`, `domain`, `cluster`, `description`, `prereqCodes`).

In `src/lib/ai/coach.ts`, replace the static `STANDARDS_CORPUS` usage with a `selectRelevantStandards(query: string, pinnedCodes: string[])` function that:

1. If `pinnedCodes` is non-empty: include those standards + all their `prereqCodes` + the grade-below equivalents (walk the prereq chain one level)
2. If `pinnedCodes` is empty: score each standard by keyword overlap with the query string (split query into words, count matches against `code + description`), take the top 12 by score
3. Always include at minimum 3 standards so the prompt has enough context
4. Return a filtered `formatStandardsForPrompt()` output using only the selected standards

Then in `SYSTEM_PROMPT` (or in `getScaffold()`), replace `${STANDARDS_CORPUS}` with `${selectRelevantStandards(req.studentQuery, req.pinnedStandards ?? [])}`.

**Expected savings**: ~60–70% reduction in standards corpus tokens (from ~108 standards to ~10–15)

### 2. Transcript compression

Instead of sending raw rolling transcript verbatim, extract the most information-dense portion.

In `getScaffold()`, before building `userMessage`, compress `req.lessonTranscript`:

```typescript
function compressTranscript(raw: string): string {
  if (!raw.trim()) return raw;
  const words = raw.trim().split(/\s+/);
  if (words.length <= 400) return raw; // short enough, no compression needed
  // Take the last 400 words (most recent = most relevant to current confusion)
  return "...[earlier lesson]...\n" + words.slice(-400).join(" ");
}
```

Use `compressTranscript(req.lessonTranscript)` in the user message instead of `req.lessonTranscript.trim()`.

**Expected savings**: up to ~2600 tokens when transcript is at max 2500-word buffer

### 3. Reduce max_tokens

The response schema is large but has a known maximum size. After implementing the above, reduce `max_tokens` from `6000` to `4500`. The existing `stop_reason === "max_tokens"` error handler already covers edge cases.

**Expected savings**: no input cost reduction, but signals to the API the expected output size

## Implementation steps

1. Read `src/lib/ai/coach.ts` fully (it's ~310 lines)
2. Read `src/data/fl-best-standards.ts` to understand the data structure and `formatStandardsForPrompt()`
3. Implement `selectRelevantStandards()` — add it above the `SYSTEM_PROMPT` const
4. Update `SYSTEM_PROMPT` to call `selectRelevantStandards` (note: since the prompt is a const, move standards injection into `getScaffold()` instead — build the system prompt dynamically per request)
5. Implement `compressTranscript()` — add it above `getScaffold()`
6. Apply `compressTranscript` in the user message
7. Change `max_tokens: 6000` to `max_tokens: 4500`
8. Run `npx tsc --noEmit` and `npm run lint:fix`
9. Verify the response shape is unchanged (same `CoachResponse` type returned)

## What NOT to change

- The `CoachResponse` type — do not remove any fields
- The `SYSTEM_PROMPT` rules and JSON schema section — keep these intact, only swap out the standards corpus section
- The `getScaffold()` function signature — no breaking changes to callers
- The `max_tokens` error handler — keep the existing throw

## Validation

After implementing, check token reduction by logging input token count:
```typescript
console.log(`[coach] input_tokens=${message.usage.input_tokens} output_tokens=${message.usage.output_tokens}`);
```
Typical before: ~8000–10000 input tokens. Target after: ~3500–5000 input tokens.
