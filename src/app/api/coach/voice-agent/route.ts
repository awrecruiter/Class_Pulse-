import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { QueueItemData } from "@/contexts/voice-queue";
import { auth } from "@/lib/auth/server";
import { voiceAgentLimiter } from "@/lib/rate-limit";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
	transcript: z.string().min(1).max(500),
	context: z.object({
		surfaceId: z.string().optional(),
		surfaceLabel: z.string().optional(),
		surfaceCommands: z.array(z.string()).optional(),
		students: z.array(
			z.object({
				rosterId: z.string(),
				displayName: z.string(),
				firstName: z.string().nullable(),
			}),
		),
		groups: z.array(z.object({ id: z.string(), name: z.string() })),
		hasActiveSession: z.boolean(),
		storeIsOpen: z.boolean(),
		isLectureActive: z.boolean(),
		scheduleBlocks: z
			.array(
				z.object({
					title: z.string(),
					docs: z.array(z.object({ label: z.string(), url: z.string() })),
				}),
			)
			.optional(),
	}),
});

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a voice command classifier for a 5th-grade math classroom management app. A teacher speaks naturally and you classify what they want to do.

Output ONLY valid JSON — no markdown, no explanation, nothing else.

BIAS TOWARD ACTION: when in doubt, classify as an action. Only return {"type":"ignore"} if the utterance is clearly ambient noise, a student speaking, student answers/responses, or general classroom chatter with zero connection to any action schema. If a student name from the roster appears alongside any action-like word, it is almost certainly a command.

Action schemas (pick exactly one):
{"type":"ignore"}
{"type":"consequence","studentName":"<name>","step":<1-8>,"stepLabel":"<label>"}
{"type":"ram_bucks","studentName":"<name>","amount":<number>}
{"type":"ram_bucks_deduct","studentName":"<name>","amount":<number>,"reason":"<reason>"}
{"type":"group_coins","group":"<group name>","amount":<number>}
{"type":"parent_message","studentName":"<name>","messageText":"<message>"}
{"type":"move_to_group","studentName":"<name>","groupName":"<group>"}
{"type":"behavior_log","studentName":"<name>","notes":"<what happened>"}
{"type":"clear_group","groupName":"<group>"}
{"type":"start_session"}
{"type":"end_session"}
{"type":"open_store"}
{"type":"close_store"}
{"type":"start_lecture"}
{"type":"stop_lecture"}
{"type":"navigate","destination":"<board|classes|settings|coach|store|gradebook|parent-comms>"}
{"type":"ask_coach","question":"<question>"}
{"type":"show_schedule"}
{"type":"show_groups"}
{"type":"open_doc","label":"<display name of the doc>","url":"<full URL>"}
{"type":"create_class","label":"<class name>"}
{"type":"open_class","className":"<class name>"}
{"type":"export_gradebook","from":"<YYYY-MM-DD optional>","to":"<YYYY-MM-DD optional>"}
{"type":"approve_purchase","studentName":"<optional>","itemName":"<optional>"}
{"type":"reject_purchase","studentName":"<optional>","itemName":"<optional>"}
{"type":"draft_parent_message","studentName":"<name>","messageText":"<message>"}
{"type":"send_parent_message","studentName":"<name>","messageText":"<message>"}

Rules:
- Behavior OBSERVATION about a student (not explicit punishment) → behavior_log
- Explicit punishment phrase ("give X a warning", "X gets detention") → consequence
- Consequence steps: warning/fine=1, no games=2, no pe=3, silent lunch=4, call home=5, write up=6, detention=7, saturday school=8
- RAM Bucks are individual currency; coins are group currency
- "give/award/add [student] [N] (ram) bucks" → ram_bucks with that amount (speech recognition often mishears "bucks" as "books", "box", "bugs" — treat phonetically similar words as "bucks")
- "take/deduct/remove/fine [N] bucks from [student]" → ram_bucks_deduct with that amount
- Number words: one=1, two=2, three=3, four=4, five=5, six=6, seven=7, eight=8, nine=9, ten=10
- "go to board/classes/settings/store/gradebook/parent comms" → navigate
- Academic question about math concepts → ask_coach
- STUDENT NAME MATCHING — this is critical:
  * The teacher speaks names aloud. Speech recognition transcribes phonetically.
  * Many students have ethnic, cultural, or non-English names whose spelling differs from pronunciation (e.g. spoken "Shomara" → roster "Xiomara", spoken "Jaylen" → roster "Jailyn", spoken "Nyla" → roster "Nailah", spoken "Amari" → roster "Amahri").
  * You MUST match the spoken/transcribed name to the closest name in the provided Students list using phonetic similarity, sound-alike reasoning, and cultural name knowledge.
  * Your output studentName MUST be the exact displayName string from the Students list — never invent a name.
  * If no reasonable match exists, use the closest phonetic match from the list.
- If multiple students are named for the SAME action, put all names comma-separated in studentName (e.g. "Marcus, Sarah, Jordan"). Each name matched independently.
- Group names: match fuzzily (e.g. "dogs" → Dogs)
- "move/put/place/add/assign [student] to/into/in the [group]" or "[student] goes/join [group]" → move_to_group
- "show my schedule" / "what's next" / "open schedule" / "show schedule" → show_schedule
- "show groups" / "show DI groups" / "open groups" / "open DI groups" → show_groups
- "open [doc name]" when the name matches a schedule doc → open_doc with label and URL from context
- "create class <name>" → create_class
- "open <class name>" when talking about a known class → open_class
- "export gradebook" / "download gradebook csv" → export_gradebook
- "approve <student/item> purchase" → approve_purchase
- "reject <student/item> purchase" / "deny <student/item> purchase" → reject_purchase
- "draft message to <student>'s parent <message>" → draft_parent_message
- "send message to <student>'s parent <message>" → send_parent_message
- "close schedule" → treat as ignore (handled client-side by overlay dismiss)`;

// ─── Route ────────────────────────────────────────────────────────────────────

export type VoiceAction = { type: "ignore" } | QueueItemData;

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = voiceAgentLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = schema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { transcript, context } = result.data;

	const studentList =
		context.students.length > 0 ? context.students.map((s) => s.displayName).join(", ") : "none";
	const groupList =
		context.groups.length > 0 ? context.groups.map((g) => g.name).join(", ") : "none";

	const userContent = `Teacher said: "${transcript}"

Class context:
- Current surface: ${context.surfaceLabel ?? context.surfaceId ?? "unknown"}
- Surface commands: ${context.surfaceCommands?.length ? context.surfaceCommands.join(", ") : "none listed"}
- Students: ${studentList}
- Groups: ${groupList}
- Active session: ${context.hasActiveSession ? "yes" : "no"}
- Store: ${context.storeIsOpen ? "open" : "closed"}
- Lecture recording: ${context.isLectureActive ? "on" : "off"}
- Schedule docs available: ${context.scheduleBlocks && context.scheduleBlocks.length > 0 ? context.scheduleBlocks.flatMap((b) => b.docs.map((d) => d.label)).join(", ") : "none"}`;

	try {
		const client = new Anthropic();
		const response = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 256,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: userContent }],
		});

		const raw = (response.content[0] as { type: "text"; text: string }).text;
		// Strip markdown code fences if model wraps JSON despite instructions
		const text = raw
			.replace(/^```(?:json)?\s*/i, "")
			.replace(/\s*```\s*$/, "")
			.trim();

		let action: VoiceAction;
		try {
			action = JSON.parse(text) as VoiceAction;
		} catch {
			action = { type: "ignore" };
		}

		return NextResponse.json({ action });
	} catch {
		// Voice agent failure must be silent — never crash
		return NextResponse.json({ action: { type: "ignore" } });
	}
}
