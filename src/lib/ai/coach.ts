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
	scaffoldGrade?: number; // 0-5; undefined = auto
};

export type ScaffoldVisual =
	| {
			type: "sort";
			items: Array<{ emoji: string; label: string; count: number; scale?: number }>;
			bins: Array<{ label: string }>;
	  }
	| {
			type: "table";
			headers: string[];
			rows: Array<{ label: string; emoji: string; count: number; scale?: number }>;
	  }
	| {
			type: "compare";
			groups: Array<{ label: string; emoji: string; count: number; scale?: number }>;
	  }
	| {
			type: "count";
			groups: Array<{ label: string; emoji: string; count: number; scale?: number }>;
	  }
	| {
			type: "select";
			options: Array<{
				label: string;
				headers?: string[];
				rows: Array<{ label: string; emoji: string; count: number }>;
			}>;
	  }
	| null;

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
	scaffoldQuestions: Array<{
		question: string;
		choices: [string, string, string, string];
		correct: number; // 0-3
		hint: string;
		explanation: string;
		visual: ScaffoldVisual;
	}>;
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
6. guidingQuestions: 3 open-ended questions the teacher asks to lead discovery. Each builds on the last. No yes/no questions.
11. scaffoldQuestions: 3 progressive multiple-choice questions that scaffold the student from the prerequisite concept to mastery of the current concept. Structure:
    - Q1: tests the grade-below prerequisite concept directly (should be accessible to the struggling student)
    - Q2: bridges — connects the prerequisite to the current concept (moderate difficulty)
    - Q3: tests the target misconception directly at grade level (should now be reachable)
    Each question must have EXACTLY 4 choices (index 0–3). The correct answer should not always be index 0.
    - hint: 1 sentence shown after a wrong answer — nudge without giving it away
    - explanation: 1–2 sentences shown after a correct answer — why it's right + connects to the next step
    Use simple, grade-appropriate language (10-year-old level).
