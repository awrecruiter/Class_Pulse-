export const dynamic = "force-dynamic";

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

Scoring command:
{"action":"score","groupId":"<uuid>","delta":<number>}
delta is positive for adding, negative for removing. Default delta=1 if no number given.

Add one OR MANY students to a group:
{"action":"add-to-group","groupId":"<uuid>","rosterIds":["<uuid>","<uuid>",...]}
rosterIds is an array — always include ALL matched students in a single response.

Examples of list commands (all become one add-to-group with multiple rosterIds):
- "Red group: Marcus, Aaliyah, Jordan" → all three rosterIds in rosterIds array
- "Put Marcus Aaliyah and Jordan in Red"
- "Marcus Aaliyah Jordan — Red"
- "Blue team gets Deja, Tremaine, Xiomara"
- Just a list of names followed by a color: "Jahmir De'Andre Keisha green"

Unknown/unparseable:
{"action":"unknown"}

Rules:
- Match group names case-insensitively
- Fuzzy/phonetic name matching — "Marcus" matches "Marcus J.", speech errors OK
- Handle culturally diverse names: Aaliyah, Jahmir, Deja, Tremaine, Xiomara, De'Andre, Keisha, etc.
- Only use groupIds and rosterIds from the data you receive
- Match as many names as you can from the command — partial matches are fine
- If a name is ambiguous match the closest one; only return unknown if you cannot identify a group at all`;

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
			max_tokens: 800,
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
