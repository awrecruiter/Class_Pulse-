# Feature: Voice Wake Phrase ("Listen Up")

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

The continuous voice command system mishears background classroom noise as commands (false positives) and sometimes silently drops into a broken state where nothing gets processed (false negatives). A **wake phrase** solves both problems: the teacher says "listen up" (or a configurable phrase) to explicitly open a 5-second active listening window. Commands within that window are processed; everything else is ignored. The wake phrase also serves as a recovery signal — saying it reactivates the system even if it had gotten stuck.

## User Story

As a 5th-grade math teacher in a noisy classroom
I want to say "listen up" before giving voice commands
So that the system reliably processes my commands and ignores background student noise

## Problem Statement

The current continuous listener processes every utterance — student talking, coughing, background noise — all of which can accidentally trigger RAM buck awards, navigation, or other commands. Additionally, SpeechRecognition sometimes silently fails and the teacher doesn't know commands stopped working until something important is missed.

## Solution Statement

Add a wake phrase gate to `useGlobalVoiceCommands`. When `requireWakePhrase` is enabled (teacher toggles in Settings):
1. Only wake phrases ("listen up", "hey coach", etc.) are accepted from the continuous stream
2. Detecting the wake phrase: plays the existing activation chime, opens a 5-second window, and shows a pulsing UI indicator
3. During the 5-second window: commands are processed normally (existing behavior)
4. Window resets on each command (so a multi-step session stays open)
5. Window expires after 5s of silence → back to wake-phrase-only mode

When disabled (default): existing always-on behavior is preserved exactly.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: `use-global-voice-commands.ts`, `voice-command-provider.tsx`, `voice-queue.tsx`, `nav-bar.tsx`, `settings/page.tsx`, DB schema
**Dependencies**: Existing `playActivationChime` (already used), existing `window.dispatchEvent` event pattern

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `src/hooks/use-global-voice-commands.ts` (full file, 159 lines) — **core change target**: wake phrase gate goes in the `onResult` callback (line 110). The `requireWakePhrase` prop + wake state refs live here.
- `src/hooks/use-mic-manager.ts` (full file, 263 lines) — mic semaphore/slot system. No changes needed but understand `onResult` delivery and the 300ms restart behavior.
- `src/components/voice/voice-command-provider.tsx` (lines 41–87, 720–744) — loads voice settings from localStorage+API on mount; passes props to `useGlobalVoiceCommands`. Must add `requireWakePhrase` loading + prop passing here.
- `src/contexts/voice-queue.tsx` (full file, 197 lines) — add `wakeActive: boolean` + `setWakeActive` to context. Pattern: mirrors `agentThinking` state (line 125–126, 96).
- `src/components/nav-bar.tsx` (lines 23–103) — `VoiceControls` component reads from `useVoiceQueue()`. Add wake active pulse indicator here alongside the existing mic dot.
- `src/lib/db/schema.ts` (`teacherSettings` table, lines 69–92) — add `requireWakePhrase boolean default false` column.
- `src/app/api/teacher-settings/route.ts` — add `requireWakePhrase` to Zod validation + PUT handler. Mirror how `voiceAppOpenMode` was added.
- `src/app/(dashboard)/settings/page.tsx` (lines 24–34 for `Settings` type, lines 1178–1209 for voice settings cards pattern) — add wake phrase toggle after existing voice settings cards.
- `src/lib/chime.ts` — `playActivationChime()` export; already called on voice enable toggle. Use same function for wake detection.

### New Files to Create

None — all changes are to existing files.

### Relevant Documentation

- Web Speech API `SpeechRecognition` continuous mode — the `onResult` callback fires with each utterance. Understand that `isFinal: true` is already filtered before we'd add the wake gate. MDN: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- `CustomEvent` pattern already used throughout codebase (`voice-nav-mode-changed`, `voice-app-open-mode-changed`) — use same pattern for `voice-wake-activated` / `voice-wake-expired`.

### Patterns to Follow

**Settings ref pattern** (from `voice-command-provider.tsx` lines 43–57):
```ts
// Read from localStorage immediately (no async wait) so ref is ready before first command
const requireWakePhraseRef = useRef<boolean>(
  (typeof window !== "undefined"
    ? localStorage.getItem("voiceSettings.requireWakePhrase") === "true"
    : false)
);
```

