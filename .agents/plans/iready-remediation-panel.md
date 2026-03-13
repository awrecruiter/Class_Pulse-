# Feature: iReady-Style Unified Remediation Panel

> Replace the 3-card accordion (Hear It / See It / Do It) with a single linear remediation session flow combining narration, interactive manipulatives, and mastery checks — iReady/Khan Academy Kids style.

## User Story

As a 5th-grade math teacher
I want a single unified remediation flow that walks me through narration → animation → interactive manipulative → mastery check
So that I can immediately remediate a confused student in real time without switching between tabs or figuring out what to do next

## Feature Metadata

**Feature Type**: Refactor + Enhancement
**Estimated Complexity**: High
**Primary Systems Affected**: `scaffold-card.tsx` (replaced), `coach/page.tsx`, `coach.ts` (AI), API route
**Dependencies**: edge-tts (installed), ffmpeg (installed), Manim (installed), student manipulative components

---

## Stage Flow State Machine

```
intro → animation → manipulative → practice → mastery
  ↑                      ↓ (skip if no manipulative)    ↑
  └──────── "Still Confused?" onDeepen re-fetch ─────────┘
```

### Stages

| Stage | Content | Auto-narrates |
|---|---|---|
| `intro` | Gap diagnosis + grade stepper + response.script + guiding questions | `response.script` |
| `animation` | ManimPlayer (auto-renders, narration baked into video) | none — video audio |
| `manipulative` | Interactive StudentFractionBar/AreaModel/NumberLine + DrawCanvas + PushButton | `response.manipulative.caption` |
| `practice` | ScaffoldQuiz (3 progressive MCQs) | first question text |
| `mastery` | Celebration + collapsed BelowBlock + StillConfusedPanel | "Let's check for understanding" |

### Transition Rules

- Teacher manually advances with "Continue →" / "Next stage" buttons
- `animation` → `manipulative` is skipped if `response.manipulative === null`
- `practice` ScaffoldQuiz fires `onComplete` callback → auto-advances to `mastery`
- Grade change resets to `intro`, all other state preserved
- Back navigation: tap any completed stage bubble to jump back (state is preserved)

---

## Multi-Grade Scaffold Chain (K–5)

**Decision: AI-generated on demand via prompt modifier (not hardcoded)**

- Grade stepper: `["K", "1", "2", "3", "4", "5"]` — K maps to grade 0 internally
- Selecting a grade fires `onGradeChange(grade)` → parent re-calls `sendAcademic` with `scaffoldGrade`
- When `scaffoldGrade <= 2`: inject K–2 modifier into prompt. FL BEST codes not rendered; show `"K–2 Mode"` badge instead
- When `scaffoldGrade 3–5`: inject grade-override modifier; AI adjusts all content accordingly
- `CoachResponse` schema unchanged — each grade re-fetch returns a fresh complete response

**K–2 prompt modifier injected into getScaffold():**
```
SCAFFOLD GRADE OVERRIDE: The student operates at a Kindergarten–Grade X level.
ALL content must be pitched for this grade. Use concrete counting, physical objects,
and simple language. FL BEST codes may be informal. The 'below' section should go
one level lower still.
```

**Default grade selection:** `Math.max(0, (response.gradePrereq?.grade ?? response.missingConcept.grade) - 1)`

---

## CoachResponse Schema — NO BREAKING CHANGES

`CoachResponse` stays exactly as-is. Only `CoachRequest` gains one optional field:

```typescript
export type CoachRequest = {
  lessonTranscript: string;
  studentQuery: string;
  pinnedStandards?: string[];
  priorAttempts?: Array<{ ... }>;
  scaffoldGrade?: number; // NEW — 0-5; undefined = auto
};
```

---

## Narration Integration

**Auto-speaks on stage mount with 400ms delay. Interruptible.**

