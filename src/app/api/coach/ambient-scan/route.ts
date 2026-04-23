import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { sessionRateLimiter } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const scanSchema = z.object({
	transcript: z.string().min(10).max(5000),
	sessionId: z.string().uuid().optional(),
});

export type AnomalyScanResult = {
	anomalies: Array<{
		type: "confusion-spike" | "off-topic" | "repeated-concept" | "pacing-issue";
		description: string;
		severity: "low" | "medium" | "high";
		suggestion: string;
	}>;
	clean: boolean;
};

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = scanSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { transcript } = result.data;

	const SYSTEM = `You are a classroom awareness assistant. Analyze a lecture transcript excerpt for signs that learning is going off-track. Look for these anomaly types:
- confusion-spike: students repeatedly asking the same question, "I don't get it" patterns, teacher re-explaining the same point multiple times
- off-topic: significant drift from math instruction into unrelated topics
- repeated-concept: same concept explained 3+ times with no apparent student progress
- pacing-issue: lecture moving too fast (jumping topics) or too slow (stalling on one minor point)

Return ONLY valid JSON matching this schema. No other text.
{
  "anomalies": [
    {
      "type": "confusion-spike" | "off-topic" | "repeated-concept" | "pacing-issue",
      "description": "one sentence describing what you observed",
      "severity": "low" | "medium" | "high",
      "suggestion": "one-sentence actionable suggestion for the teacher"
    }
  ],
  "clean": true | false
}

If the transcript looks healthy, return { "anomalies": [], "clean": true }.`;

	try {
		const message = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 400,
			system: SYSTEM,
			messages: [{ role: "user", content: `Transcript:\n${transcript}` }],
		});

		const text = message.content[0]?.type === "text" ? message.content[0].text : "";
		const parsed = JSON.parse(text) as AnomalyScanResult;
		return NextResponse.json(parsed);
	} catch {
		return NextResponse.json({ anomalies: [], clean: true });
	}
}
