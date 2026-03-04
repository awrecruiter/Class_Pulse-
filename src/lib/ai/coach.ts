import Anthropic from "@anthropic-ai/sdk";
import { FL_BEST_STANDARDS, formatStandardsForPrompt } from "@/data/fl-best-standards";

const client = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

export type CoachRequest = {
	lessonTranscript: string;
	studentQuery: string;
	pinnedStandards?: string[];
	priorAttempts?: Array<{
		studentQuery: string;
		triedApproach: string;
		deeperContext?: string;
	}>;
};

export type CoachResponse = {
	studentInterpretation: string;
	missingConcept: {
		code: string;
		grade: number;
		description: string;
		explanation: string;
	};
	script: string;
	visual: string;
	microIntervention: string;
	guidingQuestions: string[];
	manipulative: {
		type: "area-model" | "fraction-bar" | "number-line";
		rows?: number;
		cols?: number;
		shadedRows?: number;
		shadedCols?: number;
		bars?: Array<{ parts: number; filled: number; label: string }>;
		min?: number;
		max?: number;
		markers?: Array<{ value: number; label: string }>;
		highlightIndex?: number;
		caption: string;
	} | null;
	gradePrereq: {
		code: string;
		grade: number;
		description: string;
		connection: string;
	} | null;
	below: {
		script: string;
		visual: string;
		microIntervention: string;
		guidingQuestions: string[];
	};
};

const STANDARDS_CORPUS = formatStandardsForPrompt();

const SYSTEM_PROMPT = `You are an expert 5th-grade math instructional coach trained in Florida's FL BEST Math standards.

Your job: given a teacher's lesson transcript and a student's confusion, produce a complete remediation plan a teacher can act on immediately.

IMPORTANT — Student input may be:
- Spoken aloud and transcribed (expect run-ons, filler words, repetition)
- Expressed in fragments ("I don't get the... the number thing")
- Indirect or inverted ("I thought you times them and it gets bigger")
- Missing key vocabulary

Your FIRST task is to interpret what the student actually means and identify the underlying misconception. Do not take their words at face value — read between the lines.

${STANDARDS_CORPUS}

Rules:
1. studentInterpretation: One clear sentence. Translate the student's confused/broken input into a precise description of the misconception. Start with "Student believes..." or "Student thinks..." Never say "The student said..."
2. missingConcept: Trace the FL BEST prerequisite chain to find the specific gap causing this misconception.
3. script: ≤30 words. Exactly what the teacher says out loud right now. Must reference something from today's lesson. No jargon.
4. visual: A quick sketch the teacher draws in under 10 seconds. 1–3 sentences.
5. microIntervention: A 30-second hands-on activity using only what's on the student's desk. 2–4 sentences.
6. guidingQuestions: 3 questions the teacher asks — in order — to lead the student to discover the answer themselves. Each question should build on the last. No yes/no questions.
7. Never use the student's name. Use "they" or "the student".
8. manipulative: Choose ONE visual aid if the concept is spatial/fractional; otherwise set to null.
   - "area-model": fraction multiplication → rows=denominator1, cols=denominator2, shadedRows=numerator1, shadedCols=numerator2
   - "fraction-bar": fraction sense, comparing, adding → bars array (2–4 bars max, parts 2–10, filled ≤ parts)
   - "number-line": ordering, place value, mixed numbers → min/max integers + markers array
   Always set caption: one sentence describing what the visual shows.
   For non-spatial concepts, set manipulative to null.
9. gradePrereq: Find the most relevant standard from the grade BELOW the missingConcept.grade that directly feeds into it. If missingConcept.grade is 3, look in grade 2; if 4, look in grade 3; if 5, look in grade 4.
   - code: the FL BEST code from the lower grade
   - grade: the lower grade number
   - description: the standard's one-sentence description
   - connection: 1–2 sentences explaining how not mastering this lower-grade standard directly causes the missingConcept gap.
   - Set to null only if no meaningful prerequisite from a lower grade exists.
10. below: Produce grade-below versions of all four approaches — same format as the top-level fields, but pitched entirely at gradePrereq.grade understanding. If gradePrereq is null, still produce below using the missingConcept.grade - 1 level as reference.
    - below.script: ≤30 words. What the teacher says when the student can't access the current concept — drops back to the prerequisite level.
    - below.visual: A sketch the teacher draws using only grade-below vocabulary and representations.
    - below.microIntervention: A 30-second activity that builds the prerequisite skill from scratch.
    - below.guidingQuestions: 3 questions starting from the grade-below concept, bridging toward the current lesson.

Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:
{
  "studentInterpretation": "string (one sentence: Student believes/thinks...)",
  "missingConcept": {
    "code": "FL BEST code (e.g. MA.4.FR.2.4)",
    "grade": number,
    "description": "one-sentence standard description",
    "explanation": "2–3 sentences: why this prereq gap causes today's misconception"
  },
  "script": "string (≤30 words, say this out loud right now)",
  "visual": "string (quick sketch description, 1–3 sentences)",
  "microIntervention": "string (30-second hands-on activity, 2–4 sentences)",
  "guidingQuestions": ["question 1", "question 2", "question 3"],
  "manipulative": null | {
    "type": "area-model" | "fraction-bar" | "number-line",
    "rows": number (area-model only, denominator 2–6),
    "cols": number (area-model only, denominator 2–6),
    "shadedRows": number (area-model only, ≤ rows),
    "shadedCols": number (area-model only, ≤ cols),
    "bars": [{"parts": number 2-10, "filled": number ≤ parts, "label": "string"}] (fraction-bar only, 2–4 bars),
    "min": number (number-line only),
    "max": number (number-line only),
    "markers": [{"value": number, "label": "string"}] (number-line only),
    "highlightIndex": number (number-line only, optional),
    "caption": "one sentence describing what the visual shows"
  },
  "gradePrereq": null | {
    "code": "FL BEST code from lower grade (e.g. MA.3.FR.1.2)",
    "grade": number (lower grade),
    "description": "one-sentence standard description",
    "connection": "1–2 sentences: how not mastering this causes the current gap"
  },
  "below": {
    "script": "string (≤30 words, grade-below version of Say It)",
    "visual": "string (1–3 sentences, grade-below version of Draw It)",
    "microIntervention": "string (2–4 sentences, grade-below version of Do It)",
    "guidingQuestions": ["question 1", "question 2", "question 3"]
  }
}`;

export async function getScaffold(req: CoachRequest): Promise<CoachResponse> {
	const pinnedBenchmarks = (req.pinnedStandards ?? [])
		.map((code) => FL_BEST_STANDARDS.find((b) => b.code === code))
		.filter((b): b is NonNullable<typeof b> => b !== undefined);

	const pinnedStandardBlock =
		pinnedBenchmarks.length > 0
			? `TODAY'S STANDARD(S) BEING TAUGHT:\n${pinnedBenchmarks.map((b) => `- ${b.code}: ${b.description}`).join("\n")}
The teacher confirmed these are the standards being taught right now. Ground your interpretation and gap analysis in these standards.\n\n`
			: "";

	const priorAttempts = req.priorAttempts ?? [];
	const priorAttemptsBlock =
		priorAttempts.length > 0
			? `\nPRIOR ATTEMPTS — teacher already tried these but student is still confused:\n${priorAttempts
					.map(
						(a, i) =>
							`Attempt ${i + 1}: Tried "${a.triedApproach}"${a.deeperContext ? `. Teacher noted: "${a.deeperContext}"` : ""}`,
					)
					.join(
						"\n",
					)}\nGo DEEPER: trace the prerequisite chain one more level back. Do NOT repeat any approach already listed.\n`
			: "";

	const userMessage = `${pinnedStandardBlock}Today's lesson transcript (last 15 min):
"""
${req.lessonTranscript.trim() || "(No lesson transcript captured yet — respond based on the student query alone.)"}
"""

What the student said (may be fragmented, transcribed speech, or indirect):
"""
${req.studentQuery.trim()}
"""
${priorAttemptsBlock}
Interpret the student's actual misconception, identify the FL BEST prerequisite gap, and produce all four remediation approaches.`;

	const message = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 2000,
		system: SYSTEM_PROMPT,
		messages: [{ role: "user", content: userMessage }],
	});

	const textBlock = message.content.find((b) => b.type === "text");
	if (!textBlock || textBlock.type !== "text") {
		throw new Error("No text response from AI");
	}

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

	if (
		typeof parsed.studentInterpretation !== "string" ||
		typeof parsed.script !== "string" ||
		typeof parsed.missingConcept?.code !== "string" ||
		typeof parsed.visual !== "string" ||
		typeof parsed.microIntervention !== "string" ||
		!Array.isArray(parsed.guidingQuestions)
	) {
		throw new Error("AI response missing required fields");
	}

	// Default manipulative to null if AI omits it
	parsed.manipulative = parsed.manipulative ?? null;

	// Default gradePrereq to null if AI omits it
	parsed.gradePrereq = parsed.gradePrereq ?? null;

	if (!parsed.below || typeof parsed.below.script !== "string") {
		throw new Error("AI response missing 'below' elaboration");
	}

	return parsed;
}
