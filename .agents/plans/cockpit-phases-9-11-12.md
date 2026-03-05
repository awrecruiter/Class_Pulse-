# Feature: Teacher's Cockpit — Phases 9/11/12 Expansion

The following plan should be complete, but validate documentation and codebase patterns before implementing.
Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

Expands three existing phases with the "Teacher's Cockpit" capabilities:

- **Phase 9 (Behavior Ladder)**: Add real AWS SNS SMS for parent contacts. Store parent phone numbers per student, auto-send SMS on incident step ≥ 5 if contact exists, manual send from behavior panel.
- **Phase 11 (AI Behavior Coach)**: Add ambient classroom intelligence — Web Audio API noise monitor, AI transcript anomaly scanner (every 5 min), teacher HUD overlay showing noise/anomaly/correction status, student "I'm Lost" correction button, animated waveform on student device showing teacher is speaking, Academic Guidance System (Claude generates parent conference talking points + practice guidance → optional AWS SNS SMS).
- **Phase 12 (Gradebook)**: Add student "Black Box" timeline tab — chronological per-student log of all system events (behavior, RAM bucks, mastery, CFU, drawings).

## User Story

As a 5th grade Florida math teacher
I want real SMS parent contacts, live classroom noise/anomaly monitoring, and a student Black Box log
So that I can communicate with parents instantly, detect classroom drift before it derails the lesson, and review each student's complete history at any time.

## Problem Statement

- Parent notifications currently generate a copy/paste ClassDojo message — no real delivery
- Teacher has no real-time awareness of classroom noise levels or lecture drift
- Students have no low-friction way to signal deep confusion beyond the 3-state pulse
- No single view shows a student's complete classroom history

## Solution Statement

Add AWS SNS SMS (real delivery, no SDK — raw SigV4 HTTP), Web Audio API ambient monitoring, AI transcript scanning, a teacher HUD overlay, student correction requests, and a per-student Black Box timeline aggregating all activity.

## Feature Metadata

**Feature Type**: Enhancement (Phases 9, 11, 12)
**Estimated Complexity**: High
**Primary Systems Affected**: Behavior, Ambient Intelligence, Student App, Gradebook
**Dependencies**: AWS SNS via raw SigV4 HTTP (no SDK), Web Audio API (browser-native), `@anthropic-ai/sdk` (existing)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ BEFORE IMPLEMENTING

- `src/lib/db/schema.ts` (full file) — all existing tables; we add 4 new tables
- `src/app/api/classes/[id]/behavior/incident/route.ts` (full) — extend to trigger AWS SNS SMS
- `src/components/coach/behavior-panel.tsx` (full) — extend with SMS send button + parent contact status
- `src/app/(dashboard)/coach/page.tsx` — extend with AmbientHUD component
- `src/app/student/[sessionId]/student-session.tsx` — extend with "I'm Lost" button + waveform
- `src/app/api/classes/[id]/behavior/route.ts` — pattern for behavior GET routes
- `src/lib/rate-limit.ts` — add new rate limiters
- `src/lib/ai/coach.ts` — pattern for Claude calls
- `src/app/api/sessions/[id]/student-feed/route.ts` — SSE pattern for student events
- `src/hooks/use-lecture-transcript.ts` — existing rolling transcript hook (2500-word buffer)
- `.env.example` — AWS SNS vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

### New Files to Create

- `src/lib/sms.ts` — AWS SNS wrapper (raw SigV4, no SDK): `sendSms(to, body) => Promise<SmsResult>` — DONE
- `src/app/api/classes/[id]/parent-contacts/route.ts` — GET list + POST upsert contact
- `src/app/api/classes/[id]/parent-contacts/[contactId]/route.ts` — DELETE
- `src/app/api/classes/[id]/parent-message/route.ts` — POST manual SMS send to parent
- `src/app/api/sessions/[id]/correction-requests/route.ts` — POST (student) + GET/SSE (teacher)
- `src/app/api/sessions/[id]/noise/route.ts` — POST noise level heartbeat from teacher
- `src/app/api/coach/ambient-scan/route.ts` — POST transcript chunk → Claude anomaly analysis
- `src/app/api/coach/academic-guidance/route.ts` — POST rosterId+classId → Claude guidance + optional SMS
- `src/app/api/classes/[id]/timeline/route.ts` — GET Black Box timeline for a student
- `src/hooks/use-ambient-monitor.ts` — Web Audio API hook: dB level + beat callbacks
- `src/components/coach/ambient-hud.tsx` — Teacher HUD overlay: noise meter + anomaly chip + correction badge
- `src/components/coach/manipulatives/student/correction-request.tsx` — Student "I'm Lost" button + optional waveform bars

### Relevant Documentation

