# Project Instructions

This file is the Codex-facing equivalent of `CLAUDE.md` for this repository.

## Settings Are Contracts

- Treat every existing user-facing setting and preference as a behavioral contract.
- Do not change, bypass, reinterpret, or collapse an existing setting in order to fix a bug, improve reliability, simplify UX, or support a demo/handoff mode.
- If a reliability fix conflicts with an existing setting, preserve the existing setting semantics and add a new opt-in control instead.
- Before changing any code path that depends on settings, identify the current setting behavior and keep it intact unless the user explicitly asks to change that specific setting behavior.
- Add or update regression tests whenever touching config-driven behavior so the configured mode stays enforced.

## Voice Feature Guardrail

- Voice navigation, voice app opens, schedule doc opens, queue behavior, and handoff mode must not override one another implicitly.
- Handoff or production-safe behavior must be additive and opt-in. It must not silently replace configured app-open, nav-open, or new-tab behavior.

## Project Overview

UnGhettoMyLife is a classroom intelligence platform for 5th-grade Florida math teachers with AI instructional coaching, live classroom workflows, student session tools, and reporting.

Auth is currently handled by Neon Auth. Data is stored in PostgreSQL via Drizzle ORM.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript with `strict` enabled
- Tailwind CSS v4
- shadcn/ui and Radix UI
- Neon Auth via `@neondatabase/auth`
- PostgreSQL plus Drizzle ORM
- Anthropic SDK for AI features
- Web Speech API for browser-native speech recognition
- Zod v4 for validation
- Biome for linting and formatting
- Vitest plus Testing Library for unit tests

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Lint + fix
npm run lint:fix

# Format
npm run format

# Unit tests
npm test
npm run test:run

# Database
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

Notes:
- Use Biome, not ESLint or Prettier.
- `npm run build` requires env vars; use `npx tsc --noEmit` for local type-checking when env is incomplete.
- On macOS arm64, the repo may need the existing `legacy-peer-deps` setup already captured in `.npmrc`.

## Project Structure

```text
src/
├── app/
│   ├── (auth)/               # Login and signup
│   ├── (dashboard)/          # Protected app surfaces
│   ├── api/                  # Route handlers
│   ├── board/                # Board experience
│   └── student/              # Student session experience
├── components/
│   ├── board/
│   ├── coach/
│   ├── schedule/
│   ├── voice/
│   └── ui/
├── hooks/                    # Speech, mic, schedule, and voice hooks
├── lib/
│   ├── ai/
│   ├── auth/
│   ├── db/
│   └── voice/
├── data/                     # FL BEST standards corpus
└── test/                     # Vitest setup
```

Key files:
- `src/lib/db/schema.ts`: database tables and relations
- `src/lib/validations.ts`: request validation schemas where present
- `src/lib/rate-limit.ts`: shared rate limiter definitions
- `src/lib/ui-prefs.ts`: user preference keys and helpers
- `src/lib/voice/registry.ts`: voice surface routing and registry
- `src/middleware.ts`: route protection
- `src/data/fl-best-standards.ts`: curriculum corpus
- `.claude/PRD.md`: broader product requirements

## Architecture

Typical API route flow:
1. Rate limit check
2. Auth check with `auth.getSession()` or signed student cookie verification
3. Input validation with Zod
4. Database work through Drizzle
5. `NextResponse.json(...)`

Coach feature constraints:
- Lesson transcript is ephemeral by design
- Do not add persistence for lesson transcripts unless the user explicitly changes that product requirement

## Auth Patterns

- Teacher/protected routes use `auth.getSession()` from `@/lib/auth/server`.
- Student flows use signed cookies from `@/lib/auth/student`.
- Do not trust client-supplied user IDs.
- `ALLOW_DEV_AUTH_BYPASS` must remain explicit opt-in only.
- `NEON_AUTH_COOKIE_SECRET` is required for student token signing; do not reintroduce fallback secrets.

## Database Notes

- Database runtime access is generic PostgreSQL through `DATABASE_URL`.
- Do not re-couple runtime DB access to a Neon-specific driver unless explicitly requested.
- Auth is still Neon Auth; a full provider migration is a separate task from DB portability.

## Validation And Testing

- Validate user input before DB writes.
- Add or update regression tests whenever changing settings-driven behavior, voice behavior, auth behavior, or env-sensitive code.
- Prefer focused Vitest coverage for touched logic.

## Code Patterns

- Use `cn()` from `@/lib/utils` for conditional class merging.
- Prefer `import type { ... }` for type-only imports.
- Follow existing route and component patterns instead of inventing new structure.
- Keep Tailwind usage aligned with existing component conventions.

## Environment Variables

```bash
DATABASE_URL=             # PostgreSQL connection string
NEON_AUTH_BASE_URL=       # Neon Auth endpoint
NEON_AUTH_COOKIE_SECRET=  # Cookie signing secret
ALLOW_DEV_AUTH_BYPASS=    # Optional explicit local bypass
ANTHROPIC_API_KEY=        # Required for coach-related AI routes
GOOGLE_CLIENT_ID=         # Optional OAuth
GOOGLE_CLIENT_SECRET=     # Optional OAuth
AWS_ACCESS_KEY_ID=        # Optional SMS delivery
AWS_SECRET_ACCESS_KEY=    # Optional SMS delivery
AWS_REGION=               # Optional SMS delivery region
```

## Security And Data Handling

- Treat local env files and secrets as sensitive.
- Do not weaken secret handling, signed cookie handling, or auth checks to make development easier.
- The repo contains Claude hook protections for env-file access; do not remove them casually.
- There is no universal “FERPA-approved database” certification. If work touches student data posture, prefer additive controls, explicit documentation, and least-privilege access.

## On-Demand Context

- Product requirements: `.claude/PRD.md`
- Voice behavior boundaries: `docs/voice-command-matrix.md`
- QA expectations: `docs/QA_GATES.md`
- Security/data platform notes: `docs/data-platform-security.md`

## Working Rules For Codex

- Preserve existing behavior unless the user asks to change it.
- Read surrounding code before editing.
- Prefer small, verifiable changes over speculative rewrites.
- When touching settings, voice routing, queue behavior, schedule doc opens, or handoff mode, verify the current behavior first and add tests.
