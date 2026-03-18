# Feature: Portal Auto-Login via Voice Command

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

When the teacher says "open iReady" (or any portal app), the system should automatically copy their stored password to the clipboard and surface their username in the toast — so they can open the portal and log in with one tap instead of typing credentials on a mobile keyboard.

Credentials (username + AES-256-GCM encrypted password) are stored per portal per teacher in the DB. A new Settings section lets the teacher manage credentials. No credentials are ever sent to the browser unencrypted except via the secure `GET /api/portal-credentials?portalKey=` endpoint (authenticated, teacher-only).

## User Story

As a 5th-grade math teacher
I want to say "open iReady" and have my username shown and password ready to paste
So that I can log into my portal apps in one tap without typing on my phone keyboard

## Problem Statement

Voice-triggered portal opens currently just open the URL in a new tab. The teacher then has to manually type their username and password on a small mobile keyboard — slow and disruptive mid-lesson.

## Solution Statement

Store encrypted portal credentials server-side. When a voice command opens a portal app that has credentials, surface the username in the toast notification and write the password to the clipboard (on the user gesture of tapping "Open"), enabling one-tap authenticated access.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: Voice command system, Settings UI, DB schema
**Dependencies**: Node.js `crypto` (built-in), existing Drizzle ORM pattern

---

## CONTEXT REFERENCES

### Relevant Codebase Files — MUST READ BEFORE IMPLEMENTING

- `src/hooks/use-board-voice.ts` (lines 1–136) — `APPS` array, `BoardCommand` type, `matchBoardCommand()`. Need to add `portalKey` field to `AppEntry` and `BoardCommand["open_app"]`.
- `src/components/voice/voice-command-provider.tsx` (lines 311–354) — `handleBoardCommand` callback where we intercept `open_app` to inject credential lookup.
- `src/lib/portal-urls.ts` (full file) — portal key strings ("iready", "schoology", etc.) that must match what we store in the DB.
- `src/lib/db/schema.ts` (full file) — all table definitions; mirror the `teacherSettings` table pattern for the new `portalCredentials` table.
- `src/app/(dashboard)/settings/page.tsx` (lines 1–80, 1147–1216) — Settings page structure. New section inserts just before `<ScheduleManager />` at line 1211. Use existing `rounded-lg border border-slate-800 bg-slate-900 p-4` card pattern.
- `src/app/api/teacher-settings/route.ts` — API route pattern: rate limit → auth → Zod → DB → response. Mirror for new `/api/portal-credentials` route.
- `src/lib/rate-limit.ts` — existing rate limiters; add a new `credentialsRateLimiter`.

### New Files to Create

- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt using Node `crypto`
- `src/app/api/portal-credentials/route.ts` — GET (list + fetch with decrypted password), POST (upsert), DELETE

### Relevant Documentation — READ BEFORE IMPLEMENTING

- Node.js `crypto.createCipheriv` / `createDecipheriv` for AES-256-GCM: https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options
- `navigator.clipboard.writeText()` must be called inside a user gesture (click handler): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- Drizzle `pgTable` + `uniqueIndex` pattern: already in `src/lib/db/schema.ts`

### Patterns to Follow

**API Route Pattern** (mirror `src/app/api/teacher-settings/route.ts`):
```ts
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = rateLimiter.check(ip);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ... db logic ...
  return NextResponse.json({ ... });
}
```

**Schema Pattern** (mirror `teacherSettings` in `src/lib/db/schema.ts`):
```ts
export const portalCredentials = pgTable(
  "portal_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherId: text("teacher_id").notNull(),
    portalKey: text("portal_key").notNull(),
    username: text("username").notNull(),
    encryptedPassword: text("encrypted_password").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_portal_credentials_teacher_key").on(table.teacherId, table.portalKey),
    index("idx_portal_credentials_teacher_id").on(table.teacherId),
  ],
);
```

**Encryption Pattern** (AES-256-GCM with Node crypto):
```ts
// src/lib/encryption.ts
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;

function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, "portal-credentials-salt", KEY_LEN);
}

export function encrypt(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(stored: string, secret: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Invalid stored format");
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return (
    decipher.update(Buffer.from(ciphertextHex, "hex")).toString("utf8") +
    decipher.final("utf8")
  );
}
```

**Settings card pattern** (from `src/app/(dashboard)/settings/page.tsx` ~line 1147):
```tsx
<div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-medium text-slate-200">Label</p>
      <p className="text-xs text-slate-500 mt-0.5">Description</p>
    </div>
    {/* control */}
  </div>
</div>
```

**Section header pattern** (search settings page for existing section headings):
```tsx
<h2 className="text-base font-semibold text-slate-200 mt-8 mb-3">Section Title</h2>
```

