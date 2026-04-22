export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { blockedDays } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const addSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	reason: z.string().max(120).optional(),
});

/** GET /api/pacing/blocked-days — all blocked days for the teacher */
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await db.select().from(blockedDays).where(eq(blockedDays.teacherId, data.user.id));
	return NextResponse.json({ blockedDays: rows });
}

/** POST /api/pacing/blocked-days — mark a day as blocked */
export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = addSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const teacherId = data.user.id;

	const [row] = await db
		.insert(blockedDays)
		.values({ teacherId, date: result.data.date, reason: result.data.reason ?? null })
		.onConflictDoUpdate({
			target: [blockedDays.teacherId, blockedDays.date],
			set: { reason: result.data.reason ?? null },
		})
		.returning();

	return NextResponse.json({ blockedDay: row });
}

/** DELETE /api/pacing/blocked-days?date=YYYY-MM-DD — unblock a day */
export async function DELETE(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const dateParam = new URL(request.url).searchParams.get("date");
	if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
		return NextResponse.json({ error: "date param required (YYYY-MM-DD)" }, { status: 400 });
	}

	await db
		.delete(blockedDays)
		.where(and(eq(blockedDays.teacherId, data.user.id), eq(blockedDays.date, dateParam)));

	return NextResponse.json({ ok: true });
}