- New `useNarration()` hook at `src/hooks/use-narration.ts` — imperative `speak(text)` / `stop()`
- Stage transitions call `stop()` before advancing
- Animation stage: no separate TTS — narration is baked into Manim video audio track
- `TtsButton` component stays unchanged — still used inside ScaffoldQuiz for per-question TTS

---

## Interactive Manipulatives in Teacher View

**Use student-side components directly (they have drag/tap interactivity):**

```typescript
import { StudentFractionBar } from "@/components/coach/manipulatives/student/fraction-bar";
import { StudentAreaModel } from "@/components/coach/manipulatives/student/area-model";
import { StudentNumberLine } from "@/components/coach/manipulatives/student/number-line";
```

Rationale: teacher is demonstrating on projected screen. Static teacher-side `Manipulative` wrapper replaced with interactive student-side component in the `manipulative` stage only. `PushButton` still shown below.

---

## Grade Stepper UI

Compact horizontal pill stepper in gap diagnosis block header:

```
Grade: [K] [1] [2] [3✓] [4] [5]
              AI detected ↑
```

- AI-detected grade has small "AI" badge
- Selected grade highlighted (indigo)
- Selecting triggers re-fetch + reset to `intro`
- While re-fetching: skeleton loader overlays current stage content; stage bar preserved

---

## Component API

### `RemediationFlow` Props
```typescript
type RemediationFlowProps = {
  response: CoachResponse;
  onDeepen?: (triedApproach: string, deeperContext: string) => void;
  onGradeChange?: (grade: number) => void;
  sessionId?: string;
  standardCode?: string;
  transcript?: string;
  isRefetching?: boolean;
};
```

### Internal State Shape
```typescript
const [stage, setStage] = useState<RemediationStage>("intro");
const [completed, setCompleted] = useState<Set<RemediationStage>>(new Set());
const [scaffoldGrade, setScaffoldGrade] = useState<GradeLevel>(deriveDefaultGrade(response));
const [sharedAnimUrl, setSharedAnimUrl] = useState<string | null>(null);
const { speaking, speak, stop } = useNarration();

// Reset when response changes (new fetch)
useEffect(() => {
  setStage("intro");
  setCompleted(new Set());
  setSharedAnimUrl(null);
  stop();
  // scaffoldGrade NOT reset — preserve user's grade selection
}, [response]);
```

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

- `src/components/coach/scaffold-card.tsx` — Source of sub-components to import (`ManimPlayer`, `ScaffoldQuiz`, `PushButton`, `BelowBlock`, `StillConfusedPanel`, `CopyButton`, `BelowToggle`). Only change: add `onComplete?: () => void` to `ScaffoldQuiz`.
- `src/lib/ai/coach.ts` — `CoachRequest` type (add `scaffoldGrade?`) and `getScaffold()` (add grade modifier). `CoachResponse` type unchanged.
- `src/app/(dashboard)/coach/page.tsx` — `ScaffoldCard` call site (replace with `RemediationFlow`). Add `handleGradeChange`. Add `scaffoldGrade` param to `sendAcademic`.
- `src/components/coach/tts-button.tsx` — Exact pattern to replicate in `useNarration` hook.
- `src/components/coach/manipulatives/student/fraction-bar.tsx` — Interactive component to use in manipulative stage.
- `src/components/coach/manipulatives/student/area-model.tsx` — Same.
- `src/components/coach/manipulatives/student/number-line.tsx` — Same.
- `src/components/coach/draw-canvas.tsx` — Used in manipulative stage.
- `src/app/api/coach/route.ts` — Add `scaffoldGrade` to Zod schema.

### New Files to Create

- `src/hooks/use-narration.ts` — Imperative TTS hook
- `src/components/coach/remediation-flow.tsx` — Main new component (replaces scaffold-card usage)

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