- AWS SNS Publish — raw HTTP SigV4, see `src/lib/sms.ts` (implemented, no SDK needed)
- [Web Audio API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — `AudioContext`, `AnalyserNode.getByteFrequencyData()`
- Existing SSE pattern: `src/app/api/sessions/[id]/student-feed/route.ts` — `ReadableStream` + `encoder.encode("data: ...\n\n")`

### Patterns to Follow

**API Route Pattern** (from `src/app/api/classes/[id]/behavior/incident/route.ts`):
```ts
const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
const { success } = sessionRateLimiter.check(ip);
if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
const { data } = await auth.getSession();
if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Student Auth Pattern** (from `src/lib/auth/student.ts`):
```ts
import { getStudentSession } from "@/lib/auth/student";
const student = await getStudentSession(request);
if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Claude Call Pattern** (from `src/lib/ai/coach.ts`):
```ts
const client = new Anthropic();
const msg = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 512,
  messages: [{ role: "user", content: prompt }],
});
const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
```

**SSE Pattern** (from `src/app/api/sessions/[id]/student-feed/route.ts`):
```ts
const encoder = new TextEncoder();
const stream = new ReadableStream({ start(controller) { ... } });
return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
```

**Rate Limiter Pattern** (from `src/lib/rate-limit.ts`):
```ts
export const smsRateLimiter = createRateLimiter(10, 60_000); // 10/min
```

**Drizzle Insert Pattern**:
```ts
const [row] = await db.insert(table).values({...}).returning();
```

---

## IMPLEMENTATION PLAN

### Phase 1: Database Schema + Twilio Foundation

Add 4 new DB tables and the Twilio SMS utility.

### Phase 2: Phase 9 SMS — Parent Contacts + Auto-Send

Parent contact management APIs, auto-SMS on incident step ≥ 5, manual SMS button in behavior panel.

### Phase 3: Phase 11 Ambient Intelligence — Noise Monitor + Correction Requests

Web Audio API hook, teacher noise heartbeat API, student correction request API, correction-request SSE.

### Phase 4: Phase 11 AI Anomaly Scanner + Academic Guidance

AI transcript anomaly route, 5-minute scan loop on coach page, Academic Guidance System route.

### Phase 5: Phase 11 UI — Teacher HUD + Student Waveform

`AmbientHUD` component on coach page, student session waveform + "I'm Lost" button.

### Phase 6: Phase 12 — Student Black Box Timeline

Timeline aggregation API, timeline tab in class detail page.

---

## STEP-BY-STEP TASKS

### Task 1: INSTALL twilio package

```bash
npm install twilio --force
```

- **VALIDATE**: `node -e "require('twilio'); console.log('ok')"` — should print "ok"

---

### Task 2: UPDATE src/lib/db/schema.ts — Add 4 new tables

Add these tables after the `parentNotifications` table (Phase 9 section) and before the Relations section:

#### `parentContacts` — parent phone number per student per class
```ts
export const parentContacts = pgTable(
  "parent_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    rosterId: uuid("roster_id").notNull().references(() => rosterEntries.id, { onDelete: "cascade" }),
    parentName: text("parent_name").notNull().default(""),
    phone: text("phone").notNull(), // E.164 format: +12125551234
    notes: text("notes").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_parent_contacts_class_roster").on(table.classId, table.rosterId),
    index("idx_parent_contacts_class_id").on(table.classId),
  ],
);
```

#### `parentMessages` — log of sent SMS
```ts
export const parentMessages = pgTable(
  "parent_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    rosterId: uuid("roster_id").notNull().references(() => rosterEntries.id, { onDelete: "cascade" }),
    incidentId: uuid("incident_id").references(() => behaviorIncidents.id, { onDelete: "set null" }),
    phone: text("phone").notNull(),
    body: text("body").notNull(),
    // "incident" | "broadcast" | "academic-guidance" | "manual"
    triggeredBy: text("triggered_by").notNull().default("manual"),
    // "sent" | "failed"
    status: text("status").notNull().default("sent"),
    twilioSid: text("twilio_sid"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_parent_messages_class_roster").on(table.classId, table.rosterId),
    index("idx_parent_messages_sent_at").on(table.sentAt),
  ],
);
```

#### `correctionRequests` — student "I'm Lost" signals
```ts
export const correctionRequests = pgTable(
  "correction_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => classSessions.id, { onDelete: "cascade" }),
    rosterId: uuid("roster_id").notNull().references(() => rosterEntries.id, { onDelete: "cascade" }),
    context: text("context").notNull().default(""), // what student was working on
    // "pending" | "acknowledged"
    status: text("status").notNull().default("pending"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_correction_requests_session_id").on(table.sessionId),
    index("idx_correction_requests_status").on(table.status),
  ],
);
```

#### `ambientAlerts` — noise/anomaly alerts during a session
```ts
export const ambientAlerts = pgTable(
  "ambient_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => classSessions.id, { onDelete: "cascade" }),
    // "noise" | "transcript-anomaly" | "correction"
    alertType: text("alert_type").notNull(),
    // "low" | "medium" | "high"
    severity: text("severity").notNull().default("medium"),
    details: text("details").notNull().default(""),
    isAcknowledged: boolean("is_acknowledged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ambient_alerts_session_id").on(table.sessionId),
    index("idx_ambient_alerts_acknowledged").on(table.isAcknowledged),
  ],
);
```

Also add relations at the bottom of the relations section:
```ts
export const parentContactsRelations = relations(parentContacts, ({ one }) => ({
  class: one(classes, { fields: [parentContacts.classId], references: [classes.id] }),
  rosterEntry: one(rosterEntries, { fields: [parentContacts.rosterId], references: [rosterEntries.id] }),
}));

export const parentMessagesRelations = relations(parentMessages, ({ one }) => ({
  class: one(classes, { fields: [parentMessages.classId], references: [classes.id] }),
  rosterEntry: one(rosterEntries, { fields: [parentMessages.rosterId], references: [rosterEntries.id] }),
  incident: one(behaviorIncidents, { fields: [parentMessages.incidentId], references: [behaviorIncidents.id] }),
}));

export const correctionRequestsRelations = relations(correctionRequests, ({ one }) => ({
  session: one(classSessions, { fields: [correctionRequests.sessionId], references: [classSessions.id] }),
  rosterEntry: one(rosterEntries, { fields: [correctionRequests.rosterId], references: [rosterEntries.id] }),
}));

export const ambientAlertsRelations = relations(ambientAlerts, ({ one }) => ({
  session: one(classSessions, { fields: [ambientAlerts.sessionId], references: [classSessions.id] }),
}));
```

- **VALIDATE**: `npx tsc --noEmit` — no type errors

---

### Task 3: RUN DB migration

```bash
set -a && source .env.local && set +a && npm run db:push
```

- **VALIDATE**: Command exits 0

---

### Task 4: UPDATE .env.example — Add Twilio vars

Add to `.env.example`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+12125551234
```

---

### Task 5: CREATE src/lib/sms.ts — Twilio wrapper

```ts
import twilio from "twilio";

type SmsResult = { ok: boolean; sid?: string; error?: string };

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio not configured" };
  }

  try {
    const client = twilio(sid, token);
    const msg = await client.messages.create({ to, from, body });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}
