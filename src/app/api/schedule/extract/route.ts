import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { type ProposedBlock, parseIcs } from "@/lib/ics-parser";
import { scheduleExtractLimiter } from "@/lib/rate-limit";
import { isSurfaceEnabledForUser } from "@/lib/subscription/gates";

const imageSchema = z.object({
	type: z.literal("image"),
	data: z.string().min(1),
	mimeType: z.string().default("image/jpeg"),
});

const icsSchema = z.object({
	type: z.literal("ics"),
	content: z.string().min(1),
});

const bodySchema = z.discriminatedUnion("type", [imageSchema, icsSchema]);

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = scheduleExtractLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const isEnabled = await isSurfaceEnabledForUser(data.user.id, "planning");
	if (!isEnabled) {
		return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
	}

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	if (result.data.type === "ics") {
		const blocks = parseIcs(result.data.content);
		return NextResponse.json({ blocks });
	}

	// Image — run Claude Vision
	const { data: imageData, mimeType } = result.data;

	try {
		const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
		const response = await client.messages.create({
			model: "claude-sonnet-4-6",
			max_tokens: 2048,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
								data: imageData,
							},
						},
						{
							type: "text",
							text: `You are reading a teacher's daily or weekly school schedule. Extract every time block you can see.

Return ONLY this JSON with no explanation, no markdown fences:
{"blocks":[{"title":"<subject or activity name>","startTime":"<HH:MM 24h>","endTime":"<HH:MM 24h>","dayOfWeek":<0-6 or null>,"color":"<color>"}]}

Rules:
- Include ALL periods, subjects, specials, lunch, recess, planning — everything with a time
- dayOfWeek: null if single-day view; 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat for weekly grids
- Times without AM/PM: assume school hours (7:00–16:00)
- Convert to 24-hour HH:MM (e.g. 1:30 PM → 13:30)
- If end time is missing, estimate based on the next block's start time
- Title: use exactly what's written in the schedule
- color: pick one of [blue, indigo, violet, green, emerald, teal, cyan, red, orange, amber, pink, slate] based on subject type:
  math/numbers → blue | reading/ELA/literacy → emerald | science → teal | social studies/history → violet
  art/music/PE/specials → pink | lunch/recess/break → amber | planning/prep/duty → slate | other → indigo`,
						},
					],
				},
			],
		});

		const raw = (response.content[0] as { type: "text"; text: string }).text;

		// Extract JSON object from anywhere in the response (handles prose, markdown fences, etc.)
		const jsonMatch = raw.match(/\{[\s\S]*\}/);
		let blocks: ProposedBlock[] = [];
		if (jsonMatch) {
			try {
				const parsed = JSON.parse(jsonMatch[0]) as { blocks: ProposedBlock[] };
				blocks = parsed.blocks ?? [];
			} catch {
				blocks = [];
			}
		}

		return NextResponse.json({
			blocks,
			debug: blocks.length === 0 ? raw.slice(0, 800) : undefined,
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[schedule/extract] Claude Vision error:", msg, err);
		return NextResponse.json({ blocks: [], error: msg }, { status: 500 });
	}
}