**API settings sync pattern** (from `voice-command-provider.tsx` lines 65–87):
```ts
useEffect(() => {
  fetch("/api/teacher-settings")
    .then((r) => (r.ok ? r.json() : { settings: {} }))
    .then((j) => {
      if (j.settings?.requireWakePhrase !== undefined) {
        const v = Boolean(j.settings.requireWakePhrase);
        requireWakePhraseRef.current = v;
        localStorage.setItem("voiceSettings.requireWakePhrase", String(v));
      }
    })
    .catch(() => {});
}, []);
```

**CustomEvent listener pattern** (from `voice-command-provider.tsx` lines 89–116):
```ts
useEffect(() => {
  function handleWakePhraseModeChange(e: Event) {
    const v = (e as CustomEvent<{ requireWakePhrase: boolean }>).detail.requireWakePhrase;
    requireWakePhraseRef.current = v;
  }
  window.addEventListener("require-wake-phrase-changed", handleWakePhraseModeChange);
  return () => window.removeEventListener("require-wake-phrase-changed", handleWakePhraseModeChange);
}, []);
```

**Context state pattern** (from `voice-queue.tsx` lines 125–126, 96):
```ts
// In VoiceQueueProvider:
const [wakeActive, setWakeActive] = useState(false);
// In context value + interface:
wakeActive: boolean;
setWakeActive: (v: boolean) => void;
```

**Settings card pattern** (from `settings/page.tsx` ~line 1178):
```tsx
<div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-medium text-slate-200">Voice wake phrase</p>
      <p className="text-xs text-slate-500 mt-0.5">
        Say "listen up" before commands to reduce false triggers in noisy classrooms
      </p>
    </div>
    <button type="button" onClick={toggleWakePhrase} className={...}>
      {settings.requireWakePhrase ? "On" : "Off"}
    </button>
  </div>
</div>
```

**Wake phrase constants** (define at top of `use-global-voice-commands.ts`):
```ts
const WAKE_PHRASES = [
  "listen up",
  "hey coach",
  "listen",
  "attention",
  "hey listen",
  "ok listen",
] as const;
const WAKE_TIMEOUT_MS = 6000; // 6 seconds — generous for teacher who may pause mid-thought
```

**Wake gate logic** (insert at start of `onResult` in `use-global-voice-commands.ts`):
```ts
if (requireWakePhraseRef.current) {
  const lower = rawTranscript.toLowerCase().trim();
  const isWakePhrase = WAKE_PHRASES.some((p) => lower.includes(p));
  if (isWakePhrase) {
    activateWake(); // plays chime, sets wakeActiveRef, starts 6s timer, fires event
    return; // consume — do not process the wake phrase itself as a command
  }
  if (!wakeActiveRef.current) return; // not awake — drop silently
  // Awake: extend the window (reset timer) then fall through to normal processing
  extendWake();
}
// ... existing nav match, speaker verify, board command, agent call ...
```

---

## IMPLEMENTATION PLAN

### Phase 1: DB + API (persistence layer)

Add `requireWakePhrase` to `teacherSettings` schema, generate migration, update API.

### Phase 2: Hook (wake gate logic)

Add wake phrase detection, `wakeActiveRef`, `activateWake()`, `extendWake()`, and `requireWakePhraseRef` to `useGlobalVoiceCommands`.

### Phase 3: Provider + Context (settings loading + UI state)

Load `requireWakePhrase` setting in `VoiceCommandProvider`. Add `wakeActive` / `setWakeActive` to `VoiceQueueContext`. Wire wake events to context state.

### Phase 4: UI (indicator + settings toggle)

Update `VoiceControls` in `nav-bar.tsx` to show pulsing indicator when `wakeActive`. Add settings card toggle.

---

## STEP-BY-STEP TASKS

### UPDATE `src/lib/db/schema.ts`

- **ADD** column to `teacherSettings` table (lines 69–92), after `voiceAppOpenMode`:
  ```ts
  requireWakePhrase: boolean("require_wake_phrase").notNull().default(false),
  ```
- **VALIDATE**: `npx tsc --noEmit`

### CREATE migration

