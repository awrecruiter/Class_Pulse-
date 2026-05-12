import { and, eq, isNull, lt, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { behaviorProfiles, classes, teacherSettings } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

function intervalCutoff(schedule: string): Date | null {
	const now = new Date();
	switch (schedule) {
		case "daily": {
			const start = new Date(now);
			start.setHours(0, 0, 0, 0);
			return start;
		}
		case "weekly": {
			const cut = new Date(now);
			cut.setDate(cut.getDate() - 7);
			return cut;
		}
		case "monthly": {
			const cut = new Date(now);
			cut.setMonth(cut.getMonth() - 1);
			return cut;
		}
		case "quarterly": {
			const cut = new Date(now);
			cut.setDate(cut.getDate() - 90);
			return cut;
		}
		default:
			return null; // manual — never auto-reset
	}
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

	const [settings] = await db
		.select({ behaviorResetSchedule: teacherSettings.behaviorResetSchedule })
		.from(teacherSettings)
		.where(eq(teacherSettings.userId, data.user.id));

	const schedule = settings?.behaviorResetSchedule ?? "manual";
	if (schedule === "manual") {
		return NextResponse.json({ ok: true, skipped: true, reason: "manual" });
	}

	const cutoff = intervalCutoff(schedule);
	if (!cutoff) return NextResponse.json({ ok: true, skipped: true, reason: "manual" });

	// Reset only profiles where lastResetAt is null (never reset) or before the cutoff
	const now = new Date();
	const result = await db
		.update(behaviorProfiles)
		.set({ currentStep: 0, lastResetAt: now, updatedAt: now })
		.where(
			and(
				eq(behaviorProfiles.classId, classId),
				or(isNull(behaviorProfiles.lastResetAt), lt(behaviorProfiles.lastResetAt, cutoff)),
			),
		)
		.returning({ id: behaviorProfiles.id });

	return NextResponse.json({ ok: true, resetCount: result.length });
}