```

- **IMPORTS**: `import twilio from "twilio"`
- **GOTCHA**: Twilio module has no named export — use default import `from "twilio"`
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 6: UPDATE src/lib/rate-limit.ts — Add new rate limiters

Add at the bottom of the existing limiter exports:
```ts
export const smsRateLimiter = createRateLimiter(10, 60_000);       // 10 SMS/min
export const ambientScanLimiter = createRateLimiter(20, 60_000);   // 20 noise posts/min
export const correctionRateLimiter = createRateLimiter(5, 60_000); // 5 corrections/min per student
```

- **PATTERN**: mirrors existing `sessionRateLimiter` definition in same file

---

### Task 7: CREATE src/app/api/classes/[id]/parent-contacts/route.ts

GET list of parent contacts for a class, POST upsert (one contact per student).

```ts
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, parentContacts, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const upsertSchema = z.object({
  rosterId: z.string().uuid(),
  parentName: z.string().max(100).default(""),
  phone: z.string().regex(/^\+1\d{10}$/, "Phone must be E.164 format: +1XXXXXXXXXX"),
  notes: z.string().max(500).default(""),
});

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  return !!cls;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = sessionRateLimiter.check(ip);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classId } = await params;
  const owns = await verifyTeacherOwnsClass(classId, data.user.id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contacts = await db
    .select({
      id: parentContacts.id,
      rosterId: parentContacts.rosterId,
      parentName: parentContacts.parentName,
      phone: parentContacts.phone,
      notes: parentContacts.notes,
      isActive: parentContacts.isActive,
      firstInitial: rosterEntries.firstInitial,
      lastInitial: rosterEntries.lastInitial,
      studentId: rosterEntries.studentId,
    })
    .from(parentContacts)
    .innerJoin(rosterEntries, eq(parentContacts.rosterId, rosterEntries.id))
    .where(eq(parentContacts.classId, classId));

  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = sessionRateLimiter.check(ip);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classId } = await params;
  const owns = await verifyTeacherOwnsClass(classId, data.user.id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const result = upsertSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  const { rosterId, parentName, phone, notes } = result.data;

  const [contact] = await db
    .insert(parentContacts)
    .values({ classId, rosterId, parentName, phone, notes })
    .onConflictDoUpdate({
      target: [parentContacts.classId, parentContacts.rosterId],
      set: { parentName, phone, notes, isActive: true, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ contact });
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 8: CREATE src/app/api/classes/[id]/parent-contacts/[contactId]/route.ts

DELETE a parent contact (soft: set isActive = false).

```ts
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, parentContacts } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  return !!cls;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = sessionRateLimiter.check(ip);
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classId, contactId } = await params;
  const owns = await verifyTeacherOwnsClass(classId, data.user.id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(parentContacts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(parentContacts.id, contactId), eq(parentContacts.classId, classId)));

  return NextResponse.json({ ok: true });
}
```

---

### Task 9: CREATE src/app/api/classes/[id]/parent-message/route.ts

Manual SMS send to a parent. Also used internally by incident route.

```ts
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, parentContacts, parentMessages } from "@/lib/db/schema";
import { smsRateLimiter, sessionRateLimiter } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";

const sendSchema = z.object({
  rosterId: z.string().uuid(),
  body: z.string().min(1).max(1600),
  triggeredBy: z.enum(["incident", "broadcast", "academic-guidance", "manual"]).default("manual"),
  incidentId: z.string().uuid().optional(),
});

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  return !!cls;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!sessionRateLimiter.check(ip).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (!smsRateLimiter.check(ip).success)
    return NextResponse.json({ error: "SMS rate limit exceeded" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classId } = await params;
  const owns = await verifyTeacherOwnsClass(classId, data.user.id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const result = sendSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  const { rosterId, body: msgBody, triggeredBy, incidentId } = result.data;

  // Get parent contact
  const [contact] = await db
    .select()
    .from(parentContacts)
    .where(
      and(
        eq(parentContacts.classId, classId),
        eq(parentContacts.rosterId, rosterId),
        eq(parentContacts.isActive, true),
      ),
    );

  if (!contact) return NextResponse.json({ error: "No parent contact on file" }, { status: 404 });

  const smsResult = await sendSms(contact.phone, msgBody);

  const [msg] = await db
    .insert(parentMessages)
    .values({
      classId,
      rosterId,
      incidentId: incidentId ?? null,
      phone: contact.phone,
      body: msgBody,
      triggeredBy,
      status: smsResult.ok ? "sent" : "failed",
      twilioSid: smsResult.sid ?? null,
    })
    .returning();

  return NextResponse.json({ ok: smsResult.ok, messageId: msg?.id, error: smsResult.error });
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 10: UPDATE src/app/api/classes/[id]/behavior/incident/route.ts — Auto-SMS on step ≥ 5

After the existing `parentMessage` block (line ~179–218), add an auto-SMS send if parent contact exists:

```ts
// Auto-send SMS if parent contact on file and step >= 5
if (newStep >= 5 && parentMessage) {
  const [contact] = await db
    .select({ phone: parentContacts.phone, isActive: parentContacts.isActive })
    .from(parentContacts)
    .where(
      and(
        eq(parentContacts.classId, classId),
        eq(parentContacts.rosterId, rosterId),
        eq(parentContacts.isActive, true),
      ),
    );

  if (contact) {
    const smsResult = await sendSms(contact.phone, parentMessage.message);
    await db.insert(parentMessages).values({
      classId,
      rosterId,
      incidentId: incident.id,
      phone: contact.phone,
      body: parentMessage.message,
      triggeredBy: "incident",
      status: smsResult.ok ? "sent" : "failed",
      twilioSid: smsResult.sid ?? null,
    });
    parentMessage = { ...parentMessage, smsSent: smsResult.ok };
  }
}
```

- **IMPORTS to add**: `parentContacts, parentMessages` from schema; `sendSms` from `@/lib/sms`
- **GOTCHA**: `parentMessage` object already has `{ message, notificationId }` — adding `smsSent` requires updating the type. Just spread and add `smsSent?: boolean` to the local type or use `as any & { smsSent?: boolean }` inline.
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 11: CREATE src/app/api/sessions/[id]/correction-requests/route.ts

Student POST (submit "I'm Lost") + Teacher GET (pending list).

```ts
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getStudentSession } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classSessions, correctionRequests, rosterEntries } from "@/lib/db/schema";
import { correctionRateLimiter, sessionRateLimiter } from "@/lib/rate-limit";

