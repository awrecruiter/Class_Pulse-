import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { STUDENT_COOKIE, signStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classes, classSessions, rosterEntries } from "@/lib/db/schema";
import { joinRateLimiter } from "@/lib/rate-limit";

const joinSchema = z.object({
	joinCode: z.string().length(6).toUpperCase(),
	rosterId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = joinRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const body = await request.json();
	const result = joinSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	// Look up the session by join code
	const [session] = await db
		.select()
		.from(classSessions)
		.where(
			and(eq(classSessions.joinCode, result.data.joinCode), eq(classSessions.status, "active")),
		);

	if (!session) {
		return NextResponse.json({ error: "Session not found or already ended" }, { status: 404 });
	}

	// Verify the chosen roster entry belongs to this session's class
	const [rosterEntry] = await db
		.select()
		.from(rosterEntries)
		.where(
			and(
				eq(rosterEntries.id, result.data.rosterId),
				eq(rosterEntries.classId, session.classId),
				eq(rosterEntries.isActive, true),
			),
		);

	if (!rosterEntry) {
		return NextResponse.json({ error: "Student not on roster" }, { status: 403 });
	}

	// Get class info for display
	const [cls] = await db.select().from(classes).where(eq(classes.id, session.classId));

	// Sign the student token
	const token = signStudentToken({
		sessionId: session.id,
		rosterId: rosterEntry.id,
	});

	const response = NextResponse.json({
		sessionId: session.id,
		sessionLabel: cls?.label ?? "",
		date: session.date,
	});

	// Set signed cookie — HttpOnly, SameSite=Lax
	response.cookies.set(STUDENT_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		// Expire when session ends (30 days max)
		maxAge: 30 * 24 * 60 * 60,
	});

	return response;
}

// Separate GET endpoint for looking up a session by code (before picking a name)
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = joinRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const code = request.nextUrl.searchParams.get("code")?.toUpperCase();
	if (!code || code.length !== 6) {
		return NextResponse.json({ error: "Invalid code" }, { status: 400 });
	}

	const [session] = await db
		.select()
		.from(classSessions)
		.where(and(eq(classSessions.joinCode, code), eq(classSessions.status, "active")));

	if (!session) {
		return NextResponse.json({ error: "Session not found or already ended" }, { status: 404 });
	}

	// Return roster for this class (so student can pick their name)
	const roster = await db
		.select()
		.from(rosterEntries)
		.where(and(eq(rosterEntries.classId, session.classId), eq(rosterEntries.isActive, true)));

	const [cls] = await db.select().from(classes).where(eq(classes.id, session.classId));

	return NextResponse.json({
		sessionId: session.id,
		sessionLabel: cls?.label ?? "",
		date: session.date,
		roster: roster.map((r) => ({
			id: r.id,
			display: `${r.firstInitial}.${r.lastInitial}.`,
			studentId: r.studentId,
		})),
	});
}
