---
name: init-project
description: Set up this Next.js project locally for development.
---

# Initialize The Project

Use the repo’s actual setup flow.

## Steps

```bash
cp .env.example .env.local
npm install
npm run db:push
npm run dev
```

## Validate

- app loads at `http://localhost:3000`
- database connection works with the provided `DATABASE_URL`
- auth-related env vars are present for authenticated flows

## Notes

- `ALLOW_DEV_AUTH_BYPASS=true` is optional and should remain explicit
- do not create `.env` when the repo uses `.env.local`
