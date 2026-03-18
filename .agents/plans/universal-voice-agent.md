# Feature: Universal Voice Agent

Validate all patterns and file paths before implementing. Pay close attention to existing type names, import paths, and the mic manager singleton — it is not a React hook, it is module-level state.

## Feature Description

Replace the regex-based `parseCommand()` system with a Claude Haiku agent that understands any natural language classroom command. The agent receives every final speech utterance, determines intent, and returns a structured action to queue. Teachers speak naturally — "open the store," "Marcus was throwing things," "give Dogs 20 coins," "start the DI session" — and the agent handles all of it without wake words or rigid phrasing.

## User Story

As a 5th-grade math teacher
I want to control every aspect of my classroom by speaking naturally
So that I never have to touch the screen during instruction

## Problem Statement

The current regex parser (`parseCommand()`) only handles 5 command types with rigid phrase patterns. Teachers must remember exact phrasing, say a wake word ("coach"), and only limited app actions are reachable by voice. The orb push-to-talk routes to a different pipeline entirely. There is no intelligence — only pattern matching.

## Solution Statement

A Claude Haiku agent (`POST /api/coach/voice-agent`) receives every utterance with classroom context (student names, group names, session state). It classifies intent and returns one of ~15 structured action types. The existing queue drawer (confirm before execute) stays unchanged. Wake word requirement is removed. The orb push-to-talk stays as manual entry into the same agent pipeline.

## Feature Metadata

**Feature Type**: Enhancement (replaces parser, extends command vocabulary)
**Estimated Complexity**: Medium
**Primary Systems Affected**: `use-global-voice-commands.ts`, `voice-command-provider.tsx`, `contexts/voice-queue.tsx`, new API route
**Dependencies**: `@anthropic-ai/sdk` (already installed), existing mic manager

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/hooks/use-global-voice-commands.ts` — **REPLACE** `parseCommand()` call + strip wake-word logic entirely. Keep pitch verification and mic slot wiring. `onResult` currently calls `stripWakeWord()` then `parseCommand()` — after this feature, it calls the agent API instead.
- `src/contexts/voice-queue.tsx` — **EXTEND** `QueueItemData` union with ~10 new action types. Every new type must have a label in `queue-drawer.tsx` and an executor in `voice-command-provider.tsx`.
- `src/components/voice/voice-command-provider.tsx` — **EXTEND** `executeCommand()` with branches for each new action type. `handleCommand()` already handles `move_to_group` immediately (no queue) — pattern to follow for other immediate actions.
- `src/components/voice/queue-drawer.tsx` — **EXTEND** `itemIcon()` and `itemLabel()` and `itemSub()` for new types.
- `src/lib/rate-limit.ts` (lines 33–42) — **ADD** `voiceAgentLimiter` at 20 req/min. Follow exact pattern of existing limiters.
- `src/app/api/coach/behavior/route.ts` — Read request/response shape. New `behavior_log` action type calls `POST /api/classes/{classId}/behavior/incident` NOT this route.
- `src/app/api/classes/[id]/behavior/incident/route.ts` — The actual endpoint for logging incidents. Request: `{ rosterId, step?, notes?, sessionId? }`. Step auto-increments from profile if omitted.
- `src/app/api/classes/[id]/ram-bucks/route.ts` — `POST` with `{ rosterId, amount, type, reason }`. Type must be `"manual-award"` or `"manual-deduct"`.
- `src/app/api/classes/[id]/group-accounts/route.ts` — `POST` with `{ groupId, amount }`.
- `src/app/api/classes/[id]/groups/route.ts` — `DELETE` (no body) clears all memberships.
- `src/app/api/sessions/route.ts` — Check how sessions are created (`POST`). Need classId.
- `src/app/api/sessions/[id]/end/route.ts` — How sessions are ended.
- `src/app/api/teacher-settings/route.ts` — `PUT` with `{ storeIsOpen: boolean }` to open/close store.
- `src/hooks/use-board-voice.ts` — `BoardCommand` type and `matchBoardCommand()` — keep this working, agent does NOT replace board commands (those stay regex for speed).
- `src/lib/ai/coach.ts` — Pattern for Claude Haiku API call with structured JSON output. Mirror this pattern in the new route.

### New Files to Create

- `src/app/api/coach/voice-agent/route.ts` — The Haiku agent endpoint
- (No new hook files — modify existing)

### Patterns to Follow

**Claude API call pattern** (from `src/lib/ai/coach.ts`):
```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: userContent }],
});
const text = (response.content[0] as { type: "text"; text: string }).text;
const parsed = JSON.parse(text); // agent must output raw JSON, no markdown
```

**Rate limiter pattern** (from `src/lib/rate-limit.ts`):
```typescript
export const voiceAgentLimiter = createRateLimiter(20, 60_000);
```

**API route pattern** (from any existing route):
```typescript
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = voiceAgentLimiter.check(ip);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  // ... logic ...
  return NextResponse.json({ action });
}
```

**Immediate execution pattern** (from `voice-command-provider.tsx` lines 113–115):
```typescript
if (data.type === "move_to_group") {
  executeMoveToGroupRef.current(data.studentName, data.groupName);
  return; // skip enqueue
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Expand the Type System

Extend `QueueItemData` in `src/contexts/voice-queue.tsx` with all new action types. This is the source of truth — everything else derives from it.

### Phase 2: Voice Agent API

Create `POST /api/coach/voice-agent` — the Haiku agent that classifies utterances and returns a structured action.

### Phase 3: Modify Voice Command Hook

Remove wake word + `parseCommand()` from `use-global-voice-commands.ts`. Replace with async API call to voice-agent. Add "interpreting…" visual state.

### Phase 4: Extend Execution Layer

Add executors for all new action types in `voice-command-provider.tsx` and labels in `queue-drawer.tsx`.

### Phase 5: Orb Integration

Wire the orb push-to-talk through the same voice-agent API (currently it routes directly to behavior/academic AI based on inputMode — unify it).

---

## STEP-BY-STEP TASKS

---

### TASK 1: ADD new rate limiter — `src/lib/rate-limit.ts`

- **ADD** `export const voiceAgentLimiter = createRateLimiter(20, 60_000);` after existing limiters
- **PATTERN**: Follow exact pattern of `behaviorCoachLimiter` on line ~38
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 2: EXTEND `QueueItemData` — `src/contexts/voice-queue.tsx`

- **REPLACE** the current `QueueItemData` union with the expanded version below
- **KEEP** all existing types exactly as-is (consequence, ram_bucks, group_coins, parent_message, move_to_group)
- **ADD** these new union members:

```typescript
export type QueueItemData =
  // ── EXISTING (unchanged) ──────────────────────────────────────────────────
  | { type: "consequence"; studentName: string; step: number; stepLabel: string }
  | { type: "ram_bucks"; studentName: string; amount: number }
  | { type: "group_coins"; group: string; amount: number }
  | { type: "parent_message"; studentName: string; messageText: string }
  | { type: "move_to_group"; studentName: string; groupName: string }
  // ── NEW ───────────────────────────────────────────────────────────────────
  | { type: "behavior_log"; studentName: string; notes: string }
  | { type: "ram_bucks_deduct"; studentName: string; amount: number; reason: string }
  | { type: "clear_group"; groupName: string }
  | { type: "start_session" }
  | { type: "end_session" }
  | { type: "open_store" }
  | { type: "close_store" }
  | { type: "start_lecture" }
  | { type: "stop_lecture" }
  | { type: "navigate"; destination: "board" | "classes" | "settings" | "coach" | "store" | "gradebook" }
  | { type: "ask_coach"; question: string };
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 3: CREATE voice agent API — `src/app/api/coach/voice-agent/route.ts`

- **CREATE** new file with this structure:

**Request schema (Zod):**
```typescript
const schema = z.object({
  transcript: z.string().min(1).max(500),
  context: z.object({
    students: z.array(z.object({ rosterId: z.string(), displayName: z.string(), firstName: z.string().nullable() })),
    groups: z.array(z.object({ id: z.string(), name: z.string() })),
    hasActiveSession: z.boolean(),
    storeIsOpen: z.boolean(),
    isLectureActive: z.boolean(),
  }),
});
```

**System prompt** — instruct Haiku to output raw JSON matching the action schema. Key rules:
- Output ONLY valid JSON, no markdown, no explanation
- If the utterance is ambient noise / not a command / conversational, return `{ "type": "ignore" }`
- Behavior observation about a student (not an explicit consequence) → `behavior_log`
- Explicit consequence phrase ("give X a warning", "X gets detention") → `consequence`
- `step` values for consequences: warning/fine=1, no games=2, no pe=3, silent lunch=4, call home=5, write up=6, detention=7, saturday school=8
- Navigation: map "go to board", "open classes", etc. to `navigate` with correct destination

**Full action schema to include in system prompt:**
```
{ "type": "ignore" }
{ "type": "consequence", "studentName": string, "step": 1-8, "stepLabel": string }
{ "type": "ram_bucks", "studentName": string, "amount": number }
{ "type": "ram_bucks_deduct", "studentName": string, "amount": number, "reason": string }
{ "type": "group_coins", "group": string, "amount": number }
{ "type": "parent_message", "studentName": string, "messageText": string }
{ "type": "move_to_group", "studentName": string, "groupName": string }
{ "type": "behavior_log", "studentName": string, "notes": string }
{ "type": "clear_group", "groupName": string }
{ "type": "start_session" }
{ "type": "end_session" }
{ "type": "open_store" }
{ "type": "close_store" }
{ "type": "start_lecture" }
{ "type": "stop_lecture" }
{ "type": "navigate", "destination": "board"|"classes"|"settings"|"coach"|"store"|"gradebook" }
{ "type": "ask_coach", "question": string }
```

**User message format:**
```
Teacher said: "[transcript]"

Class context:
- Students: [comma-separated displayNames]
- Groups: [Dogs, Cats, Birds, Bears]
- Active session: [yes/no]
- Store: [open/closed]
- Lecture recording: [on/off]
```

**Response:** Return `{ action: VoiceAction }` where `VoiceAction` is the parsed JSON.

- **IMPORTS**: `import Anthropic from "@anthropic-ai/sdk"`, `import { z } from "zod"`, `import { auth } from "@/lib/auth/server"`, `import { voiceAgentLimiter } from "@/lib/rate-limit"`
- **GOTCHA**: Wrap `JSON.parse(text)` in try/catch. Return `{ action: { type: "ignore" } }` on parse failure. Never throw — voice agent failure must be silent.
- **GOTCHA**: Max tokens 256 — the output is small structured JSON, not prose.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 4: ADD TypeScript type for VoiceAction — `src/app/api/coach/voice-agent/route.ts`

- **ADD** export of `VoiceAction` type at the bottom of the new route file (mirrors `QueueItemData` but includes `"ignore"` type):

```typescript
export type VoiceAction =
  | { type: "ignore" }
  | QueueItemData;
```

- **IMPORT** `QueueItemData` from `@/contexts/voice-queue`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 5: MODIFY `useGlobalVoiceCommands` — `src/hooks/use-global-voice-commands.ts`

This is the most critical change. The `onResult` callback currently:
1. Calls `stripWakeWord()` → returns null if no wake word
2. Calls `parseCommand()` → regex matching
3. Falls back to `matchBoardCommand()`

**REPLACE** steps 1 and 2. Keep step 3 (board commands stay regex for speed).

**New `onResult` flow:**
```typescript
onResult: (rawTranscript, isFinal) => {
  if (!isFinal) return;
  onHeardRef.current?.(rawTranscript);
  if (!speakerVerified()) return;

  // Board commands stay regex (instant, no API call)
  const boardCmd = matchBoardCommand(rawTranscript.toLowerCase().trim());
  if (boardCmd) {
    onBoardCommandRef.current?.(boardCmd, rawTranscript);
    return;
  }

  // Everything else → voice agent
  onVoiceTranscriptRef.current?.(rawTranscript);
},
```

- **ADD** `onVoiceTranscript?: (transcript: string) => void` to `UseGlobalVoiceOptions` interface
- **ADD** `onVoiceTranscriptRef` ref alongside existing refs
- **REMOVE** `stripWakeWord()`, `parseCommand()`, `CONSEQUENCE_MAP`, `WORD_TO_NUM`, `extractNumber`, `titleCase`, `GROUPS` constants — these are no longer needed
- **REMOVE** the `parseCommand` export (it was exported — check if used elsewhere first)
- **KEEP** pitch verification logic (lines 221–283) — unchanged
- **KEEP** `VOICE_WAKE_WORD_KEY`, `DEFAULT_WAKE_WORD` exports — settings page may reference them; if not used elsewhere, remove
- **GOTCHA**: Check if `parseCommand` is imported anywhere besides `voice-command-provider.tsx` before removing. Run: `grep -r "parseCommand" src/`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 6: EXTEND `VoiceCommandProvider` — `src/components/voice/voice-command-provider.tsx`

**6a: Add agent caller function**

```typescript
const callVoiceAgent = useCallback(async (transcript: string) => {
  const classId = activeClassIdRef.current;
  // Gather context
  const [studentsRes, groupsRes, settingsRes] = await Promise.all([
    classId ? fetch(`/api/classes/${classId}/roster-overview`) : Promise.resolve(null),
    classId ? fetch(`/api/classes/${classId}/groups`) : Promise.resolve(null),
    fetch("/api/teacher-settings"),
  ]);
  const students = studentsRes?.ok ? (await studentsRes.json()).students ?? [] : [];
  const groups = groupsRes?.ok ? (await groupsRes.json()).groups ?? [] : [];
  const settings = settingsRes?.ok ? (await settingsRes.json()).settings : {};

  const res = await fetch("/api/coach/voice-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      context: {
        students: students.map((s: { rosterId: string; displayName: string; firstName: string | null }) => ({
          rosterId: s.rosterId,
          displayName: s.displayName,
          firstName: s.firstName,
        })),
        groups: groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })),
        hasActiveSession: false, // TODO: wire from context if needed
        storeIsOpen: settings?.storeIsOpen ?? false,
        isLectureActive: lectureMicActive,
      },
    }),
  });
  if (!res.ok) return;
  const { action } = await res.json() as { action: import("@/app/api/coach/voice-agent/route").VoiceAction };
  if (action.type === "ignore") return;
  handleCommand(action, transcript);
}, [handleCommand, lectureMicActive]);
```

- **GOTCHA**: Context fetching adds ~200-400ms. It's acceptable since teacher sees agent "thinking". Cache student/group lists in a ref updated periodically to avoid fetching every utterance.
- **BETTER APPROACH**: Pass context as a prop or via a ref that the coach page keeps updated. See 6b.

**6b: Add context ref for performance**

Instead of fetching context on every utterance, accept optional context via prop or maintain a module-level cache:

```typescript
// In VoiceCommandProvider props or via a new context registration
const agentContextRef = useRef<AgentContext>({ students: [], groups: [], storeIsOpen: false, isLectureActive: false });

