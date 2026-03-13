import { count, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { confusionMarks } from "@/lib/db/schema";
import { joinRateLimiter } from "@/lib/rate-limit";

// POST — student taps "confused here"; creates a new timestamped mark
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = joinRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const token = request.cookies.get(STUDENT_COOKIE)?.value;
	if (!token) return NextResponse.json({ error: "Not joined" }, { status: 401 });

	const payload = verifyStudentToken(token);
	if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

	const { id: sessionId } = await params;
	if (payload.sessionId !== sessionId) {
		return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
	}

	await db.insert(confusionMarks).values({
		sessionId,
		rosterId: payload.rosterId,
		markedAt: new Date(),
	});

	// Return this student's total mark count for the session
	const [{ value }] = await db
		.select({ value: count() })
		.from(confusionMarks)
		.where(eq(confusionMarks.sessionId, sessionId));

	return NextResponse.json({ ok: true, totalMarks: value });
}

// GET — teacher fetches confusion mark count + recent timestamps for this session
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: sessionId } = await params;

	const marks = await db
		.select({ rosterId: confusionMarks.rosterId, markedAt: confusionMarks.markedAt })
		.from(confusionMarks)
		.where(eq(confusionMarks.sessionId, sessionId));

	// Build a simple heatmap: group by minute bucket
	const buckets: Record<string, number> = {};
	for (const m of marks) {
		const minute = m.markedAt.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
		buckets[minute] = (buckets[minute] ?? 0) + 1;
	}

	const uniqueStudents = new Set(marks.map((m) => m.rosterId)).size;

	return NextResponse.json({
		totalMarks: marks.length,
		uniqueStudents,
		buckets,
	});
}
