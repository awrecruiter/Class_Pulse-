# UI Redesign Plan — Teacher Cockpit (Voice Orb + Dashboard)

> Based on visual research of ClassDojo, Duolingo, Khan Academy, Apple Siri (iOS 18), ChatGPT Voice, and ElevenLabs orb patterns.

---

## Problems with Current UI

1. **Voice orb** — static amber circle with mic icon. No gradient, no animation, no glow. Looks like a plain button.
2. **Background** — white/light theme flattens any glow effect entirely. Dark background is required for orb to pop.
3. **Layout** — single-column scroll. Everything stacks vertically, no spatial hierarchy for a cockpit meant to be used hands-free during class.
4. **Student chips** — amber background chips are cute but lack live behavior state at a glance.
5. **No visual language** — no cohesive color system for behavior severity, groups, or currency.

---

## Design Direction: "Dark Cockpit"

Inspired by Apple Intelligence, ChatGPT Voice Mode, and ElevenLabs — use a **dark slate-900 background** so the glowing orb gradients pop dramatically. Think mission control, not a classroom worksheet.

---

## Color System

### Base Surfaces (dark cockpit)
```
bg-slate-950   — page background
bg-slate-900   — panel background
bg-slate-800   — card / chip background
bg-slate-700   — hover / elevated card
border-slate-700 — borders
text-slate-200 — primary text
text-slate-400 — muted/label text
```

### Brand (replaces amber as primary for AI elements)
```
indigo-500 / #6366F1   — primary brand (AI forward, professional)
violet-500 / #8B5CF6   — secondary (Siri gradient partner)
```

### RAM Bucks (keep amber — it's universally "coins" in ed-tech)
```
amber-400 / #FBBF24    — buck balance number
amber-500 / #F59E0B    — buck award chips
amber-100/20           — chip background (dark mode: amber-500/20)
```

### Behavior Ladder (ClassDojo convention — teachers already know this)
```
Step 0      — emerald-500  #10B981  (all good)
Step 1–2    — amber-500    #F59E0B  (warning)
Step 3–4    — orange-500   #F97316  (escalating)
Step 5–6    — red-500      #EF4444  (call home / write-up)
Step 7–8    — violet-700   #6D28D9  (detention / Saturday — qualitative jump)
```

### Student Group Colors (Dogs/Cats/Birds/Bears)
```
Dogs   — blue-500    #3B82F6
Cats   — pink-500    #EC4899
Birds  — emerald-500 #10B981
Bears  — orange-500  #F97316
```

---

## The Siri-Style Voice Orb

### How it works (Siri / ChatGPT / ElevenLabs pattern)

The orb has **4 states**: `idle | listening | thinking | speaking`

Each state has:
- A **conic-gradient rotating ring** (the outer Siri rainbow border)
- A **blurred ambient halo** behind the orb (the glow that bleeds outward)
- A **solid gradient sphere** in the center (reveals the ring at the edges via `inset: 3px`)
- A `box-shadow` that pulses with intensity based on state

### State Color Mapping

| State     | Ring Colors                          | Description                          |
|-----------|--------------------------------------|--------------------------------------|
| idle      | indigo → violet → purple             | Slow 4s breathing scale              |
| listening | teal → blue → indigo                 | Faster 1.5s pulse, moderate glow     |
| thinking  | amber → orange → pink                | Hue-rotate spin (processing feel)    |
| speaking  | pink → purple → indigo               | Fast 0.6s pulse, max glow            |

### CSS Animations Required

Add to `src/app/globals.css`:

