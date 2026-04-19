export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { comprehensionSignals } from "@/lib/db/schema";
import { joinRateLimiter } from "@/lib/rate-limit";

const signalSchema = z.object({
	signal: z.enum(["got-it", "almost", "lost"]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = joinRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	// Student auth via signed cookie
	const token = request.cookies.get(STUDENT_COOKIE)?.value;
	if (!token) return NextResponse.json({ error: "Not joined" }, { status: 401 });

	const payload = verifyStudentToken(token);
	if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

	const { id: sessionId } = await params;
	if (payload.sessionId !== sessionId) {
		return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
	}

	const body = await request.json();
	const result = signalSchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: "Invalid signal" }, { status: 400 });
	}

	const { signal } = result.data;
	const now = new Date();

	// Upsert: if row already exists for this (sessionId, rosterId), update it
	const existing = await db
		.select({ signal: comprehensionSignals.signal, lostSince: comprehensionSignals.lostSince })
		.from(comprehensionSignals)
		.where(
			and(
				eq(comprehensionSignals.sessionId, sessionId),
				eq(comprehensionSignals.rosterId, payload.rosterId),
			),
		)
		.limit(1);

	const wasPreviouslyLost = existing[0]?.signal === "lost";
	const currentLostSince = existing[0]?.lostSince ?? null;

	// Determine lostSince:
	// - Going to "lost" for first time: set lostSince = now
	// - Staying on "lost": keep existing lostSince
	// - Moving off "lost": set lostSince = null
	let lostSince: Date | null = null;
	if (signal === "lost") {
		lostSince = wasPreviouslyLost && currentLostSince ? currentLostSince : now;
	}

	if (existing.length === 0) {
		await db.insert(comprehensionSignals).values({
			sessionId,
			rosterId: payload.rosterId,
			signal,
			signalledAt: now,
			lostSince,
		});
	} else {
		await db
			.update(comprehensionSignals)
			.set({ signal, signalledAt: now, lostSince })
			.where(
				and(
					eq(comprehensionSignals.sessionId, sessionId),
					eq(comprehensionSignals.rosterId, payload.rosterId),
				),
			);
	}

	return NextResponse.json({ ok: true, signal });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	// Let student poll their own current signal
	const token = request.cookies.get(STUDENT_COOKIE)?.value;
	if (!token) return NextResponse.json({ signal: null });

	const payload = verifyStudentToken(token);
	if (!payload) return NextResponse.json({ signal: null });

	const { id: sessionId } = await params;
	if (payload.sessionId !== sessionId) return NextResponse.json({ signal: null });

	const [current] = await db
		.select({ signal: comprehensionSignals.signal })
		.from(comprehensionSignals)
		.where(
			and(
				eq(comprehensionSignals.sessionId, sessionId),
				eq(comprehensionSignals.rosterId, payload.rosterId),
			),
		)
		.limit(1);

	return NextResponse.json({ signal: current?.signal ?? null });
}
