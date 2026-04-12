Initialize this project locally.

Use this repo-specific flow:

```bash
cp .env.example .env.local
npm install
npm run db:push
npm run dev
```

Notes:
- the app serves on `http://localhost:3000`
- `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `NEON_AUTH_COOKIE_SECRET` must be set for full functionality
- `ALLOW_DEV_AUTH_BYPASS=true` is optional and should only be used deliberately for local development
