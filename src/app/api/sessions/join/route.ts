export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { STUDENT_COOKIE, signStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classes, classSessions, rosterEntries } from "@/lib/db/schema";
import { joinRateLimiter } from "@/lib/rate-limit";

const joinSchema = z.object({
	joinCode: z.string().length(6).toUpperCase(),
	studentId: z.string().min(1).max(30),
});

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = joinRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}
	const result = joinSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	// ── Step 1: Look up the session by join code ──────────────────────────────
	let session: typeof classSessions.$inferSelect | undefined;
	try {
		const rows = await db
			.select()
			.from(classSessions)
			.where(
				and(eq(classSessions.joinCode, result.data.joinCode), eq(classSessions.status, "active")),
			);
		session = rows[0];
	} catch (err) {
		console.error("[join POST] session lookup failed", err);
		return NextResponse.json(
			{ error: "Session lookup failed — please try again" },
			{ status: 503 },
		);
	}

	if (!session) {
		return NextResponse.json({ error: "Session not found or already ended" }, { status: 404 });
	}

	// ── Step 2: Look up roster entry ─────────────────────────────────────────
	let rosterEntry: typeof rosterEntries.$inferSelect | undefined;
	try {
		const rows = await db
			.select()
			.from(rosterEntries)
			.where(
				and(
					eq(rosterEntries.classId, session.classId),
					eq(rosterEntries.studentId, result.data.studentId),
				),
			);
		// Filter isActive in JS to avoid potential boolean param issues
		rosterEntry = rows.find((r) => r.isActive);
	} catch (err) {
		console.error("[join POST] roster lookup failed", err);
		return NextResponse.json({ error: "Roster lookup failed — please try again" }, { status: 503 });
	}

	if (!rosterEntry) {
		return NextResponse.json(
			{ error: "Student ID not found in this class. Check your ID and try again." },
			{ status: 404 },
		);
	}

	// ── Step 3a: Load class label ────────────────────────────────────────────
	let cls: typeof classes.$inferSelect | undefined;
	try {
		const rows = await db.select().from(classes).where(eq(classes.id, session.classId));
		cls = rows[0];
	} catch (err) {
		console.error("[join POST] class lookup failed", err);
		return NextResponse.json({ error: "Class lookup failed — please try again" }, { status: 503 });
	}

	// ── Step 3b: Sign token + set cookie ─────────────────────────────────────
	let token: string;
	try {
		token = signStudentToken({
			sessionId: session.id,
			rosterId: rosterEntry.id,
		});
	} catch (err) {
		console.error("[join POST] signStudentToken failed", err);
		return NextResponse.json({ error: "Token signing failed — please try again" }, { status: 500 });
	}

	const response = NextResponse.json({
		sessionId: session.id,
		sessionLabel: cls?.label ?? "",
		date: session.date,
	});

	response.cookies.set(STUDENT_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
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

	try {
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
	} catch (err) {
		console.error("[join GET]", err);
		return NextResponse.json({ error: "Server error — please try again" }, { status: 500 });
	}
}
