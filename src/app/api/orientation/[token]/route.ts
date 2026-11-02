import { randomInt } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { STUDENT_COOKIE, signStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import {
	classSessions,
	comprehensionSignals,
	orientations,
	parentContacts,
	rosterEntries,
	teacherSettings,
} from "@/lib/db/schema";
import { findOrientation } from "@/lib/orientation/server";
import { type OrientationView, orientationIntakeSchema } from "@/lib/orientation/validation";
import { joinRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };
const json = (body: unknown, status = 200) =>
	NextResponse.json(body, {
		status,
		headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
	});

async function lookup(request: NextRequest, context: Context) {
	if (!joinRateLimiter.check(request.headers.get("x-forwarded-for") ?? "anonymous").success)
		return json({ error: "Too many requests. Please try again shortly." }, 429);
	const row = await findOrientation((await context.params).token);
	return (
		row ??
		json(
			{ error: "This orientation link is unavailable or expired. Ask your tutor for a new link." },
			404,
		)
	);
}

export async function GET(request: NextRequest, context: Context) {
	const row = await lookup(request, context);
	if (row instanceof NextResponse) return row;
	const [settings] = await db
		.select({ bookingUrl: teacherSettings.studentBookingUrl })
		.from(teacherSettings)
		.where(eq(teacherSettings.userId, row.classroom.teacherId));
	const view: OrientationView = {
		classLabel: row.classroom.label,
		defaultGrade: row.classroom.gradeLevel,
		content: row.invite.content,
		bookingUrl: settings?.bookingUrl ?? "",
		quizUrl: row.invite.rosterId ? row.invite.quizUrl : "",
		meetingUrl: row.invite.rosterId ? row.invite.meetingUrl : "",
		enrolled: !!row.invite.rosterId,
	};
	return json(view);
}

export async function POST(request: NextRequest, context: Context) {
	const row = await lookup(request, context);
	if (row instanceof NextResponse) return row;
	const body = await request.json().catch(() => null);
	if (body?.action === "join") {
		if (!row.invite.rosterId) return json({ error: "Complete orientation first." }, 409);
		const [student] = await db
			.select({ id: rosterEntries.id })
			.from(rosterEntries)
			.where(
				and(
					eq(rosterEntries.id, row.invite.rosterId),
					eq(rosterEntries.classId, row.classroom.id),
					eq(rosterEntries.isActive, true),
				),
			);
		if (!student) return json({ error: "Your tutor needs to reactivate your enrollment." }, 403);
		const [session] = await db
			.select({ id: classSessions.id })
			.from(classSessions)
			.where(
				and(
					eq(classSessions.classId, row.classroom.id),
					eq(classSessions.status, "active"),
					gt(classSessions.expiresAt, new Date()),
				),
			);
		if (!session)
			return json(
				{
					error:
						"Your tutor has not opened the classroom yet. You can still book a time or use the assigned quiz link.",
				},
				409,
			);
		// Use the same signed student identity and comprehension signal as the existing quiz portal.
		const token = signStudentToken({ sessionId: session.id, rosterId: student.id });
		if (row.invite.initialSignal)
			await db.transaction(async (tx) => {
				const [claimed] = await tx
					.update(orientations)
					.set({ checkInSessionId: session.id })
					.where(and(eq(orientations.id, row.invite.id), isNull(orientations.checkInSessionId)))
					.returning({ id: orientations.id });
				if (claimed)
					await tx
						.insert(comprehensionSignals)
						.values({
							sessionId: session.id,
							rosterId: student.id,
							signal: row.invite.initialSignal ?? "almost",
							lostSince: row.invite.initialSignal === "lost" ? new Date() : null,
						})
						.onConflictDoNothing();
			});
		const response = json({ url: `/student/${session.id}` });
		response.cookies.set(STUDENT_COOKIE, token, {
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			secure: request.nextUrl.protocol === "https:",
			maxAge: 30 * 24 * 60 * 60,
		});
		return response;
	}
	const result = orientationIntakeSchema.safeParse(body);
	if (!result.success) return json({ error: result.error.issues[0]?.message }, 400);
	// Lock the invitation so retrying the form cannot create another student or overwrite a completed intake.
	const saved = await db.transaction(async (tx) => {
		const [invite] = await tx
			.select()
			.from(orientations)
			.where(and(eq(orientations.id, row.invite.id), gt(orientations.expiresAt, new Date())))
			.for("update");
		if (!invite) return false;
		if (invite.rosterId) return true;
		const input = result.data;
		const [student] = await tx
			.insert(rosterEntries)
			.values({
				classId: invite.classId,
				studentId: String(randomInt(100_000_000_000, 999_999_999_999)),
				firstName: input.studentFirstName,
				firstInitial: input.studentFirstName[0].toUpperCase(),
				lastInitial: input.studentLastInitial.toUpperCase(),
			})
			.returning({ id: rosterEntries.id });
		await tx.insert(parentContacts).values({
			classId: invite.classId,
			rosterId: student.id,
			parentName: input.parentName,
			phone: input.phone,
		});
		await tx
			.update(orientations)
			.set({
				rosterId: student.id,
				parentEmail: input.parentEmail,
				gradeLevel: input.gradeLevel,
				learningContent: input.learningContent,
				initialSignal: input.initialSignal,
				enrolledAt: new Date(),
			})
			.where(eq(orientations.id, invite.id));
		return true;
	});
	return saved ? json({ ok: true }) : json({ error: "This orientation link has expired." }, 404);
}
