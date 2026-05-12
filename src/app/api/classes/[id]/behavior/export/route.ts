export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { behaviorIncidents, classes, rosterEntries } from "@/lib/db/schema";
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

	const incidents = await db
		.select({
			id: behaviorIncidents.id,
			step: behaviorIncidents.step,
			label: behaviorIncidents.label,
			notes: behaviorIncidents.notes,
			ramBuckDeduction: behaviorIncidents.ramBuckDeduction,
			createdAt: behaviorIncidents.createdAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(behaviorIncidents)
		.innerJoin(rosterEntries, eq(behaviorIncidents.rosterId, rosterEntries.id))
		.where(eq(behaviorIncidents.classId, classId))
		.orderBy(desc(behaviorIncidents.createdAt));

	const csvRows = [
		["Date", "Student ID", "Initials", "Step", "Consequence", "RAM Deduction", "Notes"],
		...incidents.map((inc) => [
			inc.createdAt.toISOString().slice(0, 10),
			inc.studentId,
			`${inc.firstInitial}.${inc.lastInitial}.`,
			String(inc.step),
			inc.label,
			String(inc.ramBuckDeduction),
			`"${inc.notes.replace(/"/g, '""')}"`,
		]),
	];

	const csv = csvRows.map((row) => row.join(",")).join("\n");
	const today = new Date().toISOString().slice(0, 10);
	const filename = `behavior-incidents-${classId.slice(0, 8)}-${today}.csv`;

	return new NextResponse(csv, {
		headers: {
			"Content-Type": "text/csv",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
}
