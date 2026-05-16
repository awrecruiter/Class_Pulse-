import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { STUDENT_COOKIE, signStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classSessions, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

// POST /api/sessions/[id]/preview-join
// Teacher-only: creates a preview roster entry and sets a student cookie so the
// teacher can open the student session view without needing a real student ID.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: sessionId } = await params;

	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	// Verify teacher owns this session and it is active
	const session = await db
		.select({
			id: classSessions.id,
			classId: classSessions.classId,
			teacherId: classSessions.teacherId,
		})
		.from(classSessions)
		.where(and(eq(classSessions.id, sessionId), eq(classSessions.status, "active")))
		.limit(1)
		.then((r) => r[0] ?? null);

	if (!session || session.teacherId !== data.user.id) {
		return NextResponse.json({ error: "Session not found" }, { status: 404 });
	}

	// Upsert a "Teacher Preview" roster entry for this class so the student
	// cookie has a valid rosterId without needing a real student in the roster.
	let rosterId: string;
	try {
		const existing = await db
			.select({ id: rosterEntries.id })
			.from(rosterEntries)
			.where(
				and(eq(rosterEntries.classId, session.classId), eq(rosterEntries.studentId, "PREVIEW")),
			)
			.limit(1)
			.then((r) => r[0] ?? null);

		if (existing) {
			rosterId = existing.id;
		} else {
			const [inserted] = await db
				.insert(rosterEntries)
				.values({
					classId: session.classId,
					studentId: "PREVIEW",
					firstInitial: "T",
					lastInitial: "P",
				})
				.returning({ id: rosterEntries.id });
			rosterId = inserted.id;
		}
	} catch {
		return NextResponse.json({ error: "Could not create preview session" }, { status: 500 });
	}

	const token = signStudentToken({ sessionId, rosterId });
	const redirectUrl = `/student/${sessionId}`;

	const response = NextResponse.json({ redirectUrl });
	response.cookies.set(STUDENT_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 8, // 8 hours
	});
	return response;
}
