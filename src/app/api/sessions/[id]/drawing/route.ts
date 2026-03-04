import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeStudentDrawing } from "@/lib/ai/drawing-analysis";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classSessions, drawingAnalyses } from "@/lib/db/schema";
import { coachRateLimiter } from "@/lib/rate-limit";

const bodySchema = z.object({
	imageBase64: z.string().min(100).max(1_500_000), // ~1MB base64 limit
	standardCode: z.string().min(1).max(50),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = coachRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	// Student auth
	const token = request.cookies.get(STUDENT_COOKIE)?.value;
	if (!token) return NextResponse.json({ error: "Not joined" }, { status: 401 });

	const payload = verifyStudentToken(token);
	if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

	const { id: sessionId } = await params;
	if (payload.sessionId !== sessionId) {
		return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
	}

	// Verify session is active
	const [session] = await db
		.select({ status: classSessions.status })
		.from(classSessions)
		.where(and(eq(classSessions.id, sessionId), eq(classSessions.status, "active")));

	if (!session) return NextResponse.json({ error: "Session not active" }, { status: 410 });

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	}

	const { imageBase64, standardCode } = result.data;

	let analysis: { analysisType: string; analysisText: string; studentFeedback: string };
	try {
		analysis = await analyzeStudentDrawing(imageBase64, standardCode);
	} catch (err) {
		console.error("Drawing analysis failed:", err);
		return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
	}

	// Store result (image NOT stored — only analysis)
	await db.insert(drawingAnalyses).values({
		sessionId,
		rosterId: payload.rosterId,
		standardCode,
		analysisType: analysis.analysisType as "correct" | "partial" | "misconception",
		analysisText: analysis.analysisText,
		studentFeedback: analysis.studentFeedback,
	});

	return NextResponse.json({
		analysisType: analysis.analysisType,
		studentFeedback: analysis.studentFeedback,
	});
}