export function VoiceCommandProvider({ children }: { children: React.ReactNode }) {
  // Add a registerAgentContext function to the VoiceQueueCtx or handle internally
```

**Simpler approach**: Just fetch on each call — it's fast (local API, cached by Next.js). The 200ms is fine since Haiku itself takes 500-1000ms. Students/groups lists are small.

**6c: Wire `onVoiceTranscript` in `useGlobalVoiceCommands` call**

```typescript
const { isListening, stop: stopGlobalNow } = useGlobalVoiceCommands({
  onCommand: handleCommand,          // kept for direct moves still triggered by board
  onBoardCommand: handleBoardCommand,
  onVoiceTranscript: callVoiceAgent, // NEW — every non-board utterance
  enabled: commandsEnabled && !lectureMicActive && !commsDictating,
});
```

**6d: Extend `executeCommand()` with new action branches**

Add after the existing `move_to_group` branch:

```typescript
} else if (d.type === "behavior_log") {
  const student = await resolveStudent(classId, d.studentName);
  if (!student) { toast.error(`Student "${d.studentName}" not found`); dismiss(item.id); return; }
  const res = await fetch(`/api/classes/${classId}/behavior/incident`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rosterId: student.rosterId, notes: d.notes }),
  });
  if (!res.ok) throw new Error("Failed");
  toast.success(`Behavior logged for ${d.studentName}`);
  confirm(item.id);

} else if (d.type === "ram_bucks_deduct") {
  const student = await resolveStudent(classId, d.studentName);
  if (!student) { toast.error(`Student "${d.studentName}" not found`); dismiss(item.id); return; }
  const res = await fetch(`/api/classes/${classId}/ram-bucks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rosterId: student.rosterId, amount: -Math.abs(d.amount), type: "manual-deduct", reason: d.reason }),
  });
  if (!res.ok) throw new Error("Failed");
  toast.success(`-${d.amount} RAM Bucks from ${d.studentName}`);
  confirm(item.id);

} else if (d.type === "clear_group") {
  // Resolve group name → clear all memberships via DELETE /api/classes/{id}/groups
  // Note: current DELETE clears ALL groups. If user says "clear Bears", we need per-group clear.
  // Per-group clear: DELETE /api/classes/{id}/groups/{groupId} already removes one student.
  // For full group clear: loop through members and DELETE each, or add a dedicated endpoint.
  // SIMPLEST: call DELETE /api/classes/{id}/groups (clears all) if no group name match found.
  // BETTER: Add PATCH /api/classes/{id}/groups with { action: "clear-group", groupName } in a follow-up.
  // For now: resolve group → loop delete all members
  const res = await fetch(`/api/classes/${classId}/groups`);
  const { groups } = await res.json();
  const group = groups.find((g: { name: string; id: string }) => g.name.toLowerCase() === d.groupName.toLowerCase());
  if (!group) { toast.error(`Group "${d.groupName}" not found`); dismiss(item.id); return; }
  // Delete all members from this group
  const memberRes = await fetch(`/api/classes/${classId}/groups`);
  const { groups: fullGroups } = await memberRes.json();
  const targetGroup = fullGroups.find((g: { id: string; name: string; members: { rosterId: string }[] }) => g.id === group.id);
  if (targetGroup?.members?.length) {
    await Promise.all(
      targetGroup.members.map((m: { rosterId: string }) =>
        fetch(`/api/classes/${classId}/groups/${group.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rosterId: m.rosterId }),
        })
      )
    );
  }
  toast.success(`${d.groupName} group cleared`);
  window.dispatchEvent(new CustomEvent("group-assignment-changed"));
  confirm(item.id);

} else if (d.type === "open_store") {
  await fetch("/api/teacher-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeIsOpen: true }),
  });
  toast.success("Store is now open");
  confirm(item.id);

} else if (d.type === "close_store") {
  // Fetch current settings first to avoid overwriting other fields
  const current = await fetch("/api/teacher-settings").then(r => r.json());
  await fetch("/api/teacher-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...current.settings, storeIsOpen: false }),
  });
  toast.success("Store is now closed");
  confirm(item.id);

} else if (d.type === "start_session" || d.type === "end_session" || d.type === "start_lecture" || d.type === "stop_lecture") {
  // These require coordination with the coach page UI
  // Dispatch custom events that the coach page listens for
  window.dispatchEvent(new CustomEvent(`voice-${d.type}`));
  toast.success(d.type === "start_session" ? "Starting session…" : d.type === "end_session" ? "Ending session…" : d.type === "start_lecture" ? "Starting lecture recording…" : "Stopping lecture recording…");
  confirm(item.id);

} else if (d.type === "navigate") {
  window.location.href = `/${d.destination === "coach" ? "coach" : d.destination}`;
  confirm(item.id);

} else if (d.type === "ask_coach") {
  // Dispatch event for coach page to pick up
  window.dispatchEvent(new CustomEvent("voice-ask-coach", { detail: { question: d.question } }));
  confirm(item.id);
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 7: EXTEND Queue Drawer — `src/components/voice/queue-drawer.tsx`

**Extend `itemIcon()`** — add cases for all new types:
```typescript
case "behavior_log": return <AlertCircleIcon className="h-4 w-4 text-orange-400" />;
case "ram_bucks_deduct": return <MinusCircleIcon className="h-4 w-4 text-red-400" />;
case "clear_group": return <Trash2Icon className="h-4 w-4 text-red-400" />;
case "start_session": case "end_session": return <PlayCircleIcon className="h-4 w-4 text-emerald-400" />;
case "open_store": case "close_store": return <ShoppingBagIcon className="h-4 w-4 text-amber-400" />;
case "start_lecture": case "stop_lecture": return <MicIcon className="h-4 w-4 text-blue-400" />;
case "navigate": return <ArrowRightIcon className="h-4 w-4 text-slate-400" />;
case "ask_coach": return <GraduationCapIcon className="h-4 w-4 text-indigo-400" />;
```

**Extend `itemLabel()`:**
```typescript
case "behavior_log": return `Log behavior — ${d.studentName}`;
case "ram_bucks_deduct": return `-${d.amount} RAM Bucks — ${d.studentName}`;
case "clear_group": return `Clear ${d.groupName} group`;
case "start_session": return "Start class session";
case "end_session": return "End class session";
case "open_store": return "Open the store";
case "close_store": return "Close the store";
case "start_lecture": return "Start lecture recording";
case "stop_lecture": return "Stop lecture recording";
case "navigate": return `Go to ${d.destination}`;
case "ask_coach": return `Ask coach: "${d.question.slice(0, 40)}…"`;
```

**Extend `itemSub()`** — add cases that show meaningful sub-text:
```typescript
case "behavior_log": return d.notes;
case "ram_bucks_deduct": return d.reason;
// default stays: `Heard: "${item.transcript}"`
```

- **IMPORTS** needed: Add `MinusCircleIcon`, `Trash2Icon`, `PlayCircleIcon`, `ShoppingBagIcon`, `ArrowRightIcon`, `GraduationCapIcon` from `lucide-react`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 8: WIRE session/lecture events in coach page — `src/app/(dashboard)/coach/page.tsx`

The voice agent dispatches `CustomEvent` for session/lecture control. The coach page must listen:

**ADD** these effects in the coach page component:

```typescript
// Voice agent → start/end session
useEffect(() => {
  function handleVoiceStartSession() {
    // Trigger the same flow as clicking "Start Session" button
    // Find the existing session start handler and call it
  }
  function handleVoiceEndSession() {
    // Trigger end session
  }
  function handleVoiceStartLecture() {
    if (!isListening) {
      autoCommandRef.current = false;
      stopCommandsNow();
      setIsOrbRecording(false);
      playActivationChime();
      setTimeout(startListening, 350);
    }
  }
  function handleVoiceStopLecture() {
    if (isListening) stopListening();
  }
  function handleVoiceAskCoach(e: Event) {
    const question = (e as CustomEvent<{ question: string }>).detail.question;
    sendAcademic(question);
    setInputMode("ask");
  }
  window.addEventListener("voice-start_session", handleVoiceStartSession);
  window.addEventListener("voice-end_session", handleVoiceEndSession);
  window.addEventListener("voice-start_lecture", handleVoiceStartLecture);
  window.addEventListener("voice-stop_lecture", handleVoiceStopLecture);
  window.addEventListener("voice-ask-coach", handleVoiceAskCoach);
  return () => {
    window.removeEventListener("voice-start_session", handleVoiceStartSession);
    window.removeEventListener("voice-end_session", handleVoiceEndSession);
    window.removeEventListener("voice-start_lecture", handleVoiceStartLecture);
    window.removeEventListener("voice-stop_lecture", handleVoiceStopLecture);
    window.removeEventListener("voice-ask-coach", handleVoiceAskCoach);
  };
}, [isListening, startListening, stopListening, stopCommandsNow, sendAcademic]);
```

- **GOTCHA**: `coach/page.tsx` is large (1400+ lines) and tab-indented. Use targeted edits, not rewrites.
- **GOTCHA**: `sendAcademic` and `setInputMode` must be in scope. They are — check the existing call sites in the file.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 9: WIRE orb push-to-talk through agent

Currently the orb (`useMicSlot("orb", orbConfig)`) routes directly to `sendAcademic`, `sendBehavior`, or `diDispatch` based on `inputMode`. Change it to route through the voice agent instead when `inputMode` is not `"di"`.

In `coach/page.tsx`, update `orbConfig.onResult`:
```typescript
onResult: (t: string, isFinal: boolean) => {
  if (!isFinal || !t.trim()) return;
  if (inputModeRef.current === "di" && diDispatchRef.current) {
    diDispatchRef.current(t);  // DI stays direct — it has its own voice route
  } else {
    // Route through voice agent (dispatches to VoiceCommandProvider)
    window.dispatchEvent(new CustomEvent("orb-transcript", { detail: { transcript: t } }));
  }
},
```

In `VoiceCommandProvider`, listen for `"orb-transcript"`:
```typescript
useEffect(() => {
  function handleOrbTranscript(e: Event) {
    const transcript = (e as CustomEvent<{ transcript: string }>).detail.transcript;
    callVoiceAgent(transcript);
  }
  window.addEventListener("orb-transcript", handleOrbTranscript);
  return () => window.removeEventListener("orb-transcript", handleOrbTranscript);
}, [callVoiceAgent]);
```

- **GOTCHA**: The orb previously showed teacher's spoken text in the behavior chat. After this change, behavior observations go to the agent which queues a `behavior_log` instead of calling `sendBehavior()` directly. The behavior chat history becomes agent-driven. The existing `sendBehavior` function can remain for direct typed input.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 10: ADD "interpreting…" visual feedback

When the agent is processing, show a subtle indicator so the teacher knows something is happening.

**ADD** to `VoiceQueueCtx` in `voice-queue.tsx`:
```typescript
agentThinking: boolean;
setAgentThinking: (v: boolean) => void;
```

**In `callVoiceAgent`** (voice-command-provider.tsx):
```typescript
setAgentThinking(true);
try {
  // ... fetch call ...
} finally {
  setAgentThinking(false);
}
```

**In `nav-bar.tsx` `VoiceControls`**, show a pulsing indicator when `agentThinking`:
```tsx
{agentThinking && (
  <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
)}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 11: REMOVE dead code

After all above tasks pass type check:

- Remove `parseCommand` function from `use-global-voice-commands.ts` (if not used elsewhere)
- Remove `stripWakeWord` function (no longer called)
- Remove `CONSEQUENCE_MAP`, `WORD_TO_NUM`, `extractNumber`, `titleCase`, `GROUPS` constants
- Remove `VOICE_WAKE_WORD_KEY` and `DEFAULT_WAKE_WORD` exports only if nothing imports them

**CHECK BEFORE REMOVING**:
```bash
grep -r "parseCommand\|stripWakeWord\|VOICE_WAKE_WORD_KEY\|DEFAULT_WAKE_WORD" src/
```

- **VALIDATE**: `npx tsc --noEmit && npm run lint`

---

## TESTING STRATEGY

### Manual Validation Flow

After implementation, test each command type in the browser:

1. Say "give Marcus 5 RAM bucks" → should queue `ram_bucks`
2. Say "Marcus was talking during my lesson" → should queue `behavior_log` with notes
3. Say "give Marcus a warning" → should queue `consequence` step 1
4. Say "put Aaliyah in the Dogs group" → should execute immediately (`move_to_group`)
5. Say "give Dogs 20 coins" → should queue `group_coins`
6. Say "clear the Bears group" → should queue `clear_group`
7. Say "open the store" → should queue `open_store`
8. Say "start lecture recording" → should queue `start_lecture`
9. Say "go to the board" → should queue `navigate` destination=board
10. Say "what's a good way to explain fractions" → should queue `ask_coach`
11. Say something ambient like "okay class let's start" → should produce no queue item
12. Board commands like "switch to resources" → should still fire instantly (regex, no agent)

### Edge Cases to Test

- Student name with apostrophe: "De'Andre got detention"
- Group with trailing s: "give dogs 10 coins" → Dogs group
- No active class selected → agent call still works, execution shows error toast
- Very long utterance (> 500 chars) → Zod rejects, silent fail
- Network error during agent call → silent fail (no crash)
- Agent returns malformed JSON → silent fail (try/catch returns ignore)

---

## VALIDATION COMMANDS

```bash
# Level 1: Type check
npx tsc --noEmit

# Level 2: Lint
npm run lint

# Level 3: Unit tests (if any cover voice parsing)
npm run test:run

# Level 4: Manual
# Open http://localhost:3000/coach
# Enable microphone permissions
# Run through all 12 manual test cases above
```

---

## ACCEPTANCE CRITERIA

- [ ] No wake word required — all utterances evaluated by agent
- [ ] Ambient speech ("okay class") produces no queue item
- [ ] All 12 manual test cases produce correct queue items
- [ ] Board commands still fire instantly via regex (not agent)
- [ ] Orb push-to-talk routes through agent (not directly to behavior chat)
- [ ] "interpreting…" visual shows while agent is running
- [ ] Queue drawer shows correct icons + labels for all new action types
- [ ] All executors work: behavior_log, ram_bucks_deduct, clear_group, open_store, close_store, navigate
- [ ] Lecture start/stop via voice works through custom events
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Existing consequence/ram_bucks/group_coins execution unchanged

---

## NOTES

**Why keep board commands as regex?**
Board commands need instant response (teacher says "switch to resources" mid-presentation). The ~1s agent delay is noticeable there. Regex is 0ms. Keep them fast.

**Why keep queue drawer?**
Teacher confirmation prevents misheard commands (student in background says "give me 100 bucks"). The queue is a safety net that the teacher opted to keep.

**Context caching (future optimization)**
Currently context is fetched on every utterance. If this becomes slow, cache students/groups in a `useRef` in `VoiceCommandProvider` and refresh every 30s or on `"group-assignment-changed"` events.

**`start_session` / `end_session` complexity**
Creating a session requires POSTing to `/api/sessions` with a classId. The coach page already has session creation logic. Wiring this via custom events keeps the voice provider decoupled. The coach page event handler should reuse its existing session create/end functions.

**Teacher Settings `PUT` body**
The teacher-settings `PUT` requires ALL settings fields (it's a full replace, not a patch). Always fetch current settings before updating a single field like `storeIsOpen`. See Task 6d.

**Confidence Score: 8/10**
High confidence. All integration points are mapped. Main risk: the `coach/page.tsx` event handlers need to correctly tap into existing handler functions without duplicating logic — read that file carefully before Task 8.
