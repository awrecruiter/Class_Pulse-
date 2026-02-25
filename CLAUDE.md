# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

UnGhettoMyLife is a full-stack Next.js web app with two features: a **link-in-bio page builder** (users create a public profile with drag-and-drop links) and an **AI Instructional Coach** for 5th-grade Florida math teachers (real-time lesson transcription + Claude-powered remediation plans grounded in FL BEST Math standards). Auth is handled by Neon Auth; data is stored in a Neon (Postgres) database via Drizzle ORM.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 (App Router) | Framework — file-based routing, React Server Components, API routes |
| React 19 | UI |
| TypeScript (strict) | Language |
| Tailwind CSS v4 | Styling |
| shadcn/ui (radix-ui) | Component library |
| Neon Auth (`@neondatabase/auth`) | Authentication — session cookie pattern |
| Neon Serverless + Drizzle ORM | Database — Postgres, query builder |
| `@anthropic-ai/sdk` | AI — Claude Haiku for instructional coaching |
| Web Speech API | Browser-native speech recognition (no dependency) |
| Zod v4 | Schema validation |
| Biome | Linting + formatting (NOT ESLint/Prettier) |
| Vitest + Testing Library | Unit tests |
| lucide-react | Icons |
| sonner | Toast notifications |
| @dnd-kit | Drag-and-drop link reordering |

---

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type check (no emit)
npx tsc --noEmit

# Lint
npm run lint

# Lint + fix
npm run lint:fix

# Format
npm run format

# Unit tests (watch)
npm test

# Unit tests (CI)
npm run test:run

# E2E tests
npm run test:e2e

# DB migrations
npm run db:generate   # generate migration files
npm run db:migrate    # run migrations
npm run db:push       # push schema (dev only)
npm run db:studio     # open Drizzle Studio
```

> **Note:** `npm install` requires `--force` on macOS arm64 due to Linux-specific packages in deps. A `.npmrc` with `legacy-peer-deps=true` is already present.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/               # Login, signup pages (unauthenticated)
│   ├── (dashboard)/          # Protected pages: editor, coach
│   │   ├── coach/page.tsx    # AI Instructional Coach
│   │   ├── editor/page.tsx   # Link-in-bio editor
│   │   └── layout.tsx        # Shared nav (Editor | Analytics | Coach)
│   ├── api/
│   │   ├── coach/route.ts    # POST /api/coach — AI remediation
│   │   ├── links/            # CRUD for link items
│   │   ├── profile/route.ts  # GET/POST/PUT profile
│   │   └── slug/check/       # Slug availability check
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Public homepage
├── components/
│   ├── coach/                # ModeToggle, LecturePanel, QueryInput, ScaffoldCard
│   ├── editor/               # AddLinkButton, EditorToolbar, LinkItem, LinkList, ProfileForm
│   ├── preview/              # PreviewPanel
│   ├── themes/               # Minimal theme component
│   └── ui/                   # shadcn/ui components
├── data/
│   └── fl-best-standards.ts  # 108 FL BEST Math benchmarks (Gr 3–5) + prereq chains
├── hooks/
│   ├── use-lecture-transcript.ts  # Continuous STT, 2500-word rolling buffer
│   ├── use-profile.ts             # Profile + links data hook
│   └── use-speech-query.ts        # Single-utterance STT
├── lib/
│   ├── ai/coach.ts           # Claude Haiku integration + system prompt
│   ├── auth/
│   │   ├── client.ts         # authClient (browser)
│   │   └── server.ts         # auth.getSession() (server)
│   ├── db/
│   │   ├── index.ts          # Drizzle db instance
│   │   └── schema.ts         # profiles, linkItems, clickEvents tables
│   ├── rate-limit.ts         # createRateLimiter + shared instances
│   ├── utils.ts              # cn() helper
│   └── validations.ts        # Zod schemas
├── middleware.ts              # Neon Auth session guard
├── test/setup.ts             # Vitest setup
└── types/
    ├── index.ts               # Profile, LinkItem, Theme, EditorState types
    └── speech-recognition.d.ts  # Web Speech API type declarations
```

