import Anthropic from "@anthropic-ai/sdk";
import { FL_BEST_STANDARDS } from "@/data/fl-best-standards";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type VisualCorrection = {
	type: "area-model" | "fraction-bar" | "number-line";
	caption: string;
	// fraction-bar
	bars?: Array<{ parts: number; filled: number; label: string }>;
	// area-model
	rows?: number;
	cols?: number;
	shadedRows?: number;
	shadedCols?: number;
	// number-line
	min?: number;
	max?: number;
	markers?: Array<{ value: number; label: string }>;
	highlightIndex?: number;
};

export type DrawingAnalysisResult = {
	analysisType: "correct" | "partial" | "misconception";
	analysisText: string; // teacher-facing: what the drawing shows
	studentFeedback: string; // student-facing: short encouragement/correction
	auditoryScript: string; // student-facing TTS: 1-2 sentences read aloud
	visualCorrection: VisualCorrection | null; // correct manipulative to display; null if analysisType is "correct"
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
		max_tokens: 800,
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
  "studentFeedback": "1 sentence of encouraging feedback for the student (simple language for a 10-year-old) — if correct say great job; if partial nudge them; if misconception gently correct without being discouraging",
  "auditoryScript": "1-2 sentences spoken aloud to the student explaining the concept or correction in simple, warm language a 10-year-old can follow. Start with 'Let me help you see this...' or 'Here is another way to think about it...' — only if correct, say 'Great job! You really understand this!'",
  "visualCorrection": null | {
    "type": "area-model" | "fraction-bar" | "number-line",
    "caption": "one sentence describing what the correct visual shows",
    "bars": [{"parts": number 2-10, "filled": number, "label": "string"}],
    "rows": number, "cols": number, "shadedRows": number, "shadedCols": number,
    "min": number, "max": number,
    "markers": [{"value": number, "label": "string"}],
    "highlightIndex": number
  }
}

Rules:
- Set analysisType based on accuracy.
- visualCorrection: if analysisType is "correct", set to null. Otherwise, choose the SINGLE most helpful manipulative that shows the CORRECT representation of the concept — same format as the manipulative schema.
  - "area-model": fraction multiplication/parts of a whole
  - "fraction-bar": comparing/adding fractions
  - "number-line": ordering, place value, mixed numbers
  - Only include fields relevant to the chosen type. Omit unrelated fields.
- auditoryScript: always present, grade-appropriate language, warm and encouraging.`,
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

	parsed.auditoryScript = parsed.auditoryScript ?? parsed.studentFeedback;
	parsed.visualCorrection = parsed.visualCorrection ?? null;

	return parsed;
}
