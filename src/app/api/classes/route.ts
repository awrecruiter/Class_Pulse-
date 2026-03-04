import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const createClassSchema = z.object({
	label: z.string().min(1).max(100),
	periodTime: z.string().max(20).default(""),
	gradeLevel: z.string().max(10).default("5"),
	subject: z.string().max(50).default("Math"),
});

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await db.select().from(classes).where(eq(classes.teacherId, data.user.id));

	// Attach roster counts
	const withCounts = await Promise.all(
		rows.map(async (cls) => {
			const roster = await db
				.select({ id: rosterEntries.id })
				.from(rosterEntries)
				.where(eq(rosterEntries.classId, cls.id));
			return { ...cls, studentCount: roster.length };
		}),
	);

	return NextResponse.json({ classes: withCounts });
}

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = createClassSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [created] = await db
		.insert(classes)
		.values({
			teacherId: data.user.id,
			label: result.data.label,
			periodTime: result.data.periodTime,
			gradeLevel: result.data.gradeLevel,
			subject: result.data.subject,
		})
		.returning();

	return NextResponse.json({ class: created }, { status: 201 });
}