```css
@property --orb-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

@keyframes orb-ring-slow {
  to { --orb-angle: 360deg; }
}
@keyframes orb-ring-fast {
  to { --orb-angle: 360deg; }
}
@keyframes orb-idle {
  0%, 100% { transform: scale(1);    }
  50%       { transform: scale(1.04); }
}
@keyframes orb-listen {
  0%, 100% { transform: scale(1);    }
  50%       { transform: scale(1.10); }
}
@keyframes orb-speak {
  0%, 100% { transform: scale(1);    }
  50%       { transform: scale(1.14); }
}
@keyframes orb-think {
  0%   { filter: hue-rotate(0deg);   }
  100% { filter: hue-rotate(360deg); }
}
@keyframes blob-morph {
  0%,100% { border-radius: 50%; }
  25%     { border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%; }
  50%     { border-radius: 45% 55% 40% 60% / 55% 45% 60% 40%; }
  75%     { border-radius: 55% 45% 60% 40% / 45% 55% 40% 60%; }
}
@keyframes glow-breathe {
  0%, 100% { opacity: 0.5; transform: scale(1.1);  }
  50%       { opacity: 0.9; transform: scale(1.25); }
}
```

### Component: `VoiceOrb`

New file: `src/components/coach/voice-orb.tsx`

```tsx
type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

const ORB_CONFIG = {
  idle:      { ring: '#818CF8, #A78BFA, #6366F1', glow: 'rgba(99,102,241,0.3)',  bodyClass: 'from-indigo-500 via-violet-500 to-purple-600',  scaleAnim: '[animation:orb-idle_4s_ease-in-out_infinite]',  ringSpeed: '[animation:orb-ring-slow_4s_linear_infinite]'  },
  listening: { ring: '#2DD4BF, #60A5FA, #818CF8', glow: 'rgba(20,184,166,0.45)', bodyClass: 'from-teal-400 via-blue-500 to-indigo-600',        scaleAnim: '[animation:orb-listen_1.5s_ease-in-out_infinite]', ringSpeed: '[animation:orb-ring-slow_2s_linear_infinite]'  },
  thinking:  { ring: '#FBBF24, #F97316, #EC4899', glow: 'rgba(251,146,60,0.4)',  bodyClass: 'from-amber-400 via-orange-500 to-pink-500',        scaleAnim: '[animation:orb-think_2s_linear_infinite]',      ringSpeed: '[animation:orb-ring-fast_1s_linear_infinite]'  },
  speaking:  { ring: '#F472B6, #A78BFA, #818CF8', glow: 'rgba(168,85,247,0.5)',  bodyClass: 'from-pink-500 via-purple-500 to-indigo-500',       scaleAnim: '[animation:orb-speak_0.6s_ease-in-out_infinite]', ringSpeed: '[animation:orb-ring-fast_0.8s_linear_infinite]' },
};
```

The orb renders:
1. **Ambient halo** — blurred `bg-gradient-to-br` copy at `scale-125`, `blur-xl`, `animate-[glow-breathe]`
2. **Conic ring** — `absolute inset-[-4px] rounded-full` with inline `background: conic-gradient(from var(--orb-angle), ...)` + ring speed animation
3. **Body sphere** — `absolute inset-[3px] rounded-full bg-gradient-to-br` with scale animation + blob-morph when active
4. **Inner shine** — `absolute inset-[20%] rounded-full bg-white/10 blur-sm` (Siri glass effect)

---

## Cockpit Layout: 3-Column Grid

### Desktop (≥1280px): Three columns

```
┌─────────────────────────────────────────────────┐
│  TOP BAR: Class · Timer · 🐏 Total bucks · Nav  │
├──────────┬──────────────────────┬────────────────┤
│  LEFT    │      CENTER          │     RIGHT      │
│  280px   │       flex-1         │    340px       │
│          │                      │                │
│  Roster  │  ┌──────────────┐    │  Coach feed    │
│  (scroll)│  │  VOICE ORB   │    │  (messages)    │
│          │  │   (lg)       │    │                │
│  ──────  │  └──────────────┘    │  ─────────     │
│  Group   │                      │  Active        │
│  Panels  │  Quick chips row     │  student card  │
│          │  ─────────────────   │                │
│          │  Last narration      │  ─────────     │
│          │  display             │  Parent msgs   │
│          │                      │  pending       │
└──────────┴──────────────────────┴────────────────┘
```

### Mobile / Tablet: Stacked (current behavior preserved)

On `< lg` screens, panels stack vertically. Orb stays centered with `size="md"`.

### Grid CSS