- **RUN**: `npm run db:generate` — auto-generates SQL for the new column
- **RUN**: `npm run db:migrate` — applies to Neon DB
- **VALIDATE**: Confirm new file appears in `drizzle/` (e.g. `0008_require_wake_phrase.sql`)

### UPDATE `src/app/api/teacher-settings/route.ts`

- **ADD** `requireWakePhrase: z.boolean().optional()` to the PUT Zod schema (wherever `voiceAppOpenMode` is validated)
- **ADD** `requireWakePhrase` to the `db.update().set({...})` call in the PUT handler
- **ADD** `requireWakePhrase` to the GET response (it's returned as part of the settings object)
- **GOTCHA**: Read the existing file fully before editing — the Zod schema and update set may be in one or two places. Mirror exactly how `voiceAppOpenMode` was added.
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/hooks/use-global-voice-commands.ts`

- **ADD** constants near top of file (before the hook):
  ```ts
  const WAKE_PHRASES = ["listen up", "hey coach", "listen", "attention", "hey listen", "ok listen"] as const;
  const WAKE_TIMEOUT_MS = 6000;
  ```
- **ADD** `requireWakePhrase?: boolean` prop to `UseGlobalVoiceOptions` interface
- **ADD** inside the hook body (after existing refs):
  ```ts
  const requireWakePhraseRef = useRef(requireWakePhrase ?? false);
  useEffect(() => { requireWakePhraseRef.current = requireWakePhrase ?? false; }, [requireWakePhrase]);

  const wakeActiveRef = useRef(false);
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activateWake = useCallback(() => {
    wakeActiveRef.current = true;
    playActivationChime();
    window.dispatchEvent(new CustomEvent("voice-wake-activated"));
    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    wakeTimerRef.current = setTimeout(() => {
      wakeActiveRef.current = false;
      window.dispatchEvent(new CustomEvent("voice-wake-expired"));
    }, WAKE_TIMEOUT_MS);
  }, []);

  const extendWake = useCallback(() => {
    if (!wakeActiveRef.current) return;
    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    wakeTimerRef.current = setTimeout(() => {
      wakeActiveRef.current = false;
      window.dispatchEvent(new CustomEvent("voice-wake-expired"));
    }, WAKE_TIMEOUT_MS);
  }, []);
  ```
- **ADD** cleanup in the unmount `useEffect` (or a new one):
  ```ts
  useEffect(() => {
    return () => {
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    };
  }, []);
  ```
- **UPDATE** the `onResult` callback — at the very start of the `if (!isFinal) return;` block falling-through section, ADD the wake gate block (see "Wake gate logic" pattern above). Insert BEFORE the existing `navMatch` check. Navigation commands should still fire without wake phrase (they're safety nav, not risky commands) — only gate board commands and agent calls.

  **IMPORTANT ORDER**: The gate should apply to board commands and agent calls only. Navigation commands (go to coach, go to classes) should remain ungated so the teacher can always escape. Structure:
  ```ts
  // 1. Always: nav commands (no gate)
  const navMatch = ...;
  if (navMatch) { window.location.href = ...; return; }

  // 2. Wake phrase gate (if enabled)
  if (requireWakePhraseRef.current) {
    const lower = rawTranscript.toLowerCase().trim();
    const isWakePhrase = WAKE_PHRASES.some((p) => lower.includes(p));
    if (isWakePhrase) { activateWake(); return; }
    if (!wakeActiveRef.current) return; // drop
    extendWake(); // extend window on each command heard
  }

  // 3. Speaker verification (existing)
  if (!speakerVerified()) return;

  // 4. Board commands (existing)
  const boardCmd = matchBoardCommand(...);
  ...

  // 5. Voice agent (existing)
  onVoiceTranscriptRef.current?.(rawTranscript);
  ```
- **ADD** `playActivationChime` import from `@/lib/chime`
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/contexts/voice-queue.tsx`

- **ADD** `wakeActive: boolean` and `setWakeActive: (v: boolean) => void` to `VoiceQueueCtx` interface (after `agentThinking` at line 95–96)
- **ADD** `const [wakeActive, setWakeActive] = useState(false);` in `VoiceQueueProvider` (after `agentThinking` line 125)
- **ADD** both to the context provider value
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/components/voice/voice-command-provider.tsx`

- **ADD** `requireWakePhraseRef` with localStorage init (see "Settings ref pattern" above), after the existing `voiceAppOpenModeRef` ref (line ~53)
- **ADD** `requireWakePhrase` to the `useEffect` that fetches `/api/teacher-settings` (lines 65–87) — read `j.settings?.requireWakePhrase` and update ref + localStorage
- **ADD** event listener for `require-wake-phrase-changed` in the settings listener `useEffect` (lines 89–116)
- **ADD** `setWakeActive` to the destructure from `useVoiceQueue()` at the top
- **ADD** wake event listeners that sync to context:
  ```ts
  useEffect(() => {
    function onWakeActivated() { setWakeActive(true); }
    function onWakeExpired() { setWakeActive(false); }
    window.addEventListener("voice-wake-activated", onWakeActivated);
    window.addEventListener("voice-wake-expired", onWakeExpired);
    return () => {
      window.removeEventListener("voice-wake-activated", onWakeActivated);
      window.removeEventListener("voice-wake-expired", onWakeExpired);
    };
  }, [setWakeActive]);
  ```
- **UPDATE** `useGlobalVoiceCommands` call (line ~720) — add `requireWakePhrase: requireWakePhraseRef.current` prop. Since this is a ref value (not reactive), the prop should instead be read from the ref inside the hook (handled in the hook task above) — pass it as initial value only or use a `useState` synced from the ref.

  **GOTCHA**: `requireWakePhraseRef.current` at hook-call-time is the initial snapshot. Changes from settings events update the ref directly (no re-render needed) — the hook reads `requireWakePhraseRef.current` in the event handler closure, so it's always current. No need to re-pass on every render. Pass it only as initial:
  ```ts
  const { isListening, stop: stopGlobalNow } = useGlobalVoiceCommands({
    onBoardCommand: handleBoardCommand,
    onVoiceTranscript: callVoiceAgent,
    enabled: commandsEnabled && !lectureMicActive && !commsDictating,
    requireWakePhrase: requireWakePhraseRef.current, // initial value; hook keeps its own ref
  });
  ```
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/components/nav-bar.tsx`

- **ADD** `wakeActive` to the `useVoiceQueue()` destructure in `VoiceControls` (line 26)
- **UPDATE** the voice controls JSX — when `commandsEnabled && wakeActive`, show a cyan/teal pulsing dot + "Ready" text instead of the normal "Command" text:
  ```tsx
  // Insert as the first branch in the ternary (before `paused`):
  commandsEnabled && wakeActive ? (
    <>
      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
      Ready
    </>
  ) :
  ```
  The `animate-ping` Tailwind class gives a visible expanding pulse — distinct from the green `animate-pulse` that shows the mic is active.
- **GOTCHA**: Keep all existing branches intact. Just prepend the `wakeActive` check at the top of the conditional chain in the JSX.
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/app/(dashboard)/settings/page.tsx`

- **ADD** `requireWakePhrase: boolean` to the `Settings` type (lines 24–34)
- **ADD** wake phrase card in the voice settings section — insert after the "Voice app opens" card (line ~1209), before `<ScheduleManager />`:
  ```tsx
  <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-200">Wake phrase required</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Say "listen up" before commands to prevent noise from triggering them
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          const next = !settings.requireWakePhrase;
          setSettings((s) => (s ? { ...s, requireWakePhrase: next } : s));
          localStorage.setItem("voiceSettings.requireWakePhrase", String(next));
          window.dispatchEvent(
            new CustomEvent("require-wake-phrase-changed", {
              detail: { requireWakePhrase: next },
            }),
          );
          await fetch("/api/teacher-settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requireWakePhrase: next }),
          });
        }}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          settings.requireWakePhrase
            ? "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
            : "bg-slate-800 text-slate-400 hover:text-slate-200"
        }`}
      >
        {settings.requireWakePhrase ? "On" : "Off"}
      </button>
    </div>
  </div>
  ```