**Portal key mapping** — `portalKey` values must match the keys in `src/lib/portal-urls.ts`:
| App label | portalKey |
|-----------|-----------|
| Portal | `portal` |
| Outlook | `outlook` |
| OneDrive | `onedrive` |
| Pinnacle | `pinnacle` |
| Schoology | `schoology` |
| Clever | `clever` |
| iReady | `iready` |
| IXL | `ixl` |
| Big Ideas Math | `bigideas` |
| McGraw Hill | `mcgrawhill` |

---

## IMPLEMENTATION PLAN

### Phase 1: DB Schema + Encryption

Add `portalCredentials` table, generate + run migration, write encryption utilities.

### Phase 2: API Route

CRUD endpoint `/api/portal-credentials` with GET (list/single), POST (upsert), DELETE.

### Phase 3: Voice Command Enhancement

Add `portalKey` to `BoardCommand["open_app"]`, fetch credentials on app open, show credential toast.

### Phase 4: Settings UI

New "Portal Credentials" section in settings page — per-portal username/password inputs with save/clear.

---

## STEP-BY-STEP TASKS

### CREATE `src/lib/encryption.ts`

- **IMPLEMENT**: AES-256-GCM encrypt/decrypt using Node `crypto` built-in
- **PATTERN**: See "Encryption Pattern" above — copy exactly
- **IMPORTS**: `import crypto from "node:crypto"`
- **GOTCHA**: `decipheriv.setAuthTag()` must be called before `update()`. `scryptSync` is synchronous and slightly slow — only called on save/load, never on hot path.
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/lib/db/schema.ts`

- **ADD**: `portalCredentials` table — see "Schema Pattern" above. Insert after the `scheduleDocLinks` table and before the Relations section.
- **ADD**: `portalCredentialsRelations` at the bottom (one teacher → many credentials pattern isn't needed — just the table is sufficient)
- **GOTCHA**: Don't break existing relations. Insert table definition before the `// ─── Relations ───` divider.
- **VALIDATE**: `npx tsc --noEmit`

### CREATE migration file

- **IMPLEMENT**: Run `npm run db:generate` to auto-generate the migration SQL
- **VALIDATE**: Confirm a new file appears in `drizzle/` (e.g. `drizzle/0008_portal_credentials.sql`)
- Run `npm run db:migrate` to apply

### UPDATE `src/lib/rate-limit.ts`

- **ADD**: `export const credentialsRateLimiter = createRateLimiter(20, 60_000);` — 20 req/min for CRUD (low frequency operation)
- **PATTERN**: Mirror existing `apiRateLimiter` definition
- **VALIDATE**: `npx tsc --noEmit`

### CREATE `src/app/api/portal-credentials/route.ts`

- **IMPLEMENT GET**:
  - No `portalKey` param → return `[{ portalKey, username }]` for all teacher's stored portals (no passwords)
  - `?portalKey=iready` → return `{ portalKey, username, password: decrypt(encryptedPassword, secret) }` for that specific portal
  - Env: `process.env.NEON_AUTH_COOKIE_SECRET` as the encryption secret
- **IMPLEMENT POST**: Body `{ portalKey: string, username: string, password: string }` → encrypt password → upsert (insert or update on conflict `teacherId + portalKey`)
- **IMPLEMENT DELETE**: `?portalKey=iready` → delete row for `teacherId + portalKey`
- **PATTERN**: API route pattern (rate limit → auth → Zod → DB → response) — mirror `src/app/api/teacher-settings/route.ts`
- **IMPORTS**: `encrypt`, `decrypt` from `@/lib/encryption`; `credentialsRateLimiter` from `@/lib/rate-limit`; `portalCredentials` from schema
- **GOTCHA**: `NEON_AUTH_COOKIE_SECRET` is already used for student cookie signing — safe to reuse as encryption key source. If undefined at runtime, throw with clear message.
- **GOTCHA**: Drizzle upsert uses `.insert().values(...).onConflictDoUpdate({ target: [col], set: { ... } })` — check existing schema usage for the exact pattern.
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/hooks/use-board-voice.ts`

- **ADD** `portalKey: string` field to `AppEntry` interface
- **UPDATE** `BoardCommand` type — `open_app` variant gets `portalKey: string`:
  ```ts
  | { type: "open_app"; label: string; href: string; portalKey: string }
  ```
- **ADD** `portalKey` to every entry in the `APPS` array — use the mapping table above
- **UPDATE** `matchBoardCommand` return — include `portalKey: app.portalKey` in the `open_app` result
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/components/voice/voice-command-provider.tsx`

