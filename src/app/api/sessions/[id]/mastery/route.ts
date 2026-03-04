import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classSessions, masteryRecords, teacherSettings } from "@/lib/db/schema";
import { awardRamBucks } from "@/lib/ram-bucks";
import { joinRateLimiter } from "@/lib/rate-limit";

const MASTERY_DEFAULT_THRESHOLD = 3;
const AWARD_CORRECT = 5;
const AWARD_MASTERY = 25;

const bodySchema = z.object({
	standardCode: z.string().min(1),
	isCorrect: z.boolean(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = joinRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const token = request.cookies.get(STUDENT_COOKIE)?.value;
	if (!token) return NextResponse.json({ error: "Not joined" }, { status: 401 });

	const payload = verifyStudentToken(token);
	if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

	const { id: sessionId } = await params;
	if (payload.sessionId !== sessionId) {
		return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
	}

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const { standardCode, isCorrect } = result.data;

	// Look up teacher's mastery threshold + classId for RAM Buck awards
	const [session] = await db
		.select({ teacherId: classSessions.teacherId, classId: classSessions.classId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	let threshold = MASTERY_DEFAULT_THRESHOLD;
	if (session) {
		const [settings] = await db
			.select({ masteryThreshold: teacherSettings.masteryThreshold })
			.from(teacherSettings)
			.where(eq(teacherSettings.userId, session.teacherId));
		if (settings) threshold = settings.masteryThreshold;
	}

	// Fetch existing record
	const [existing] = await db
		.select()
		.from(masteryRecords)
		.where(
			and(
				eq(masteryRecords.sessionId, sessionId),
				eq(masteryRecords.rosterId, payload.rosterId),
				eq(masteryRecords.standardCode, standardCode),
			),
		)
		.limit(1);

	const now = new Date();
	const prevStreak = existing?.consecutiveCorrect ?? 0;
	const prevTotal = existing?.totalAttempts ?? 0;
	const wasAlreadyMastered = existing?.status === "mastered";

	const newStreak = isCorrect ? prevStreak + 1 : 0;
	const newTotal = prevTotal + 1;
	const achieved = !wasAlreadyMastered && newStreak >= threshold;
	const newStatus = achieved || wasAlreadyMastered ? "mastered" : "working";

	if (existing) {
		await db
			.update(masteryRecords)
			.set({
				consecutiveCorrect: newStreak,
				totalAttempts: newTotal,
				status: newStatus,
				achievedAt: achieved ? now : existing.achievedAt,
				updatedAt: now,
			})
			.where(eq(masteryRecords.id, existing.id));
	} else {
		await db.insert(masteryRecords).values({
			sessionId,
			rosterId: payload.rosterId,
			standardCode,
			consecutiveCorrect: newStreak,
			totalAttempts: newTotal,
			status: newStatus,
			achievedAt: achieved ? now : null,
			updatedAt: now,
		});
	}

	// Award RAM Bucks for academic performance
	let ramBuckEarned = 0;
	let newRamBalance: number | null = null;

	if (session) {
		if (achieved) {
			// Just hit mastery threshold — award mastery bonus only (not +correct too)
			const result = await awardRamBucks({
				classId: session.classId,
				rosterId: payload.rosterId,
				sessionId,
				type: "academic-mastery",
				amount: AWARD_MASTERY,
				reason: `Mastered ${standardCode}`,
			});
			ramBuckEarned = AWARD_MASTERY;
			newRamBalance = result.newBalance;
		} else if (isCorrect && !wasAlreadyMastered) {
			// Correct answer, not yet mastered
			const result = await awardRamBucks({
				classId: session.classId,
				rosterId: payload.rosterId,
				sessionId,
				type: "academic-correct",
				amount: AWARD_CORRECT,
				reason: `Correct answer on ${standardCode}`,
			});
			ramBuckEarned = AWARD_CORRECT;
			newRamBalance = result.newBalance;
		}
	}

	return NextResponse.json({
		consecutiveCorrect: newStreak,
		totalAttempts: newTotal,
		threshold,
		achieved,
		status: newStatus,
		ramBuckEarned,
		newRamBalance,
	});
}

// GET — teacher can query mastery count for the session
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: sessionId } = await params;

	const records = await db
		.select({
			status: masteryRecords.status,
			standardCode: masteryRecords.standardCode,
		})
		.from(masteryRecords)
		.where(eq(masteryRecords.sessionId, sessionId));

	const mastered = records.filter((r) => r.status === "mastered").length;
	const working = records.filter((r) => r.status === "working").length;

	return NextResponse.json({ mastered, working, total: records.length });
}