**Task 1 — CREATE `src/hooks/use-narration.ts`**
```typescript
"use client";
import { useEffect, useRef, useState } from "react";
import type { TtsVoiceId } from "@/components/coach/tts-button";

export function useNarration(defaultVoice: TtsVoiceId = "en-US-AvaNeural") {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  async function speak(text: string, voice: TtsVoiceId = defaultVoice) {
    stop();
    setSpeaking(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; };
      await audio.play();
    } catch { setSpeaking(false); }
  }

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }

  return { speaking, speak, stop };
}
```
- **VALIDATE**: `npx tsc --noEmit`

**Task 2 — MODIFY `src/components/coach/scaffold-card.tsx`**
- Add `onComplete?: () => void` to `ScaffoldQuiz` function signature and its type
- Call `onComplete?.()` inside `handleNext()` at the point where `setMastered(true)` is called
- Export `ManimPlayer`, `ScaffoldQuiz`, `PushButton`, `BelowBlock`, `StillConfusedPanel`, `CopyButton`, `BelowToggle` — change from `function X` to `export function X` where not already exported
- **VALIDATE**: `npx tsc --noEmit`

**Task 3 — MODIFY `src/lib/ai/coach.ts`**
- Add `scaffoldGrade?: number` to `CoachRequest` type
- In `getScaffold()`, construct `gradeModifier` string based on `req.scaffoldGrade`
- Prepend `gradeModifier` to `userMessage`
- **VALIDATE**: `npx tsc --noEmit`

**Task 4 — MODIFY `src/app/api/coach/route.ts`**
- Add `scaffoldGrade: z.number().int().min(0).max(5).optional()` to Zod schema
- Pass `scaffoldGrade: result.data.scaffoldGrade` to `getScaffold()`
- **VALIDATE**: `npx tsc --noEmit`

### Phase 2: Core Component

**Task 5 — CREATE `src/components/coach/remediation-flow.tsx`**

Full component with:
- `type RemediationStage = "intro" | "animation" | "manipulative" | "practice" | "mastery"`
- `type GradeLevel = 0 | 1 | 2 | 3 | 4 | 5`
- `StageBar` sub-component (5 bubble progress bar, completed = tappable)
- `GradeStepper` sub-component (K/1/2/3/4/5 pills, AI-detected badge)
- `IntroStage` — gap block + grade stepper + script + guiding questions + "Show Animation" + "Skip to Hands-On" buttons
- `AnimationStage` — ManimPlayer (auto-renders) + Continue button
- `ManipulativeStage` — StudentFractionBar|AreaModel|NumberLine based on `response.manipulative.type` + DrawCanvas + PushButton
- `PracticeStage` — ScaffoldQuiz with `onComplete` → auto-advance to mastery
- `MasteryStage` — celebration + collapsed BelowBlock + StillConfusedPanel
- All stage auto-narration via `useNarration()` hook in `useEffect` per stage
- **VALIDATE**: `npx tsc --noEmit`

### Phase 3: Integration

**Task 6 — MODIFY `src/app/(dashboard)/coach/page.tsx`**
- Replace `import { ScaffoldCard }` with `import { RemediationFlow }`
- Add `handleGradeChange = useCallback((grade) => sendAcademic(lastQuery, attempts, grade), [...])`
- Add `scaffoldGrade?: number` optional param to `sendAcademic`, forward to fetch body
- Replace `<ScaffoldCard ...>` with `<RemediationFlow ... onGradeChange={handleGradeChange} isRefetching={isLoading} />`
- **VALIDATE**: `npx tsc --noEmit`

### Phase 4: Cleanup

**Task 7 — Mark scaffold-card deprecated**
- Add comment at top of `scaffold-card.tsx`: `// DEPRECATED: sub-components exported for use by remediation-flow.tsx`
- Do NOT delete yet

**Task 8 — Lint**
- `npm run lint:fix`

---

## KNOWN GOTCHAS

