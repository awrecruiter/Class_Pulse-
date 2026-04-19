export const dynamic = "force-dynamic";

import { and, between, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { cfuEntries, classes, rosterEntries } from "@/lib/db/schema";
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

	const url = new URL(request.url);
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");

	if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
		return NextResponse.json(
			{ error: "from and to query params required (YYYY-MM-DD)" },
			{ status: 400 },
		);
	}

	const entries = await db
		.select({
			id: cfuEntries.id,
			date: cfuEntries.date,
			standardCode: cfuEntries.standardCode,
			score: cfuEntries.score,
			notes: cfuEntries.notes,
			rosterId: cfuEntries.rosterId,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(cfuEntries)
		.innerJoin(rosterEntries, eq(cfuEntries.rosterId, rosterEntries.id))
		.where(and(eq(cfuEntries.classId, classId), between(cfuEntries.date, from, to)))
		.orderBy(cfuEntries.date, rosterEntries.studentId);

	const SCORE_LABELS: Record<number, string> = {
		0: "Absent",
		1: "Below",
		2: "Approaching",
		3: "Meeting",
		4: "Exceeding",
	};

	const csvRows = [
		["Date", "Student ID", "Initials", "Standard", "Score", "Level", "Notes"],
		...entries.map((e) => [
			e.date,
			e.studentId,
			`${e.firstInitial}.${e.lastInitial}.`,
			e.standardCode,
			String(e.score),
			SCORE_LABELS[e.score] ?? String(e.score),
			`"${e.notes.replace(/"/g, '""')}"`,
		]),
	];

	const csv = csvRows.map((row) => row.join(",")).join("\n");
	const today = new Date().toISOString().slice(0, 10);
	const filename = `gradebook-${classId.slice(0, 8)}-${today}.csv`;

	return new NextResponse(csv, {
		headers: {
			"Content-Type": "text/csv",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
}
