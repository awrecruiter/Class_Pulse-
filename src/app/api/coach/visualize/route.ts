import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { coachRateLimiter } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const bodySchema = z.object({
	transcript: z.string().min(20).max(5000),
	pinnedStandards: z.array(z.string()).optional(),
});

export type VisualResponse = {
	concept: string;
	visual: string;
	keyPoints: string[];
};

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = coachRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { transcript, pinnedStandards } = result.data;

	// Use last ~300 words of transcript for recency
	const words = transcript.trim().split(/\s+/);
	const recentTranscript = words.slice(-300).join(" ");

	const standardsHint =
		pinnedStandards && pinnedStandards.length > 0
			? `Pinned FL BEST standards: ${pinnedStandards.join(", ")}.`
			: "";

	const prompt = `You are watching a 5th grade Florida math teacher lecture. Based on the last few minutes of their spoken lesson, identify the concept they are currently teaching and generate a clear visual representation.

${standardsHint}

Recent lesson transcript:
"${recentTranscript}"

Generate a concise "virtual whiteboard snapshot" — what would a teacher write on the board right now?

Respond with ONLY valid JSON (no markdown):
{
  "concept": "Short concept name (5–8 words max)",
  "visual": "A clear text/ASCII diagram of the concept (use ─, │, ×, ÷, fractions like ¹/₂, arrows →, etc). 3–6 lines max. Should look like whiteboard work.",
  "keyPoints": ["point 1", "point 2", "point 3"]
}

Rules:
- concept must be specific (e.g. "Adding fractions with unlike denominators" not "Math")
- visual must actually show math — numbers, diagrams, models, not just words
- keyPoints: exactly 3, each under 10 words, action-oriented ("Find the LCD first")
- Keep it grade-appropriate for 5th graders`;

	try {
		const response = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 300,
			messages: [{ role: "user", content: prompt }],
		});

		const raw = response.content[0];
		if (raw.type !== "text") throw new Error("Unexpected response type");

		const json = raw.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
		const parsed = JSON.parse(json) as VisualResponse;

		return NextResponse.json(parsed);
	} catch (err) {
		console.error("Visualizer failed:", err);
		return NextResponse.json({ error: "Failed to generate visual" }, { status: 500 });
	}
}