---

## Architecture

**Request flow (API routes):**
1. Rate limit check (in-memory, per IP)
2. Auth check — `auth.getSession()` returns `{ data: { user } }`
3. Input validation with Zod
4. DB query via Drizzle
5. Return `NextResponse.json()`

**Coach feature (ephemeral):**
- Lesson transcript lives only in React state (`useRef` + `useState`) — never written to DB or localStorage
- On coach request: transcript + student query → `POST /api/coach` → Claude Haiku → JSON response
- No student data stored anywhere

---

## Code Patterns

### API Route Pattern
```ts
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = someRateLimiter.check(ip);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  // ... db logic ...
  return NextResponse.json({ ... });
}
```

### Styling
- Use `cn()` from `@/lib/utils` for conditional class merging
- Tailwind v4 utility classes only — no CSS modules
- Follow existing component patterns in `src/components/ui/`

### Types
- DB model types come from `InferSelectModel<typeof table>` in `src/types/index.ts`
- Import types with `import type { ... }` where possible

### Validation
- All user input validated with Zod before hitting the DB
- Schemas live in `src/lib/validations.ts`

### Rate Limiters
- `apiRateLimiter` — 30 req/min (general API)
- `slugCheckRateLimiter` — 60 req/min (slug availability)
- `coachRateLimiter` — 10 req/min (AI coach)
- Add new ones in `src/lib/rate-limit.ts` using `createRateLimiter(max, windowMs)`

---

## Database Schema

Three tables in `src/lib/db/schema.ts`:
- `profiles` — one per user; has `userId`, `slug`, `displayName`, `bio`, `avatarUrl`, `theme`
- `link_items` — belongs to a profile; has `type` (`link`|`header`|`divider`), `title`, `url`, `sortOrder`
- `click_events` — belongs to a link item; has `clickedAt` (analytics, Phase 4)

---

## Auth Pattern

Protected routes: `/editor`, `/analytics`, `/settings`, `/coach` (and their sub-paths) — see `src/middleware.ts`.

In API routes, always call `auth.getSession()` from `@/lib/auth/server`. Never trust client-supplied user IDs.

---

## Environment Variables

```bash
DATABASE_URL=             # Neon Postgres connection string
NEON_AUTH_BASE_URL=       # Neon Auth endpoint
NEON_AUTH_COOKIE_SECRET=  # Cookie signing secret
ANTHROPIC_API_KEY=        # Required for /coach AI feature
GOOGLE_CLIENT_ID=         # Optional — production OAuth
GOOGLE_CLIENT_SECRET=     # Optional — production OAuth
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | Database tables and relations |
| `src/lib/validations.ts` | All Zod schemas |
| `src/lib/rate-limit.ts` | Rate limiter instances |
| `src/middleware.ts` | Protected route list |
| `src/lib/ai/coach.ts` | Claude system prompt + `getScaffold()` |
| `src/data/fl-best-standards.ts` | FL BEST Math corpus |
| `src/types/index.ts` | Shared TypeScript types |
| `.claude/PRD.md` | Full product requirements document |

---

## On-Demand Context

| Topic | File |
|-------|------|
| AI Coach feature spec | `.claude/PRD.md` |
| FL BEST Math standards | `src/data/fl-best-standards.ts` |
| DB schema | `src/lib/db/schema.ts` |

---

## Notes

- **Linting:** Use Biome, not ESLint. Run `npm run lint:fix` before committing.
- **No `npm install` without `--force`** on macOS arm64 (Linux-specific rollup/tailwind packages in deps).
- **`npm run build` requires env vars** — it will fail without `NEON_AUTH_BASE_URL`. Use `npx tsc --noEmit` for type checking locally.
- **Coach transcript is ephemeral by design** — never add persistence to lesson transcripts.
- **`coach` route not in `init-project.md`** — that file targets a Python/FastAPI stack; ignore it for this project.
