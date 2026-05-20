import Anthropic from "@anthropic-ai/sdk";
import type {
	DocumentBlockParam,
	TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ExtractedQuestion = {
	stem: string;
	choices: string[] | null; // null = free-response
	answer: string;
	standardCode: string | null;
	questionType: "mc" | "free-response";
	topicDay: number | null;
	sourcePage: number | null;
};

export type ExtractionResult = {
	questions: ExtractedQuestion[];
	resourceType: "bell-ringer" | "cfu" | "exit-ticket" | "unknown";
};

const EXTRACTION_PROMPT = `Extract ALL questions from this PDF document.

Respond with ONLY valid JSON (no markdown fences, no explanation):
{
  "resourceType": "bell-ringer" | "cfu" | "exit-ticket" | "unknown",
  "questions": [
    {
      "stem": "the full question text",
      "questionType": "mc" | "free-response",
      "choices": ["A. ...", "B. ...", "C. ...", "D. ..."] | null,
      "answer": "the correct answer or answer key value",
      "standardCode": "MA.5.NSO.1.1" | null,
      "topicDay": 2,
      "sourcePage": 1
    }
  ]
}

Rules:
- resourceType: detect from the document title/header (bell ringer, CFU, check for understanding, exit ticket). Default to "unknown".
- questionType: "mc" if answer choices are present; "free-response" otherwise.
- choices: array of choice strings if MC (include the letter prefix like "A."); null for free-response.
- answer: the correct answer. For MC include the letter (e.g. "A"). For free-response include the expected answer or expression.
- standardCode: FL BEST standard code if visible (e.g. "MA.5.NSO.1.1"); otherwise null.
- topicDay: integer day number extracted from ANY section/page heading that indicates a day (e.g. "Day 1", "Day 2", "Bell Ringer Day 3", "Topic 1: Day 2", "Monday Day 1"). Use the nearest heading above the question. null if no day label is visible.
- sourcePage: 1-based page number within the PDF where this question appears.
- If no questions are found, return an empty questions array.
- Do NOT include directions, headings, or non-question content as stems.`;

export async function extractQuestionsFromPdf(
	pdfBase64: string,
	_filename: string,
	_resourceType: string,
): Promise<ExtractionResult> {
	const docBlock: DocumentBlockParam = {
		type: "document",
		source: {
			type: "base64",
			media_type: "application/pdf",
			data: pdfBase64,
		},
	};
	const textBlock: TextBlockParam = {
		type: "text",
		text: EXTRACTION_PROMPT,
	};

	const response = await client.beta.messages.create({
		model: "claude-sonnet-4-6",
		max_tokens: 4000,
		betas: ["pdfs-2024-09-25"],
		messages: [
			{
				role: "user",
				content: [docBlock, textBlock],
			},
		],
	});

	const raw = response.content[0];
	if (raw.type !== "text") return { questions: [], resourceType: "unknown" };

	try {
		const parsed = JSON.parse(raw.text) as ExtractionResult;
		if (!Array.isArray(parsed.questions)) return { questions: [], resourceType: "unknown" };
		return parsed;
	} catch {
		return { questions: [], resourceType: "unknown" };
	}
}