1. **Tab indentation** — ALL TSX/TS files use tabs. Edit tool fails on space/tab mismatch; use Python `str.replace()` via Bash as fallback.
2. **TTS double-fire** — `useEffect` with `[response, stage]` deps can double-speak if both change simultaneously. Guard with `useRef` keyed to `${response.missingConcept.code}-${stage}`.
3. **StudentFractionBar reset on back-nav** — These components reset local state on unmount. Acceptable behavior — teacher re-demos from scratch.
4. **`noArrayIndexKey` Biome lint** — Quiz choice map uses index key. Add biome-ignore comment (pattern established in student manipulative files).
5. **K–2 mode FL BEST chip** — Hide the `missingConcept.code` amber pill when `scaffoldGrade <= 2` and `missingConcept.code` is empty or informal. Conditionally render based on code format (`/^MA\.\d/.test(code)`).
6. **`sendAcademic` stale closure** — The `scaffoldGrade` arg must be passed at call time, not captured from closure, to avoid stale grade state.
7. **ManimPlayer in animation stage** — Uses `didRender.current` guard. Safe on back-nav because `sharedAnimUrl` is set and `seedUrl` is provided; `buttonLabel` is undefined so it shows the video immediately.

---

## VALIDATION COMMANDS

```bash
# After every file edit:
npx tsc --noEmit

# After all edits:
npm run lint:fix
npm run lint

# Manual test checklist:
# 1. Trigger a coach response with a student query
# 2. Verify stage bar shows 5 bubbles, intro is active
# 3. Verify script auto-narrates via edge-tts (Andrew Neural voice)
# 4. Click "Show Animation" → animation stage → Manim renders + video plays with audio
# 5. Click Continue → manipulative stage → interactive fraction bar/area model/number line
# 6. Interact with manipulative (tap cells)
# 7. Click PushButton → verify students receive manipulative
# 8. Continue → practice stage → ScaffoldQuiz plays through 3 questions
# 9. Complete quiz → auto-advance to mastery stage
# 10. Change grade stepper to "K" → gap block updates → "K–2 Mode" badge shown → flow resets to intro
# 11. "Still Confused?" → select modality → "Dig Deeper" → re-fetch at deeper prereq
```

---

## ACCEPTANCE CRITERIA

- [ ] Single linear flow replaces accordion — no tabs visible
- [ ] Auto-narration fires at each stage mount (edge-tts, not Web Speech API)
- [ ] Animation stage plays Manim video with baked-in audio narration
- [ ] Manipulative stage renders interactive (tappable) student-side component
- [ ] PushButton sends spec to active student session
- [ ] DrawCanvas available in manipulative stage for teacher annotation
- [ ] ScaffoldQuiz advances automatically to mastery on completion
- [ ] Grade stepper (K–5) triggers re-fetch and resets flow to intro
- [ ] K–2 mode shows no FL BEST code chips; shows "K–2 Mode" badge
- [ ] Back navigation via stage bar works; state preserved
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint` passes with zero errors

---

## NOTES

- **Manim animation is still valuable** — it provides a visual+audio explanation that's different from the interactive manipulative. Keep it as stage 2.
- **`scaffold-card.tsx` stays as sub-component source** — all its internal components are exported and imported by `remediation-flow.tsx`. Do not duplicate them.
- **The BelowBlock in mastery stage** shows all three modality sub-blocks stacked (not separate accordion tabs) — the mastery stage is where the teacher decides if a deeper grade scaffold is needed. The grade stepper at the top is the primary mechanism; BelowBlock is a quick reference.
- **Voice choice**: Intro/manipulative narration = `en-US-AvaNeural` (warm). Quiz question narration (inside ScaffoldQuiz via TtsButton) = `en-US-AvaNeural`. Consistent voice throughout.
- **No DB changes** — this is entirely a UI/AI-layer feature.

## Confidence Score: 9/10

High confidence because:
- All sub-components already exist and work
- TTS, Manim, manipulatives all proven in existing code
- State machine is straightforward
- The only novel piece is wiring them into a linear flow with grade-override prompt injection
- Risk: `coach/page.tsx` is a large complex file — the `sendAcademic` modification needs careful reading before editing
