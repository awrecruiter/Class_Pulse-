import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { coachRateLimiter } from "@/lib/rate-limit";

export type DiVoiceAction =
	| { action: "score"; groupId: string; delta: number }
	| { action: "add-to-group"; groupId: string; rosterIds: string[] }
	| { action: "unknown" };

const RequestSchema = z.object({
	command: z.string().min(1).max(500),
	groups: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			color: z.string(),
			members: z.array(
				z.object({
					rosterId: z.string(),
					displayName: z.string(),
				}),
			),
		}),
	),
	roster: z.array(
		z.object({
			rosterId: z.string(),
			firstName: z.string().nullable(),
			lastName: z.string().nullable(),
			displayName: z.string(),
		}),
	),
});

const SYSTEM_PROMPT = `You are a DI (Differentiated Instruction) session assistant for a 5th-grade classroom teacher. Parse teacher voice commands into structured actions.

You will receive:
- A teacher voice command (transcribed from speech — may have errors)
- Current groups with their members
- Full class roster

Return ONLY valid JSON (no markdown, no explanation) matching exactly one of these shapes:

Scoring command (teacher adds or removes points from a group):
{"action":"score","groupId":"<uuid>","delta":<number>}
delta is positive for adding points, negative for removing. Extract number from phrases like "gets 2 points", "give Blue 3", "minus 1 for Red".

Add student to group:
{"action":"add-to-group","groupId":"<uuid>","rosterIds":["<uuid>",...]}
Match student names fuzzy/phonetically — handle culturally diverse names (Aaliyah, Jahmir, Deja, Tremaine, Xiomara, Marcus, De'Andre, etc.). Match partial names and initials.

Unknown/unparseable command:
{"action":"unknown"}

Rules:
- Match group names case-insensitively: "red", "Red", "RED" all match the Red group
- For scoring, default delta=1 if no number mentioned
- For student names, do fuzzy phonetic matching — "Marcus" matches "Marcus J.", "Deja" matches "Deja W."
- Only use groupIds from the groups list you receive
- Only use rosterIds from the roster list you receive
- If command is ambiguous or unclear, return {"action":"unknown"}`;

const client = new Anthropic();

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = coachRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const parsed = RequestSchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	const { command, groups, roster } = parsed.data;

	const userMsg = `Command: "${command}"

Groups:
${groups.map((g) => `- ${g.name} (${g.color}) [id: ${g.id}] — members: ${g.members.map((m) => m.displayName).join(", ") || "none"}`).join("\n")}

Roster:
${roster.map((s) => `- ${s.displayName} [rosterId: ${s.rosterId}]`).join("\n")}`;

	try {
		const response = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 400,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: userMsg }],
		});

		const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) return NextResponse.json({ action: "unknown" } satisfies DiVoiceAction);

		const action = JSON.parse(match[0]) as DiVoiceAction;
		return NextResponse.json(action);
	} catch {
		return NextResponse.json({ action: "unknown" } satisfies DiVoiceAction);
	}
}