const correctionSchema = z.object({
  context: z.string().max(200).default(""),
});

const ackSchema = z.object({
  requestId: z.string().uuid(),
});

// POST — student submits "I'm Lost"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!correctionRateLimiter.check(ip).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id: sessionId } = await params;

  const student = await getStudentSession(request);
  if (!student || student.sessionId !== sessionId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const result = correctionSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  const [req] = await db
    .insert(correctionRequests)
    .values({ sessionId, rosterId: student.rosterId, context: result.data.context })
    .returning();

  return NextResponse.json({ ok: true, requestId: req?.id });
}

// GET — teacher polls pending correction requests for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!sessionRateLimiter.check(ip).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;

  // Verify session belongs to teacher
  const [session] = await db
    .select()
    .from(classSessions)
    .where(
      and(eq(classSessions.id, sessionId), eq(classSessions.teacherId, data.user.id)),
    );
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pending = await db
    .select({
      id: correctionRequests.id,
      rosterId: correctionRequests.rosterId,
      context: correctionRequests.context,
      status: correctionRequests.status,
      createdAt: correctionRequests.createdAt,
      firstInitial: rosterEntries.firstInitial,
      lastInitial: rosterEntries.lastInitial,
    })
    .from(correctionRequests)
    .innerJoin(rosterEntries, eq(correctionRequests.rosterId, rosterEntries.id))
    .where(
      and(eq(correctionRequests.sessionId, sessionId), eq(correctionRequests.status, "pending")),
    );

  return NextResponse.json({ requests: pending });
}

// PATCH — teacher acknowledges a correction request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!sessionRateLimiter.check(ip).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;
  const body = await request.json();
  const result = ackSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  await db
    .update(correctionRequests)
    .set({ status: "acknowledged", acknowledgedAt: new Date() })
    .where(
      and(
        eq(correctionRequests.id, result.data.requestId),
        eq(correctionRequests.sessionId, sessionId),
      ),
    );

  return NextResponse.json({ ok: true });
}
```

- **PATTERN**: student auth from `src/lib/auth/student.ts` — `getStudentSession(request)` returns `{ sessionId, rosterId } | null`
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 12: CREATE src/app/api/sessions/[id]/noise/route.ts

Teacher posts noise level (0–100) from Web Audio API. Stored in DB and broadcast via SSE.

```ts
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { ambientAlerts, classSessions } from "@/lib/db/schema";
import { ambientScanLimiter } from "@/lib/rate-limit";

const noiseSchema = z.object({
  level: z.number().min(0).max(100), // 0 = silent, 100 = max
  sessionId: z.string().uuid(),
});

const HIGH_NOISE_THRESHOLD = 75;
const MEDIUM_NOISE_THRESHOLD = 55;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!ambientScanLimiter.check(ip).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;

  // Verify teacher owns session
  const [session] = await db
    .select()
    .from(classSessions)
    .where(and(eq(classSessions.id, sessionId), eq(classSessions.teacherId, data.user.id)));
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const result = noiseSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  const { level } = result.data;

  // Log a DB alert only when noise is high (not every heartbeat — too noisy)
  if (level >= HIGH_NOISE_THRESHOLD) {
    await db.insert(ambientAlerts).values({
      sessionId,
      alertType: "noise",
      severity: level >= HIGH_NOISE_THRESHOLD ? "high" : "medium",
      details: `Ambient noise level: ${level}/100`,
    });
  }

  return NextResponse.json({ ok: true, level });
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 13: CREATE src/app/api/coach/ambient-scan/route.ts

Teacher posts last 5 minutes of lecture transcript; Claude scans for anomalies.

```ts
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth/server";
import { sessionRateLimiter } from "@/lib/rate-limit";

const client = new Anthropic();

const scanSchema = z.object({
  transcript: z.string().min(10).max(5000),
  sessionId: z.string().uuid().optional(),
});

export type AnomalyScanResult = {
  anomalies: {
    type: "confusion-spike" | "off-topic" | "repeated-concept" | "pacing-issue";
    description: string;
    severity: "low" | "medium" | "high";
    suggestion: string;
  }[];
  clean: boolean;
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!sessionRateLimiter.check(ip).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const result = scanSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  const prompt = `You are an experienced instructional coach monitoring a 5th grade Florida math lesson in real time.

Analyze the following 5-minute lecture excerpt and identify any anomalies that the teacher should be aware of:

TRANSCRIPT EXCERPT:
${result.data.transcript}

Look for:
- "confusion-spike": teacher is repeating the same thing multiple times (students probably confused)
- "off-topic": teacher has drifted significantly from math instruction
- "repeated-concept": same concept re-explained 3+ times — may need a different approach
- "pacing-issue": teacher is rushing through material OR spending too long on one thing

Respond with valid JSON only, no markdown, no explanation:
{
  "anomalies": [
    {
      "type": "confusion-spike" | "off-topic" | "repeated-concept" | "pacing-issue",
      "description": "Brief description of the issue",
      "severity": "low" | "medium" | "high",
      "suggestion": "One-sentence actionable suggestion for the teacher"
    }
  ],
  "clean": true | false
}

If no anomalies, return { "anomalies": [], "clean": true }.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
    const parsed = JSON.parse(text) as AnomalyScanResult;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ anomalies: [], clean: true });
  }
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 14: CREATE src/app/api/coach/academic-guidance/route.ts

Generate parent conference talking points + practice guidance for a student based on their full record.

