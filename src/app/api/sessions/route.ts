import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, classSessions } from "@/lib/db/schema";
import { generateJoinCode } from "@/lib/join-code";
import { sessionRateLimiter } from "@/lib/rate-limit";

const createSessionSchema = z.object({
	classId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = createSessionSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	// Verify teacher owns this class
	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, result.data.classId), eq(classes.teacherId, data.user.id)));

	if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

	// End any existing active sessions for this class first
	await db
		.update(classSessions)
		.set({ status: "ended", endedAt: new Date() })
		.where(and(eq(classSessions.classId, result.data.classId), eq(classSessions.status, "active")));

	// Generate unique join code (retry up to 5 times)
	let joinCode = "";
	for (let i = 0; i < 5; i++) {
		const candidate = generateJoinCode();
		const existing = await db
			.select({ id: classSessions.id })
			.from(classSessions)
			.where(eq(classSessions.joinCode, candidate));
		if (existing.length === 0) {
			joinCode = candidate;
			break;
		}
	}
	if (!joinCode)
		return NextResponse.json({ error: "Failed to generate join code" }, { status: 500 });

	const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

	const [session] = await db
		.insert(classSessions)
		.values({
			classId: result.data.classId,
			teacherId: data.user.id,
			joinCode,
			date: today,
			status: "active",
			expiresAt,
		})
		.returning();

	return NextResponse.json({ session }, { status: 201 });
}
