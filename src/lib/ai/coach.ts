import Anthropic from "@anthropic-ai/sdk";
import { formatStandardsForPrompt } from "@/data/fl-best-standards";

const client = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

export type CoachRequest = {
	lessonTranscript: string;
	studentQuery: string;
};

export type CoachResponse = {
	script: string;
	missingConcept: {
		code: string;
		grade: number;
		description: string;
		explanation: string;
	};
	visual: string;
	microIntervention: string;
};

const STANDARDS_CORPUS = formatStandardsForPrompt();

const SYSTEM_PROMPT = `You are an expert 5th-grade math instructional coach trained in Florida's FL BEST Math standards.

Your job: given a teacher's lesson transcript and a student's confusion, produce a precise, teacher-executable remediation plan in under 3 seconds.

${STANDARDS_CORPUS}

Rules:
1. Read the lesson transcript to identify the concept being taught.
2. Analyze the student query to find exactly where understanding breaks down.
3. Trace back through the FL BEST prerequisite chain to find the specific gap.
4. The Script MUST explicitly reference something from today's lesson transcript.
5. Keep Script to ≤30 words. One action. Teacher-executable right now.
6. Never mention the student by name. Use "the student" or "they".

Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:
{
  "script": "string (≤30 words, references today's lesson, bridges to prereq)",
  "missingConcept": {
    "code": "FL BEST code (e.g. MA.4.FR.2.4)",
    "grade": number,
    "description": "one-sentence standard description",
    "explanation": "2–3 sentences: why this prereq gap causes today's confusion"
  },
  "visual": "string: describe a quick sketch the teacher can draw right now (1–3 sentences)",
  "microIntervention": "string: a 30-second hands-on activity using what's already on the desk (2–4 sentences)"
}`;

export async function getScaffold(req: CoachRequest): Promise<CoachResponse> {
	const userMessage = `Today's lesson transcript (last 15 min):
"""
${req.lessonTranscript.trim() || "(No lesson transcript captured yet — respond based on the student query alone.)"}
"""

Student confusion:
"""
${req.studentQuery.trim()}
"""

Identify the FL BEST prerequisite gap and produce the JSON remediation plan.`;

	const message = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 700,
		system: SYSTEM_PROMPT,
		messages: [{ role: "user", content: userMessage }],
	});

	const textBlock = message.content.find((b) => b.type === "text");
	if (!textBlock || textBlock.type !== "text") {
		throw new Error("No text response from AI");
	}

	// Strip any accidental markdown code fences
	const raw = textBlock.text
		.replace(/^```(?:json)?\n?/, "")
		.replace(/\n?```$/, "")
		.trim();

	let parsed: CoachResponse;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
	}

	// Basic shape validation
	if (
		typeof parsed.script !== "string" ||
		typeof parsed.missingConcept?.code !== "string" ||
		typeof parsed.visual !== "string" ||
		typeof parsed.microIntervention !== "string"
	) {
		throw new Error("AI response missing required fields");
	}

	return parsed;
}
