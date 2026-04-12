# Class Pulse

A classroom intelligence platform for 5th grade Florida math teachers, built with Next.js 15, React 19, and PostgreSQL via Drizzle ORM.

## Features

- **Teacher Cockpit** — Live classroom controls, voice actions, schedule tools, and behavior workflows
- **Student Sessions** — Join-by-code classroom experiences with live signals and pushed activities
- **AI Coaching** — Instructional, behavior, and ambient classroom guidance flows
- **Classroom Data** — Rosters, groups, schedule blocks, RAM Bucks, behavior, and reporting

## Tech Stack

- **Framework:** Next.js 15 (App Router, `src/` directory)
- **UI:** React 19, Tailwind CSS v4, shadcn/ui, Lucide icons
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Neon Auth (`@neondatabase/auth`)
- **Drag-and-Drop:** dnd-kit
- **Validation:** Zod
- **Testing:** Vitest (unit), agent-browser (E2E)
- **Linting/Formatting:** Biome

## Getting Started

### Prerequisites

- Node.js 18+
- Node.js 18+
- A PostgreSQL database with TLS enabled
- A Neon Auth project, or a compatible replacement if you migrate auth separately

### Setup

1. **Install dependencies:**

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your PostgreSQL database URL, auth base URL, and cookie secret.

3. **Push the database schema:**

   ```bash
   npm run db:push
   ```

4. **Start the dev server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Do not use `--turbopack` — middleware does not execute with Turbopack in Next.js 15.

## Security Notes

- Student session cookies now require `NEON_AUTH_COOKIE_SECRET`; the app no longer falls back to an insecure default.
- Development auth bypass is disabled unless `ALLOW_DEV_AUTH_BYPASS=true` is set explicitly.
- For education workloads handling student records, use a managed PostgreSQL platform with a signed data processing agreement and required security controls. There is no general U.S. government "FERPA-approved database" certification.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Signup + Login pages
│   ├── (dashboard)/     # Editor page
│   └── api/             # Profile, links, links/reorder, slug/check routes
├── components/
│   ├── auth/            # Signup/login forms
│   ├── board/           # Board and resource surfaces
│   ├── coach/           # Coach panels and classroom controls
│   ├── schedule/        # Calendar and schedule UI
│   ├── voice/           # Voice command surfaces
│   └── ui/              # shadcn/ui primitives
├── hooks/               # Voice, mic, transcript, and schedule hooks
├── lib/                 # Auth, DB, AI, rate limiting, and shared utilities
├── middleware.ts        # Protected route handling
└── types/               # Shared TypeScript types
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Lint with Biome |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Biome |
| `npm run test` | Run unit tests (watch mode) |
| `npm run test:run` | Run unit tests once |
| `npm run test:e2e` | Run E2E tests |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio |
