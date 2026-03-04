import Anthropic from "@anthropic-ai/sdk";
import { FL_BEST_STANDARDS } from "@/data/fl-best-standards";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type CheckQuestion = {
	question: string;
	options: string[]; // exactly 4
	correctIndex: number; // 0–3
	explanation: string; // 1 sentence why
};

export type QuestionsResponse = {
	questions: CheckQuestion[];
	standardDescription?: string;
};

// Default standards per manipulative type for presets without a standard code
const DEFAULT_STANDARDS: Record<string, string> = {
	"fraction-bar": "MA.5.FR.1.1",
	"area-model": "MA.5.AR.1.1",
	"number-line": "MA.5.FR.2.1",
};

export async function generateCheckQuestions(
	manipType: "fraction-bar" | "area-model" | "number-line",
	standardCode?: string,
): Promise<QuestionsResponse> {
	const code = standardCode ?? DEFAULT_STANDARDS[manipType] ?? "MA.5.FR.1.1";
	const benchmark = FL_BEST_STANDARDS.find((b) => b.code === code);

	const standardContext = benchmark
		? `FL BEST Standard ${benchmark.code} (Grade ${benchmark.grade}): ${benchmark.description}`
		: `FL BEST Standard ${code}`;

	const manipContext =
		manipType === "fraction-bar"
			? "fraction bars and comparing fractions"
			: manipType === "area-model"
				? "area models for multiplication"
				: "fractions and decimals on a number line";

	const prompt = `${standardContext}

The student just used an interactive ${manipContext} manipulative to explore this concept.

Generate 3 multiple-choice check questions to assess understanding. Make them:
- Question 1: straightforward application (easy)
- Question 2: slightly harder, requires reasoning (medium)
- Question 3: connects to a real-world context or a slight variation (challenge)

Each question must have exactly 4 options. Distractors must reflect real student misconceptions, not random wrong answers. Keep language simple for a 10-year-old.

Respond with ONLY valid JSON, no markdown:
{
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "One sentence explaining why that answer is correct."
    }
  ]
}`;

	const response = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 600,
		messages: [
			{
				role: "user",
				content: prompt,
			},
		],
	});

	const raw = response.content[0];
	if (raw.type !== "text") throw new Error("Unexpected response type");

	let parsed: { questions: CheckQuestion[] };
	try {
		// Strip markdown code fences if model wraps in them
		const json = raw.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
		parsed = JSON.parse(json) as { questions: CheckQuestion[] };
	} catch {
		throw new Error("Failed to parse AI question response");
	}

	if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
		throw new Error("AI returned no questions");
	}

	return {
		questions: parsed.questions.slice(0, 3),
		standardDescription: benchmark?.description,
	};
}