12. visual (inside EACH scaffold question): REQUIRED for any question involving objects, quantities, tables, charts, diagrams, comparisons, or sorting. Set null ONLY for questions about pure abstract vocabulary with zero visual component.

    DECISION TREE — pick the type that matches the question:
    • Words like "sort", "group", "organize", "put into", "drag" → "sort"
    • Words like "table", "chart", "label", "row", "column", "tally" → "table"
    • Words like "more", "fewer", "less than", "compare", "which has more" → "compare"
    • Words like "how many", "count the", "total in the group" → "count"
    • Words like "which shows", "which table is correct", "which diagram" → "select"

    COPY THESE EXACT STRUCTURES (replace content, never change keys):

    sort — student drags items into bins:
    {"type":"sort","items":[{"emoji":"🔴","label":"Red crayons","count":5,"scale":1},{"emoji":"🔵","label":"Blue crayons","count":3,"scale":1}],"bins":[{"label":"Red"},{"label":"Blue"}]}

    table — question mentions or asks about a table/tally chart:
    {"type":"table","headers":["Animal","Tally"],"rows":[{"label":"Dog","emoji":"🐕","count":3,"scale":1},{"label":"Cat","emoji":"🐈","count":5,"scale":1},{"label":"Bird","emoji":"🐦","count":2,"scale":1}]}

    compare — which group has more or fewer:
    {"type":"compare","groups":[{"label":"Dogs","emoji":"🐕","count":6,"scale":1},{"label":"Cats","emoji":"🐈","count":4,"scale":1}]}

    count — how many objects are in a group:
    {"type":"count","groups":[{"label":"Pencils","emoji":"✏️","count":8,"scale":1}]}

    select — student picks the correct table/diagram from options:
    {"type":"select","options":[{"label":"Option A","headers":["Fruit","Count"],"rows":[{"label":"Apple","emoji":"🍎","count":3},{"label":"Orange","emoji":"🍊","count":5}]},{"label":"Option B","headers":["Fruit","Count"],"rows":[{"label":"Apple","emoji":"🍎","count":5},{"label":"Orange","emoji":"🍊","count":3}]}]}

    Use real emoji matching the subject (crayons→🖍️, apples→🍎, dogs→🐕, books→📚, buttons→🔘, etc.).
    NEVER return null when the question mentions a table, chart, group, count, or concrete objects.
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
    - below.manipulative: Same rules as the top-level manipulative (#8 above), but chosen for the grade-below prerequisite concept. Set to null if the below concept is not spatial/fractional.

CRITICAL: You MUST ALWAYS respond with valid JSON — no exceptions. Even if the student input is a single word, a fragment, or completely vague, make a reasonable educational interpretation and produce the full JSON. Never ask for clarification. Never output prose. If the input is ambiguous, interpret it as the most common 5th-grade math misconception that fits any context clues available.

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
  "scaffoldQuestions": [
    { "question": "...", "choices": ["...","...","...","..."], "correct": number, "hint": "...", "explanation": "...", "visual": null | { "type": "sort"|"table"|"compare"|"count"|"select", ...exact structure from rule 12 examples... } },
    { "question": "...", "choices": ["...","...","...","..."], "correct": number, "hint": "...", "explanation": "...", "visual": null | { ... } },
    { "question": "...", "choices": ["...","...","...","..."], "correct": number, "hint": "...", "explanation": "...", "visual": null | { ... } }
  ],
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
    "guidingQuestions": ["question 1", "question 2", "question 3"],
    "manipulative": null | {
      "type": "area-model" | "fraction-bar" | "number-line",
      "rows": number, "cols": number, "shadedRows": number, "shadedCols": number,
      "bars": [{"parts": number, "filled": number, "label": "string"}],
      "min": number, "max": number,
      "markers": [{"value": number, "label": "string"}],
      "highlightIndex": number,
      "caption": "one sentence describing what the below visual shows"
    }
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

	const gradeModifier =
		req.scaffoldGrade !== undefined
			? req.scaffoldGrade <= 2
				? `SCAFFOLD GRADE OVERRIDE: The student operates at a Kindergarten–Grade ${req.scaffoldGrade === 0 ? "K" : req.scaffoldGrade} level. ALL content must be pitched for this grade. Use concrete counting, physical objects, and simple language. FL BEST codes may be informal. The 'below' section should go one level lower still.\n\n`
				: `SCAFFOLD GRADE OVERRIDE: Pitch ALL content at Grade ${req.scaffoldGrade} level. Adjust the script, visual, micro-intervention, guiding questions, and scaffold questions to be appropriate for a Grade ${req.scaffoldGrade} student. The 'below' section should target Grade ${req.scaffoldGrade - 1}.\n\n`
			: "";

	const userMessage = `${gradeModifier}${pinnedStandardBlock}Today's lesson transcript (last 15 min):
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
		max_tokens: 6000,
		system: SYSTEM_PROMPT,
		messages: [{ role: "user", content: userMessage }],
	});

	if (message.stop_reason === "max_tokens") {
		throw new Error("AI response was too long — token limit hit. Try a shorter transcript.");
	}

	const textBlock = message.content.find((b) => b.type === "text");
	if (!textBlock || textBlock.type !== "text") {
		throw new Error("No text response from AI");
	}

	// Extract JSON robustly — find the outermost { ... } block
	const text = textBlock.text;
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error(`AI response contained no JSON object: ${text.slice(0, 200)}`);
	}
	const raw = text.slice(start, end + 1);

	let parsed: CoachResponse;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`AI returned invalid JSON (last 200): ...${raw.slice(-200)}`);
	}

	if (
		typeof parsed.studentInterpretation !== "string" ||
		typeof parsed.script !== "string" ||
		typeof parsed.missingConcept?.code !== "string" ||
		typeof parsed.missingConcept?.description !== "string" ||
		typeof parsed.missingConcept?.grade !== "number" ||
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

	parsed.below.manipulative = parsed.below?.manipulative ?? null;
	parsed.scaffoldQuestions = Array.isArray(parsed.scaffoldQuestions)
		? // biome-ignore lint/suspicious/noExplicitAny: runtime JSON normalization
			parsed.scaffoldQuestions.map((q: any) => ({ ...q, visual: q.visual ?? null }))
		: [];

	if (!parsed.below || typeof parsed.below.script !== "string") {
		throw new Error("AI response missing 'below' elaboration");
	}

	return parsed;
}
