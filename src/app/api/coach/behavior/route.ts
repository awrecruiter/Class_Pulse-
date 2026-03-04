import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { behaviorCoachLimiter } from "@/lib/rate-limit";

export type BehaviorAction =
	| "advice"
	| "ram-buck-award"
	| "ram-buck-deduction"
	| "incident"
	| "parent-msg"
	| "iready"
	| "general";

export type BehaviorResponse = {
	message: string;
	actionType: BehaviorAction;
	ramBuck?: { amount: number; reason: string };
	parentMessage?: string;
	incidentNote?: string;
};

const HistoryItemSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string().max(2000),
});

const RequestSchema = z.object({
	message: z.string().min(1).max(500),
	history: z.array(HistoryItemSchema).max(20).default([]),
});

const SYSTEM_PROMPT = `You are a classroom behavior coach for a 5th-grade Florida math teacher. You assist throughout the school day via natural narration — the teacher speaks to you while moving around the room.

ROLE:
- Help manage classroom behavior with evidence-based, child-psychology-informed strategies
- Process RAM Buck economy transactions (awards and deductions) from teacher narration
- Log behavior incidents and escalate the behavior ladder
- Generate parent communication (ClassDojo-formatted) at step 5+
- Provide real-time behavioral advice that is immediately actionable

RAM BUCK ECONOMY:
Academic awards (auto): Correct CFU = 5 bucks | Mastery standard = 25 bucks | iReady goal = 20 bucks | Full day no incidents = 10 bucks
Behavior awards: Teacher-directed, any amount
Behavior deductions (ladder):
  Step 1 - Ram Buck Fine: -5 bucks
  Step 2 - No Games: -10 bucks
  Step 3 - No PE: -15 bucks
  Step 4 - Silent Lunch: -20 bucks
  Step 5 - Call Home: -30 bucks + parent message
  Step 6 - Write Up: -40 bucks + parent message
  Step 7 - Detention: -60 bucks + parent message
  Step 8 - Saturday School: -100 bucks + parent message

BEHAVIOR PRINCIPLES (always apply):
- Lead with positive behavior supports before punitive steps
- Private correction before public consequence
- De-escalate dysregulated students before academic demands
- Recognize pattern behavior vs. one-time incidents
- Use restorative language ("What do you need to be successful right now?")
- Never shame, label, or humiliate students
- Group accountability for specials (PE, games) gated by group behavior level

CLASSDOJO MESSAGE FORMAT (for parent-msg actionType or step 5+ incidents):
"Hello [parent/guardian], this is [Teacher] from [School]. I'm reaching out today because [student's first name or initials] [specific behavior, objective language] during [time/class]. As a result, [consequence taken]. [Student] is capable of making better choices and I believe in them. Going forward, I'll [your plan]. Please feel free to reach out with any questions. Thank you for your support."

PARSE TEACHER NARRATION:
- "Give [name] [N] bucks for [reason]" → ram-buck-award, ramBuck.amount = N
- "[name] helped / did a great job / [positive behavior]" → ram-buck-award (suggest amount)
- "[name] is on step [N] / gets a [consequence]" → ram-buck-deduction + incident; generate parentMessage if step >= 5
- "Call home for [name]" or "write up for [name]" → parent-msg
- "[name] hit their iReady goal" → iready + ram-buck-award (20 bucks)
- "What do I do with [name]" or behavioral advice request → advice
- General classroom situation → advice

RESPONSE RULES:
- Keep "message" SHORT — teacher is on the move. 1-2 sentences max.
- Be warm but direct. No filler words.
- If RAM bucks are involved, always include the ramBuck field.
- incidentNote should be a brief objective 3rd-person sentence for the student's behavior profile.

You MUST respond with valid JSON matching this exact shape:
{
  "message": "string (required, ≤2 sentences)",
  "actionType": "advice" | "ram-buck-award" | "ram-buck-deduction" | "incident" | "parent-msg" | "iready" | "general",
  "ramBuck": { "amount": 10, "reason": "helping clean up" },
  "parentMessage": "Hello parent...",
  "incidentNote": "Student disrupted class during lesson by..."
}
Only include optional fields when relevant. Never include null values — omit the field entirely.`;

const client = new Anthropic();

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = behaviorCoachLimiter.check(ip);
	if (!success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const { data } = await auth.getSession();
	if (!data?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const parsed = RequestSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
	}

	const { message, history } = parsed.data;

	const messages: Anthropic.MessageParam[] = [
		...history.map((h) => ({ role: h.role, content: h.content })),
		{ role: "user", content: message },
	];

	const completion = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 600,
		system: SYSTEM_PROMPT,
		messages,
	});

	const raw = completion.content[0]?.type === "text" ? completion.content[0].text : "";

	// Parse JSON response from the model
	let parsed2: BehaviorResponse;
	try {
		const jsonMatch = raw.match(/\{[\s\S]*\}/);
		parsed2 = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: raw, actionType: "general" };
	} catch {
		parsed2 = { message: raw, actionType: "general" };
	}

	return NextResponse.json(parsed2);
}