- **ADD** `requireWakePhrase: false` to the fallback/default in the fetch+set of settings (wherever settings are initialized from the API response)
- **VALIDATE**: `npx tsc --noEmit`

---

## TESTING STRATEGY

### Unit Tests

Add `src/lib/__tests__/wake-phrase.test.ts` — test the wake phrase matching logic (pure function):
```ts
const WAKE_PHRASES = ["listen up", "hey coach", "listen", "attention", "hey listen", "ok listen"];
// Test: "listen up class" matches
// Test: "listen up, give Jordan 10 bucks" matches
// Test: "give Jordan 10 bucks" does NOT match
// Test: "open iReady" does NOT match
```

### Edge Cases

- Teacher says "open classes" — should still navigate even without wake phrase (navigation is ungated)
- Teacher says "listen up open iReady" in one utterance — wake phrase is detected, window opens, but this utterance itself is dropped (next utterance triggers iReady)
- Wake phrase heard while `requireWakePhrase` is false — phrase passes through as a normal utterance to the voice agent (which will likely `ignore` it since it has no actionable intent)
- Back-to-back wake phrases — `activateWake()` resets the timer each time; 6s window restarts
- Lecture mic takes over mid-wake-window — `wakeActiveRef` stays true (timer keeps running); when lecture ends and globalVoice resumes, the window may still be open (acceptable — teacher can say wake phrase again)
- `requireWakePhrase` toggled off while window is active — `requireWakePhraseRef.current` becomes false; next utterance passes through without wake check (correct behavior)

