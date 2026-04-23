import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { generateCheckQuestions } from "@/lib/ai/questions";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { coachRateLimiter } from "@/lib/rate-limit";

const bodySchema = z.object({
	manipType: z.enum(["fraction-bar", "area-model", "number-line"]),
	standardCode: z.string().optional(),
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

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const { manipType, standardCode } = result.data;

	try {
		const data = await generateCheckQuestions(manipType, standardCode);
		return NextResponse.json(data);
	} catch (err) {
		console.error("Question generation failed:", err);
		return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
	}
}
