import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { behaviorProfiles, classes, ramBuckAccounts, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export type StudentOverview = {
	rosterId: string;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
	balance: number;
	behaviorStep: number;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;

	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	// Single query: roster LEFT JOIN accounts LEFT JOIN behavior
	const rows = await db
		.select({
			rosterId: rosterEntries.id,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
			balance: ramBuckAccounts.balance,
			behaviorStep: behaviorProfiles.currentStep,
		})
		.from(rosterEntries)
		.leftJoin(
			ramBuckAccounts,
			and(eq(ramBuckAccounts.rosterId, rosterEntries.id), eq(ramBuckAccounts.classId, classId)),
		)
		.leftJoin(
			behaviorProfiles,
			and(eq(behaviorProfiles.rosterId, rosterEntries.id), eq(behaviorProfiles.classId, classId)),
		)
		.where(and(eq(rosterEntries.classId, classId), eq(rosterEntries.isActive, true)))
		.orderBy(rosterEntries.firstInitial, rosterEntries.lastInitial);

	const students: StudentOverview[] = rows.map((r) => ({
		rosterId: r.rosterId,
		studentId: r.studentId,
		firstInitial: r.firstInitial,
		lastInitial: r.lastInitial,
		balance: r.balance ?? 0,
		behaviorStep: r.behaviorStep ?? 0,
	}));

	return NextResponse.json({ students });
}
