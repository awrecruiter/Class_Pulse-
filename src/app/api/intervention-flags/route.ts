export const dynamic = "force-dynamic";

import { and, desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, interventionFlags, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export type InterventionFlagRow = {
	id: string;
	classId: string;
	classLabel: string;
	rosterId: string;
	studentDisplay: string; // "J.M. · 10293847"
	tier: string;
	standardCode: string;
	sessionCount: number;
	status: string;
	detectedAt: string;
};

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	// Get all classes owned by this teacher
	const teacherClasses = await db
		.select({ id: classes.id, label: classes.label })
		.from(classes)
		.where(and(eq(classes.teacherId, data.user.id), eq(classes.isArchived, false)));

	if (teacherClasses.length === 0) return NextResponse.json({ flags: [] });

	const classIds = teacherClasses.map((c) => c.id);
	const classMap = new Map(teacherClasses.map((c) => [c.id, c.label]));

	const flags = await db
		.select({
			id: interventionFlags.id,
			classId: interventionFlags.classId,
			rosterId: interventionFlags.rosterId,
			tier: interventionFlags.tier,
			standardCode: interventionFlags.standardCode,
			sessionCount: interventionFlags.sessionCount,
			status: interventionFlags.status,
			detectedAt: interventionFlags.detectedAt,
		})
		.from(interventionFlags)
		.where(
			and(
				inArray(interventionFlags.classId, classIds),
				inArray(interventionFlags.status, ["draft"]),
			),
		)
		.orderBy(desc(interventionFlags.detectedAt))
		.limit(100);

	if (flags.length === 0) return NextResponse.json({ flags: [] });

	const rosterIds = [...new Set(flags.map((f) => f.rosterId))];
	const rosterRows = await db
		.select({
			id: rosterEntries.id,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
			studentId: rosterEntries.studentId,
		})
		.from(rosterEntries)
		.where(inArray(rosterEntries.id, rosterIds));

	const rosterMap = new Map(rosterRows.map((r) => [r.id, r]));

	const result: InterventionFlagRow[] = flags.map((f) => {
		const roster = rosterMap.get(f.rosterId);
		const display = roster
			? `${roster.firstInitial}.${roster.lastInitial}. · ${roster.studentId}`
			: f.rosterId;
		return {
			id: f.id,
			classId: f.classId,
			classLabel: classMap.get(f.classId) ?? "",
			rosterId: f.rosterId,
			studentDisplay: display,
			tier: f.tier,
			standardCode: f.standardCode,
			sessionCount: f.sessionCount,
			status: f.status,
			detectedAt: f.detectedAt.toISOString(),
		};
	});

	return NextResponse.json({ flags: result });
}