```tsx
// coach/page.tsx outer wrapper:
<div className="min-h-screen bg-slate-950 flex flex-col">
  <TopBar />
  <div className="flex-1 grid lg:grid-cols-[280px_1fr_340px] overflow-hidden">
    <LeftRoster />
    <CenterCockpit />
    <RightFeed />
  </div>
</div>
```

---

## Student Chips: Redesigned

Current: amber background, emoji animal, RAM buck count.
New: compact dark card with a **live behavior dot** (colored per step), group color accent, initials avatar.

```
┌─────────────────────────────┐
│ ● [JM] J.M.    🐏 42        │
│   (dot)(avatar)(name)(bucks)│
└─────────────────────────────┘
```

- Behavior dot: 8px circle, color from behavior ladder palette above
- Selected state: `ring-2 ring-indigo-500 bg-indigo-500/10`
- Step 5+: dot pulses with `animate-pulse`

---

## Quick Action Chips: Redesigned

Current: colorful rounded-full light-bg pills.
New: **dark transparent chips with colored borders** (glassmorphism style).

```tsx
// Example chip style:
'rounded-full border px-3 py-1.5 text-xs font-semibold
 bg-amber-500/10 border-amber-500/40 text-amber-300
 hover:bg-amber-500/20 active:scale-95 transition-all'
```

| Chip        | Color                                    |
|-------------|------------------------------------------|
| + Reward    | amber (bg-amber-500/10, text-amber-300)  |
| ⚠ Step Up   | orange (bg-orange-500/10, text-orange-300)|
| 📞 Call Home| red (bg-red-500/10, text-red-300)        |
| 📊 Guidance | indigo (bg-indigo-500/10, text-indigo-300)|
| ✏️ Type     | slate (bg-slate-700, text-slate-300)     |

---

## Message Feed: Redesigned

Current: white cards with amber borders.
New: dark slate cards with **left-border color-coding** by event type.

```tsx
'rounded-lg p-3 bg-slate-800/60 border-l-2 border-solid'

// Color variants:
border-amber-500   → RAM Buck award
border-red-500     → Behavior incident
border-emerald-500 → Positive/note
border-violet-500  → Parent message
```

Teacher bubble: `bg-indigo-600 text-white rounded-xl rounded-tr-sm`
Coach bubble: `bg-slate-800 text-slate-200 border border-slate-600 rounded-xl rounded-tl-sm`

---

## Files to Create/Modify

| File | Action | What changes |
|------|--------|--------------|
| `src/app/globals.css` | Edit | Add `@property --orb-angle`, `@keyframes` for orb |
| `src/components/coach/voice-orb.tsx` | Create | New Siri-style orb component |
| `src/components/coach/behavior-panel.tsx` | Edit | Replace amber orb with `<VoiceOrb>`, dark chip/card styles, 3-col layout support |
| `src/app/(dashboard)/coach/page.tsx` | Edit | Wrap in dark cockpit layout, inject `<VoiceOrb>`, 3-col grid |

---

## Implementation Order

1. `globals.css` — Add @property + keyframes (no component changes, safe first step)
2. `voice-orb.tsx` — Build the orb component in isolation
3. `behavior-panel.tsx` — Replace orb, restyle chips and feed
4. `coach/page.tsx` — Apply 3-col layout, dark background, integrate VoiceOrb in center cockpit
5. Visual QA — Check on mobile (should stack gracefully)

---

## What Does NOT Change

- All behavior logic, API calls, student selection — unchanged
- Student chip data (rosterId, balance, behaviorStep) — same
- Quick action chip functions (applyChip, handleSend) — same
- Message log state/history — same
- Only the **visual presentation** changes

---

## Reference Implementations

- Siri iOS 18 orb: `github.com/jacobamobin/AppleIntelligenceGlowEffect`
- Classic Siri waveform: `github.com/kopiro/siriwave`
- SmoothUI orb: `smoothui.dev/docs/components/siri-orb`
- ElevenLabs orb: `ui.elevenlabs.io/docs/components/orb`
- ChatGPT blob CSS: `codepen.io/amrith92/pen/eYKoQZJ`