- **UPDATE** `handleBoardCommand` — make the `open_app` branch async:
  ```ts
  if (cmd.type === "open_app") {
    // Try to load stored credentials (non-blocking, silent failure)
    let creds: { username: string; password: string } | null = null;
    try {
      const res = await fetch(
        `/api/portal-credentials?portalKey=${encodeURIComponent(cmd.portalKey)}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.credential?.password) creds = json.credential;
      }
    } catch { /* silent — never block the teacher */ }

    if (creds) {
      // Always show toast when creds exist: tap = user gesture required for clipboard
      const { username, password } = creds;
      toast.success(`Open ${cmd.label}?`, {
        description: `Username: ${username} · Password will be copied`,
        duration: 10000,
        action: {
          label: "Open",
          onClick: () => {
            navigator.clipboard.writeText(password).catch(() => {});
            window.open(cmd.href, "_blank");
          },
        },
      });
    } else if (voiceAppOpenModeRef.current === "confirm") {
      // existing confirm branch (unchanged)
      ...
    } else {
      // existing immediate branch (unchanged)
      ...
    }
    return;
  }
  ```
- **GOTCHA**: `handleBoardCommand` is currently `useCallback((...) => {...})` (synchronous). Change the inner function to `async` — the callback wrapper itself does not need to be async.
- **GOTCHA**: `navigator.clipboard.writeText()` MUST be called inside an actual user-gesture handler (the `onClick`). Do NOT call it outside the click — it will silently fail on mobile.
- **GOTCHA**: The `cmd` object now carries `portalKey` — TypeScript will infer this from the updated `BoardCommand` type automatically.
- **VALIDATE**: `npx tsc --noEmit`

### UPDATE `src/app/(dashboard)/settings/page.tsx`

- **ADD** type at top of file:
  ```ts
  type PortalCredential = { portalKey: string; username: string };
  ```
- **ADD** state variables (inside the component, with existing state):
  ```ts
  const [portalCreds, setPortalCreds] = useState<PortalCredential[]>([]);
  const [credEdits, setCredEdits] = useState<Record<string, { username: string; password: string }>>({});
  const [credSaving, setCredSaving] = useState<Record<string, boolean>>({});
  const [credShowPwd, setCredShowPwd] = useState<Record<string, boolean>>({});
  ```
- **ADD** fetch in the existing load `useEffect`:
  ```ts
  fetch("/api/portal-credentials")
    .then((r) => r.ok ? r.json() : { credentials: [] })
    .then((j) => setPortalCreds(j.credentials ?? []))
    .catch(() => {});
  ```
- **ADD** Portal Credentials section in JSX — insert just before `<ScheduleManager />` at line 1211:
  ```tsx
  <h2 className="text-base font-semibold text-slate-200 mt-8 mb-3">Portal Credentials</h2>
  <p className="text-xs text-slate-500 mb-4">
    Store your login info so voice commands like "open iReady" copy your password automatically.
  </p>
  <div className="flex flex-col gap-3">
    {PORTAL_CREDENTIAL_APPS.map((app) => {
      const saved = portalCreds.find((c) => c.portalKey === app.portalKey);
      const edit = credEdits[app.portalKey] ?? { username: saved?.username ?? "", password: "" };
      const showPwd = credShowPwd[app.portalKey] ?? false;
      const saving = credSaving[app.portalKey] ?? false;
      return (
        <div key={app.portalKey} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-3 mb-3">
            {/* app icon or label */}
            <p className="text-sm font-medium text-slate-200">{app.label}</p>
            {saved && <span className="text-xs text-emerald-400 ml-auto">Saved</span>}
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Username or email"
              value={edit.username}
              onChange={(e) => setCredEdits((prev) => ({ ...prev, [app.portalKey]: { ...edit, username: e.target.value } }))}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 w-full"
            />
            <div className="flex gap-2">
              <input
                type={showPwd ? "text" : "password"}
                placeholder={saved ? "••••••• (leave blank to keep)" : "Password"}
                value={edit.password}
                onChange={(e) => setCredEdits((prev) => ({ ...prev, [app.portalKey]: { ...edit, password: e.target.value } }))}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 flex-1"
              />
              <button
                type="button"
                onClick={() => setCredShowPwd((p) => ({ ...p, [app.portalKey]: !showPwd }))}
                className="text-slate-500 hover:text-slate-300 text-xs px-2"
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              {saved && (
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/portal-credentials?portalKey=${app.portalKey}`, { method: "DELETE" });
                    setPortalCreds((p) => p.filter((c) => c.portalKey !== app.portalKey));
                    setCredEdits((p) => ({ ...p, [app.portalKey]: { username: "", password: "" } }));
                    toast.success(`${app.label} credentials removed`);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              )}
              <Button
                size="sm"
                disabled={saving || !edit.username || (!edit.password && !saved)}
                onClick={async () => {
                  if (!edit.password && saved) return; // nothing to update
                  setCredSaving((p) => ({ ...p, [app.portalKey]: true }));
                  const res = await fetch("/api/portal-credentials", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ portalKey: app.portalKey, username: edit.username, password: edit.password }),
                  });
                  setCredSaving((p) => ({ ...p, [app.portalKey]: false }));
                  if (res.ok) {
                    setPortalCreds((p) => {
                      const next = p.filter((c) => c.portalKey !== app.portalKey);
                      return [...next, { portalKey: app.portalKey, username: edit.username }];
                    });
                    setCredEdits((p) => ({ ...p, [app.portalKey]: { username: edit.username, password: "" } }));
                    toast.success(`${app.label} credentials saved`);
                  } else {
                    toast.error("Failed to save credentials");
                  }
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      );
    })}
  </div>
  ```
- **ADD** `PORTAL_CREDENTIAL_APPS` constant above the component (or at top of file):
  ```ts
  const PORTAL_CREDENTIAL_APPS = [
    { label: "iReady", portalKey: "iready" },
    { label: "Schoology", portalKey: "schoology" },
    { label: "Pinnacle", portalKey: "pinnacle" },
    { label: "IXL", portalKey: "ixl" },
    { label: "Big Ideas Math", portalKey: "bigideas" },
    { label: "McGraw Hill", portalKey: "mcgrawhill" },
    { label: "Clever", portalKey: "clever" },
    { label: "Portal", portalKey: "portal" },
    { label: "Outlook", portalKey: "outlook" },
    { label: "OneDrive", portalKey: "onedrive" },
  ] as const;
  ```
- **GOTCHA**: Password input must have `type="password"` by default for security. The "Show/Hide" toggle switches between `"text"` and `"password"`.
- **GOTCHA**: When `saved` is true and `password` field is blank, the save button should be disabled unless username changed — don't overwrite with empty password.
- **VALIDATE**: `npx tsc --noEmit`

---

## TESTING STRATEGY

### Unit Tests

No new unit tests required — encryption utilities are pure functions but the existing test setup (Vitest) covers only specific modules. If desired, add `src/lib/__tests__/encryption.test.ts` testing round-trip encrypt/decrypt.

### Edge Cases

- `NEON_AUTH_COOKIE_SECRET` undefined → API should return 500 with clear error
- Password field left blank when updating username only → should update only username (or require re-entering password)
- Popup blocked for portal open + credentials → clipboard write still happens, toast stays open
- Credential fetch fails (network) → fall through to normal open behavior (never block the teacher)

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

1. Go to `/settings` → verify "Portal Credentials" section appears
2. Enter username + password for iReady → click Save → verify "Saved" badge appears
3. Refresh page → verify username pre-fills, password field is blank (expected)
4. Say "open iReady" → verify toast shows username + "Password will be copied"
5. Tap "Open" → verify new tab opens AND password is in clipboard (paste test)
6. Click "Remove" → verify credentials disappear
7. Say "open iReady" without credentials → verify original behavior (immediate open or confirm toast per mode setting)

---

## ACCEPTANCE CRITERIA

- [ ] `portalCredentials` table created and migrated
- [ ] `encrypt` / `decrypt` utilities work correctly (round-trip test)
- [ ] `GET /api/portal-credentials` returns credentials list without passwords
- [ ] `GET /api/portal-credentials?portalKey=iready` returns decrypted password
- [ ] `POST /api/portal-credentials` upserts credentials correctly
- [ ] `DELETE /api/portal-credentials?portalKey=iready` removes credentials
- [ ] Voice command "open iReady" shows credential toast when credentials saved
- [ ] Tapping "Open" in toast copies password to clipboard and opens the URL
- [ ] Without credentials, existing voice behavior is unchanged
- [ ] Settings page credential section works: save, update, remove
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint:fix` passes with zero errors

---

## NOTES

- **Clipboard API requires user gesture**: `navigator.clipboard.writeText()` must be called inside the toast action `onClick` — this is the user gesture. Do not call it in the async voice handler itself.
- **Encryption key**: `NEON_AUTH_COOKIE_SECRET` is derived through `scryptSync` with a fixed salt, so the actual DB key is distinct from the raw cookie secret.
- **No master password**: If the teacher changes their `NEON_AUTH_COOKIE_SECRET` env var, stored credentials will fail to decrypt. Consider logging a clear error message in that case.
- **Future improvement**: A server-side login relay (auto-POST to portal login endpoint) could fully automate login for traditional form-based portals. Deferred — clipboard approach is universal and reliable.
- **Confidence Score**: 8/10 — patterns are well-established in the codebase. Main risk is the async `handleBoardCommand` callback (currently synchronous) — verify TypeScript is happy with the async inner function inside `useCallback`.