```ts
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  behaviorIncidents,
  behaviorProfiles,
  cfuEntries,
  classes,
  masteryRecords,
  parentContacts,
  parentMessages,
  rosterEntries,
} from "@/lib/db/schema";
import { smsRateLimiter, sessionRateLimiter } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";

const client = new Anthropic();

const guidanceSchema = z.object({
  rosterId: z.string().uuid(),
  classId: z.string().uuid(),
  sendSms: z.boolean().default(false),
});

export type GuidanceResult = {
  talkingPoints: string[];
  practiceGuidance: string;
  parentMessageDraft: string;
  smsSent?: boolean;
  smsError?: string;
};

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
  const [cls] = await db
    .select({ id: classes.id, label: classes.label })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  return cls ?? null;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!sessionRateLimiter.check(ip).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const result = guidanceSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  const { rosterId, classId, sendSms: shouldSendSms } = result.data;

  const cls = await verifyTeacherOwnsClass(classId, data.user.id);
  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Gather student data
  const [student] = await db
    .select()
    .from(rosterEntries)
    .where(and(eq(rosterEntries.classId, classId), eq(rosterEntries.id, rosterId)));
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const mastery = await db
    .select({ standardCode: masteryRecords.standardCode, status: masteryRecords.status, consecutiveCorrect: masteryRecords.consecutiveCorrect })
    .from(masteryRecords)
    .where(eq(masteryRecords.rosterId, rosterId));

  const cfus = await db
    .select({ standardCode: cfuEntries.standardCode, score: cfuEntries.score, date: cfuEntries.date })
    .from(cfuEntries)
    .where(and(eq(cfuEntries.classId, classId), eq(cfuEntries.rosterId, rosterId)));

  const [profile] = await db
    .select({ currentStep: behaviorProfiles.currentStep, teacherNotes: behaviorProfiles.teacherNotes })
    .from(behaviorProfiles)
    .where(and(eq(behaviorProfiles.classId, classId), eq(behaviorProfiles.rosterId, rosterId)));

  const recentIncidents = await db
    .select({ step: behaviorIncidents.step, label: behaviorIncidents.label, createdAt: behaviorIncidents.createdAt })
    .from(behaviorIncidents)
    .where(and(eq(behaviorIncidents.classId, classId), eq(behaviorIncidents.rosterId, rosterId)));

  const studentInitials = `${student.firstInitial}.${student.lastInitial}.`;

  const prompt = `You are an instructional coach helping a 5th grade Florida math teacher prepare for a parent conference.

Student: ${studentInitials} (Student ID: ${student.studentId})
Class: ${cls.label}

Mastery Records:
${mastery.length ? mastery.map((m) => `- ${m.standardCode}: ${m.status} (${m.consecutiveCorrect} consecutive correct)`).join("\n") : "No mastery data yet."}

CFU Scores (0=absent, 1-4 scale):
${cfus.length ? cfus.map((c) => `- ${c.date} ${c.standardCode}: ${c.score}/4`).join("\n") : "No CFU data yet."}

Behavior:
Current step: ${profile?.currentStep ?? 0}/8
Recent incidents: ${recentIncidents.length ? recentIncidents.map((i) => `Step ${i.step} (${i.label})`).join(", ") : "None"}
Teacher notes: ${profile?.teacherNotes ?? "None"}

Generate a JSON response with:
{
  "talkingPoints": ["3-5 specific, evidence-based talking points for the parent conference"],
  "practiceGuidance": "2-3 sentences of specific practice suggestions the parent can do at home",
  "parentMessageDraft": "A 3-4 sentence professional parent message summarizing progress and next steps"
}

Be specific. Reference actual standards and data. Do not use the student's full name — use initials only.
Respond with valid JSON only.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
    const parsed = JSON.parse(text) as Omit<GuidanceResult, "smsSent" | "smsError">;

    const guidance: GuidanceResult = { ...parsed };

    // Optionally send SMS
    if (shouldSendSms) {
      if (!smsRateLimiter.check(ip).success) {
        guidance.smsError = "SMS rate limit exceeded";
      } else {
        const [contact] = await db
          .select()
          .from(parentContacts)
          .where(
            and(
              eq(parentContacts.classId, classId),
              eq(parentContacts.rosterId, rosterId),
              eq(parentContacts.isActive, true),
            ),
          );

        if (contact) {
          const smsResult = await sendSms(contact.phone, parsed.parentMessageDraft);
          guidance.smsSent = smsResult.ok;
          guidance.smsError = smsResult.error;

          if (smsResult.ok) {
            await db.insert(parentMessages).values({
              classId,
              rosterId,
              phone: contact.phone,
              body: parsed.parentMessageDraft,
              triggeredBy: "academic-guidance",
              status: "sent",
              twilioSid: smsResult.sid ?? null,
            });
          }
        } else {
          guidance.smsError = "No parent contact on file";
        }
      }
    }

    return NextResponse.json(guidance);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate guidance" },
      { status: 500 },
    );
  }
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 15: CREATE src/hooks/use-ambient-monitor.ts

Web Audio API hook for teacher noise monitoring. Runs only when `active=true`.

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AmbientLevel = "quiet" | "moderate" | "loud" | "off";

type Options = {
  active: boolean;
  onLevel?: (level: number) => void; // 0-100
};

