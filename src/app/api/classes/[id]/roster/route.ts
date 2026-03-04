import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const addStudentSchema = z.object({
	studentId: z.string().min(1).max(50),
	firstInitial: z
		.string()
		.length(1)
		.regex(/^[A-Za-z]$/),
	lastInitial: z
		.string()
		.length(1)
		.regex(/^[A-Za-z]$/),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;

	// Verify teacher owns this class
	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));

	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = addStudentSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [entry] = await db
		.insert(rosterEntries)
		.values({
			classId,
			studentId: result.data.studentId,
			firstInitial: result.data.firstInitial.toUpperCase(),
			lastInitial: result.data.lastInitial.toUpperCase(),
		})
		.onConflictDoUpdate({
			target: [rosterEntries.classId, rosterEntries.studentId],
			set: {
				firstInitial: result.data.firstInitial.toUpperCase(),
				lastInitial: result.data.lastInitial.toUpperCase(),
				isActive: true,
			},
		})
		.returning();

	return NextResponse.json({ student: entry }, { status: 201 });
}