---

## VALIDATION COMMANDS

### Level 1: Types
```bash
npx tsc --noEmit
```

### Level 2: Lint
```bash
npm run lint:fix
```

### Level 3: Unit Tests
```bash
npm run test:run
```

### Level 4: Manual Validation

1. Go to `/settings` → find "Wake phrase required" toggle → turn **On**
2. Go to `/coach` with voice commands enabled
3. Say a command (e.g. "open iReady") without wake phrase → verify nothing happens
4. Say "listen up" → verify cyan pulsing "Ready" indicator appears in nav + chime plays
5. Within 6 seconds, say "open iReady" → verify the portal opens
6. Wait 6+ seconds → say a command → verify nothing happens (window expired)
7. Say "listen up open iReady" in one breath → verify chime plays but iReady does NOT open (wake phrase consumed; need a second utterance)
8. Say "go to classes" (navigation) WITHOUT wake phrase → verify navigation still works
9. Turn wake phrase **Off** in settings → verify commands work without saying "listen up"

---

## ACCEPTANCE CRITERIA

- [ ] `requireWakePhrase` column added to `teacher_settings` (migration applied)
- [ ] Settings toggle saves to DB + localStorage + dispatches event
- [ ] With wake phrase ON: commands are blocked until "listen up" (or variant) is heard
- [ ] With wake phrase ON: navigation commands ("go to classes") still work without wake phrase
- [ ] Wake phrase detection plays activation chime + shows cyan "Ready" pulse in nav
- [ ] Active window expires after 6 seconds of inactivity
- [ ] Each command within the window resets/extends the 6-second timer
- [ ] With wake phrase OFF: existing always-on behavior is completely unchanged
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint:fix` passes with zero errors

---

## NOTES

- **Why navigation is ungated**: The teacher must always be able to navigate away (e.g., "go to coach" if something goes wrong). Gating navigation would make the feature a trap.
- **Why `extendWake()` on every command**: A teacher giving multiple voice commands in sequence ("listen up → give Jordan 10 bucks → give Marcus 5 bucks") shouldn't have to say "listen up" before each one. The window extends on every recognized command.
- **Wake phrase in the noise**: "listen" alone is a short trigger — might occasionally false-positive on student speech. If this is a problem, remove it from `WAKE_PHRASES` and require "listen up" or "hey coach" which are less common in student speech.
- **No custom phrase UI for v1**: The phrase list is hardcoded. A future enhancement could add a text field in settings. For now, "listen up" + variants covers the teacher's stated preference.
- **`animate-ping` vs `animate-pulse`**: `ping` (expanding ring) is visually distinct and universally understood as "actively listening". `pulse` (opacity fade) is used for the normal mic-active state.
- **Confidence Score**: 9/10 — all patterns are directly mirrored from existing code. Main risk: the `onResult` insertion point in `use-global-voice-commands.ts` must maintain exact order (nav first, gate second, board third, agent last) — read the current file carefully before editing.
