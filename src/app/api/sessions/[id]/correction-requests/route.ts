import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classSessions, correctionRequests, rosterEntries } from "@/lib/db/schema";
import { correctionRateLimiter, sessionRateLimiter } from "@/lib/rate-limit";

const postSchema = z.object({
	context: z.string().max(200).default(""),
});

const patchSchema = z.object({
	requestId: z.string().uuid(),
});

// Student: POST "I'm Lost"
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!correctionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const token = request.cookies.get(STUDENT_COOKIE)?.value;
	if (!token) return NextResponse.json({ error: "Not joined" }, { status: 401 });

	const payload = verifyStudentToken(token);
	if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

	const { id: sessionId } = await params;
	if (payload.sessionId !== sessionId)
		return NextResponse.json({ error: "Session mismatch" }, { status: 403 });

	const body = await request.json();
	const result = postSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [req] = await db
		.insert(correctionRequests)
		.values({ sessionId, rosterId: payload.rosterId, context: result.data.context })
		.returning();

	return NextResponse.json({ ok: true, requestId: req?.id });
}

// Teacher: GET pending correction requests
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: sessionId } = await params;

	// Verify teacher owns the session
	const [session] = await db
		.select({ teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));
	if (!session || session.teacherId !== data.user.id)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

	const requests = await db
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

	return NextResponse.json({ requests });
}

// Teacher: PATCH acknowledge a request
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: sessionId } = await params;

	const [session] = await db
		.select({ teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));
	if (!session || session.teacherId !== data.user.id)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = patchSchema.safeParse(body);
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
