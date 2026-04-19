export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { behaviorIncidents, behaviorProfiles, classes, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const profiles = await db
		.select({
			id: behaviorProfiles.id,
			rosterId: behaviorProfiles.rosterId,
			currentStep: behaviorProfiles.currentStep,
			teacherNotes: behaviorProfiles.teacherNotes,
			lastIncidentAt: behaviorProfiles.lastIncidentAt,
			lastResetAt: behaviorProfiles.lastResetAt,
			updatedAt: behaviorProfiles.updatedAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(behaviorProfiles)
		.innerJoin(rosterEntries, eq(behaviorProfiles.rosterId, rosterEntries.id))
		.where(eq(behaviorProfiles.classId, classId));

	// Get last incident for each student
	const allIncidents = await db
		.select()
		.from(behaviorIncidents)
		.where(eq(behaviorIncidents.classId, classId))
		.orderBy(behaviorIncidents.createdAt);

	const lastIncidentMap: Record<string, (typeof allIncidents)[0]> = {};
	for (const incident of allIncidents) {
		lastIncidentMap[incident.rosterId] = incident;
	}

	const profilesWithIncidents = profiles.map((p) => ({
		...p,
		lastIncident: lastIncidentMap[p.rosterId] ?? null,
	}));

	return NextResponse.json({ profiles: profilesWithIncidents });
}
