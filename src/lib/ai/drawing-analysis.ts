import Anthropic from "@anthropic-ai/sdk";
import { FL_BEST_STANDARDS } from "@/data/fl-best-standards";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type DrawingAnalysisResult = {
	analysisType: "correct" | "partial" | "misconception";
	analysisText: string; // teacher-facing: what the drawing shows
	studentFeedback: string; // student-facing: short encouragement/correction
};

export async function analyzeStudentDrawing(
	imageBase64: string,
	standardCode: string,
): Promise<DrawingAnalysisResult> {
	const benchmark = FL_BEST_STANDARDS.find((b) => b.code === standardCode);
	const standardContext = benchmark
		? `FL BEST Standard ${benchmark.code} (Grade ${benchmark.grade}): ${benchmark.description}`
		: `FL BEST Standard ${standardCode}`;

	const response = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 400,
		messages: [
			{
				role: "user",
				content: [
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/png",
							data: imageBase64,
						},
					},
					{
						type: "text",
						text: `A 5th-grade student drew this to show their understanding of: ${standardContext}

Analyze the drawing and respond with ONLY valid JSON (no markdown):
{
  "analysisType": "correct" | "partial" | "misconception",
  "analysisText": "1-2 sentences describing what the drawing shows and where any gaps or errors are — teacher-facing, professional tone",
  "studentFeedback": "1 sentence of encouraging feedback for the student (simple language for a 10-year-old) — if correct say great job; if partial nudge them; if misconception gently correct without being discouraging"
}

Use "correct" if the drawing accurately represents the concept.
Use "partial" if it shows some understanding but is incomplete or imprecise.
Use "misconception" if it reveals a fundamental misunderstanding.`,
					},
				],
			},
		],
	});

	const raw = response.content[0];
	if (raw.type !== "text") throw new Error("Unexpected response type");

	let parsed: DrawingAnalysisResult;
	try {
		const json = raw.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
		parsed = JSON.parse(json) as DrawingAnalysisResult;
	} catch {
		throw new Error("Failed to parse drawing analysis response");
	}

	if (!["correct", "partial", "misconception"].includes(parsed.analysisType)) {
		parsed.analysisType = "partial";
	}

	return parsed;
}