export function useAmbientMonitor({ active, onLevel }: Options) {
  const [level, setLevel] = useState(0);
  const [ambientLevel, setAmbientLevel] = useState<AmbientLevel>("off");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    contextRef.current?.close();
    contextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setLevel(0);
    setAmbientLevel("off");
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        setHasPermission(true);
        streamRef.current = stream;

        const ctx = new AudioContext();
        contextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        function tick() {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          setLevel(normalized);
          onLevel?.(normalized);
          setAmbientLevel(
            normalized >= 70 ? "loud" : normalized >= 45 ? "moderate" : "quiet",
          );
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setHasPermission(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, onLevel, stop]);

  return { level, ambientLevel, hasPermission };
}
```

- **GOTCHA**: `AudioContext` is not available during SSR — only use inside `useEffect` (done via `new AudioContext()` inside async `start`)
- **VALIDATE**: `npx tsc --noEmit`

---

### Task 16: CREATE src/components/coach/ambient-hud.tsx

Teacher HUD overlay showing noise level, transcript anomaly chip, and pending correction badge.

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAmbientMonitor } from "@/hooks/use-ambient-monitor";
import type { AnomalyScanResult } from "@/app/api/coach/ambient-scan/route";

type Props = {
  sessionId?: string;         // active session ID (if any)
  transcript: string;         // from useLectureTranscript
  isListening: boolean;
};

type CorrectionRequest = {
  id: string;
  firstInitial: string;
  lastInitial: string;
  context: string;
  createdAt: string;
};

const NOISE_COLORS: Record<string, string> = {
  off: "bg-gray-200",
  quiet: "bg-green-400",
  moderate: "bg-yellow-400",
  loud: "bg-red-500",
};

export function AmbientHud({ sessionId, transcript, isListening }: Props) {
  const lastScanRef = useRef<string>("");
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noisePostTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [anomalies, setAnomalies] = useState<AnomalyScanResult["anomalies"]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);

  const handleLevel = useCallback(
    async (level: number) => {
      setCurrentLevel(level);
      // Post noise heartbeat to server (rate-limited in server)
      if (sessionId) {
        void fetch(`/api/sessions/${sessionId}/noise`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level, sessionId }),
        }).catch(() => {});
      }
    },
    [sessionId],
  );

  const { ambientLevel, hasPermission } = useAmbientMonitor({
    active: isListening,
    onLevel: handleLevel,
  });

  // AI anomaly scan every 5 minutes while listening
  useEffect(() => {
    if (!isListening) {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      return;
    }

    async function runScan() {
      if (transcript === lastScanRef.current || transcript.length < 100) return;
      lastScanRef.current = transcript;
      try {
        const res = await fetch("/api/coach/ambient-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcript.slice(-3000) }),
        });
        if (res.ok) {
          const data = (await res.json()) as AnomalyScanResult;
          setAnomalies(data.anomalies.filter((a) => a.severity !== "low"));
        }
      } catch {
        // non-critical
      }
    }

    scanTimerRef.current = setInterval(runScan, 5 * 60 * 1000);
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [isListening, transcript]);

  // Poll correction requests every 15s when session active
  useEffect(() => {
    if (!sessionId) return;

    async function fetchCorrections() {
      if (!sessionId) return;
      try {
        const res = await fetch(`/api/sessions/${sessionId}/correction-requests`);
        if (res.ok) {
          const json = await res.json();
          setCorrections(json.requests ?? []);
        }
      } catch {
        // non-critical
      }
    }

    fetchCorrections();
    const interval = setInterval(fetchCorrections, 15_000);
    return () => clearInterval(interval);
  }, [sessionId]);

  async function acknowledgeCorrection(requestId: string) {
    if (!sessionId) return;
    await fetch(`/api/sessions/${sessionId}/correction-requests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    setCorrections((prev) => prev.filter((c) => c.id !== requestId));
  }

  if (!isListening && corrections.length === 0 && anomalies.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Noise meter */}
      {isListening && hasPermission !== false && (
        <div className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1">
          <div className={`h-2 w-2 rounded-full ${NOISE_COLORS[ambientLevel]} animate-pulse`} />
          <span className="text-xs text-muted-foreground capitalize">{ambientLevel}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{currentLevel}</span>
        </div>
      )}

      {/* Correction requests */}
      {corrections.length > 0 && (
        <div className="flex flex-col gap-1">
          {corrections.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-2.5 py-1"
            >
              <span className="text-xs font-medium text-red-700">
                🆘 {c.firstInitial}.{c.lastInitial}. is lost
                {c.context ? ` — ${c.context}` : ""}
              </span>
              <button
                type="button"
                onClick={() => acknowledgeCorrection(c.id)}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                Got it
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Anomaly alerts */}
      {anomalies.map((a, i) => (
        <div
          key={i}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
            a.severity === "high"
              ? "border-orange-300 bg-orange-50 text-orange-800"
              : "border-yellow-300 bg-yellow-50 text-yellow-800"
          }`}
        >
          <span className="text-xs">⚠️ {a.description}</span>
          <button
            type="button"
            onClick={() => setAnomalies((prev) => prev.filter((_, j) => j !== i))}
            className="text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 17: UPDATE src/app/(dashboard)/coach/page.tsx — Integrate AmbientHUD

Import `AmbientHud` and add it between the `LectureVisualizer` and the `ScaffoldCard` area.

The `AmbientHud` needs `transcript`, `isListening`, and optionally `sessionId`. The coach page already has `transcript`, `isListening` from `useLectureTranscript`. There is no `sessionId` on the coach page (it's the general AI coach, not session-locked) — pass `sessionId={undefined}` for now. Noise + anomaly scanning still works without sessionId.

Add to imports:
```ts
import { AmbientHud } from "@/components/coach/ambient-hud";
```

In JSX, after the `LectureVisualizer` block and before the `QueryInput`:
```tsx
{/* Ambient HUD — noise monitor + anomaly alerts */}
{mode === "lecture" && isListening && (
  <AmbientHud
    transcript={transcript}
    isListening={isListening}
    sessionId={undefined}
  />
)}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 18: CREATE src/components/coach/manipulatives/student/correction-request.tsx

Student "I'm Lost" button and animated waveform bars indicating teacher is speaking.

```tsx
"use client";

import { useState } from "react";

type Props = {
  sessionId: string;
  noiseLevel?: number; // 0-100 from SSE feed (teacher noise heartbeat)
};

export function CorrectionRequest({ sessionId, noiseLevel = 0 }: Props) {
  const [sent, setSent] = useState(false);
  const [context, setContext] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const waveActive = noiseLevel > 20;
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4]; // relative heights

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch(`/api/sessions/${sessionId}/correction-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      setSent(true);
      setShowForm(false);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-4xl">🙋</p>
        <p className="text-sm font-semibold text-green-700">Your teacher has been notified!</p>
        <p className="text-xs text-muted-foreground">Hang tight — help is coming.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* Teacher activity waveform */}
      <div className="flex items-end gap-0.5 h-8">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-150 ${waveActive ? "bg-blue-400" : "bg-gray-200"}`}
            style={{
              height: waveActive
                ? `${Math.round(h * Math.max(8, (noiseLevel / 100) * 28))}px`
                : "4px",
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {waveActive ? "Teacher is speaking" : "Waiting for teacher"}
      </p>

      {/* I'm Lost button */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition-transform"
        >
          🆘 I'm Lost
        </button>
      ) : (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="What are you stuck on? (optional)"
            rows={2}
            className="resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-border py-2 text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 19: UPDATE src/app/student/[sessionId]/student-session.tsx — Add correction request

Import and add `CorrectionRequest` below the comprehension signal buttons.

Add to imports:
```ts
import { CorrectionRequest } from "@/components/coach/manipulatives/student/correction-request";
```

In JSX, after the comprehension signal buttons block and before the manipulative push display:
```tsx
{/* I'm Lost / correction request */}
<div className="mt-2 border-t border-border pt-3">
  <CorrectionRequest sessionId={sessionId} />
</div>
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 20: CREATE src/app/api/classes/[id]/timeline/route.ts

GET all events for a student (Black Box timeline).

```ts
import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  behaviorIncidents,
  cfuEntries,
  classes,
  drawingAnalyses,
  masteryRecords,
  ramBuckTransactions,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
  return !!cls;
}

export type TimelineEvent = {
  id: string;
  type: "behavior" | "ram-buck" | "mastery" | "cfu" | "drawing";
  title: string;
  detail: string;
  date: string; // ISO
  severity?: "positive" | "neutral" | "negative";
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!sessionRateLimiter.check(ip).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { data } = await auth.getSession();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classId } = await params;
  const owns = await verifyTeacherOwnsClass(classId, data.user.id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const rosterId = searchParams.get("rosterId");

  const rosterResult = z.string().uuid().safeParse(rosterId);
  if (!rosterResult.success)
    return NextResponse.json({ error: "rosterId required" }, { status: 400 });

  const rid = rosterResult.data;

  const [incidents, transactions, mastery, cfus, drawings] = await Promise.all([
    db.select().from(behaviorIncidents)
      .where(and(eq(behaviorIncidents.classId, classId), eq(behaviorIncidents.rosterId, rid)))
      .orderBy(desc(behaviorIncidents.createdAt)),
    db.select().from(ramBuckTransactions)
      .where(and(eq(ramBuckTransactions.classId, classId), eq(ramBuckTransactions.rosterId, rid)))
      .orderBy(desc(ramBuckTransactions.createdAt)),
    db.select().from(masteryRecords)
      .where(eq(masteryRecords.rosterId, rid))
      .orderBy(desc(masteryRecords.updatedAt)),
    db.select().from(cfuEntries)
      .where(and(eq(cfuEntries.classId, classId), eq(cfuEntries.rosterId, rid)))
      .orderBy(desc(cfuEntries.createdAt)),
    db.select().from(drawingAnalyses)
      .where(eq(drawingAnalyses.rosterId, rid))
      .orderBy(desc(drawingAnalyses.createdAt)),
  ]);

  const events: TimelineEvent[] = [
    ...incidents.map((i) => ({
      id: i.id,
      type: "behavior" as const,
      title: `Step ${i.step}: ${i.label}`,
      detail: i.notes || `−${i.ramBuckDeduction} RAM Bucks`,
      date: i.createdAt.toISOString(),
      severity: "negative" as const,
    })),
    ...transactions.map((t) => ({
      id: t.id,
      type: "ram-buck" as const,
      title: t.amount > 0 ? `+${t.amount} RAM Bucks` : `${t.amount} RAM Bucks`,
      detail: t.reason,
      date: t.createdAt.toISOString(),
      severity: (t.amount > 0 ? "positive" : "negative") as "positive" | "negative",
    })),
    ...mastery.filter((m) => m.status === "mastered").map((m) => ({
      id: m.id,
      type: "mastery" as const,
      title: `Mastered ${m.standardCode}`,
      detail: `${m.consecutiveCorrect} consecutive correct`,
      date: (m.achievedAt ?? m.updatedAt).toISOString(),
      severity: "positive" as const,
    })),
    ...cfus.map((c) => ({
      id: c.id,
      type: "cfu" as const,
      title: `CFU: ${c.standardCode}`,
      detail: `Score ${c.score}/4 — ${c.date}`,
      date: c.createdAt.toISOString(),
      severity: (c.score >= 3 ? "positive" : c.score >= 2 ? "neutral" : "negative") as "positive" | "neutral" | "negative",
    })),
    ...drawings.map((d) => ({
      id: d.id,
      type: "drawing" as const,
      title: `Drawing: ${d.analysisType}`,
      detail: d.studentFeedback,
      date: d.createdAt.toISOString(),
      severity: (d.analysisType === "correct" ? "positive" : d.analysisType === "misconception" ? "negative" : "neutral") as "positive" | "neutral" | "negative",
    })),
  ];

  // Sort all events by date descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ events });
}
```

- **VALIDATE**: `npx tsc --noEmit`

---

### Task 21: UPDATE src/app/(dashboard)/classes/[id]/page.tsx — Add Timeline Tab + Parent Contacts

The class detail page already has tabs (Roster, Groups, etc.). Add:

1. **Parent Contacts tab**: A list of roster entries with an "Add Phone" button. Clicking opens a small inline form: parent name, phone (+1XXXXXXXXXX). Shows SMS sent status badge. Enables teacher to manually trigger SMS.

2. **Student Timeline tab**: When teacher taps a student name in the roster, show a modal or slide-out with that student's Black Box timeline fetched from `/api/classes/[id]/timeline?rosterId=...`.

**Implementation approach**:
- Add `"contacts"` and `"timeline"` to the tab options array
- Add state: `parentContacts`, `selectedStudent` (for timeline modal), `timelineEvents`, `timelineLoading`
- Add `fetchContacts()` function calling `GET /api/classes/[id]/parent-contacts`
- Add `fetchTimeline(rosterId)` calling `GET /api/classes/[id]/timeline?rosterId=...`
- Contacts tab: grid of roster entries with phone status chip; tap "Add/Edit" → inline form → `POST /api/classes/[id]/parent-contacts`
- Timeline: modal overlay when `selectedStudent` is set (triggered from roster tab student row click)

**Key UI details** (child-appropriate is not required here — this is teacher UI):
- Contacts tab uses same card style as existing roster tab
- Timeline events use color-coded left border: green=positive, red=negative, gray=neutral
- Each timeline event shows type icon, title, detail, and relative date

- **GOTCHA**: Read the existing class detail page structure first before modifying (`src/app/(dashboard)/classes/[id]/page.tsx`) — it's large
- **PATTERN**: Match existing tab switching pattern in the file
- **VALIDATE**: `npx tsc --noEmit`

---

## TESTING STRATEGY

### Unit Tests

None required for this phase beyond type checking. All logic is in API routes tested via manual validation.

### Integration Tests (Manual)

1. **SMS Auto-Send**: Add parent contact for a student → log a Step 5 incident → verify SMS is sent (Twilio test credentials) → verify `parentMessages` row inserted
2. **Manual SMS**: Open behavior panel → click "Send SMS to parent" button → verify delivery
3. **Noise Monitor**: Open coach page with active session → speak loudly → verify noise level updates in HUD
4. **Correction Request**: Student taps "I'm Lost" → teacher sees badge in HUD → teacher acknowledges → badge disappears
5. **Anomaly Scan**: Wait 5 min during lecture or trigger manually → verify anomaly chips appear if issues detected
6. **Academic Guidance**: Open student profile → Generate Guidance → verify talking points + practice text generated
7. **Black Box Timeline**: Open class page → Contacts tab → add phone → Timeline — verify events sorted newest first

### Edge Cases

- Twilio not configured (missing env vars) → `sendSms` returns `{ ok: false, error: "Twilio not configured" }` — incident still logs
- Student submits "I'm Lost" multiple times — each creates new correction request (no dedup — teacher sees all)
- No parent contact on file when auto-SMS triggered — skip send, no error thrown
- Web Audio API permission denied — `hasPermission = false` → noise meter hidden silently
- Anomaly scan returns malformed JSON — catch block returns `{ anomalies: [], clean: true }` — no crash

---

## VALIDATION COMMANDS

### Level 1: Type Check

```bash
npx tsc --noEmit
```

### Level 2: Lint

```bash
npm run lint
```

### Level 3: DB Push

```bash
set -a && source .env.local && set +a && npm run db:push
```

### Level 4: Dev Server

```bash
npm run dev
```

Then verify:
- Coach page loads without errors
- AmbientHUD renders when lecture listening is active
- Class detail page has Contacts and/or Timeline tab

### Level 5: Twilio Test

If `TWILIO_ACCOUNT_SID` is configured with test credentials:
```
To: +15005550006   (Twilio magic number — always succeeds)
From: +15005550006 (Twilio test "from")
```

---

## ACCEPTANCE CRITERIA

- [ ] Parent contacts can be added/edited/deleted per student per class
- [ ] Step ≥ 5 incidents auto-send SMS if contact exists; log row inserted in `parentMessages`
- [ ] Manual SMS send works from behavior panel
- [ ] Academic Guidance generates talking points + practice text via Claude; optionally sends SMS
- [ ] Web Audio API noise monitor runs during active lecture; HUD shows quiet/moderate/loud
- [ ] AI transcript anomaly scan runs every 5 minutes while listening; high/medium anomaly chips appear
- [ ] Student "I'm Lost" button creates correction request; teacher HUD shows badge; teacher can acknowledge
- [ ] Student waveform bars animate based on teacher noise level via SSE feed (or static animation if sessionId not set)
- [ ] Black Box timeline shows all events for a student, sorted newest first, color-coded by sentiment
- [ ] All routes follow rate-limit → auth → Zod → DB pattern
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run lint` passes with zero errors

---

## COMPLETION CHECKLIST

- [ ] `npm install twilio --force` done
- [ ] 4 new DB tables added to schema.ts + relations
- [ ] `npm run db:push` executed successfully
- [ ] `.env.example` updated with Twilio vars
- [ ] `src/lib/sms.ts` created
- [ ] Rate limiters added to `src/lib/rate-limit.ts`
- [ ] Parent contacts CRUD API created (GET/POST/DELETE)
- [ ] Parent message send API created
- [ ] Incident route extended with auto-SMS
- [ ] Correction requests API created (POST/GET/PATCH)
- [ ] Noise heartbeat API created
- [ ] Ambient scan API created
- [ ] Academic guidance API created
- [ ] Timeline API created
- [ ] `use-ambient-monitor.ts` hook created
- [ ] `AmbientHud` component created and integrated in coach page
- [ ] `CorrectionRequest` student component created and integrated in student session
- [ ] Class detail page extended with parent contacts tab + timeline
- [ ] All validation commands pass

---

## NOTES

- **IXL/Khan Academy resource mapping** is explicitly deferred to a future phase. Academic guidance references standards and gives text suggestions only — no IXL/Khan deep links.
- **Student waveform** uses the noise level posted by teacher's ambient monitor → this requires teacher to be running an active session with the coach page open. If `sessionId` is undefined (coach page without a session), waveform shows static animation.
- **Twilio test mode**: Use Twilio test credentials for development. Never use production credentials in dev. Test "to" number: `+15005550006`.
- **Privacy**: Parent phone numbers are stored plaintext. No additional encryption at application layer (Neon encrypts at rest). FERPA compliance: phone belongs to parent/guardian, not student.
- **Confidence Score**: 8/10 — all patterns are established in the codebase. Main risk is Web Audio API browser compatibility and Twilio SDK TypeScript types.
