import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { animateLimiter } from "@/lib/rate-limit";

const execFileAsync = promisify(execFile);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MANIM_BIN = "/opt/homebrew/bin/manim";
const EDGE_TTS_BIN = "/Library/Frameworks/Python.framework/Versions/3.12/bin/edge-tts";
const FFMPEG_BIN = "/opt/homebrew/bin/ffmpeg";
const OUT_DIR = path.join(process.cwd(), "public", "generated-animations");

// ── Script + narration generation ─────────────────────────────────────────────

type AnimPlan = {
	manimCode: string;
	narration: string; // 2–4 sentences spoken aloud over the animation
};

async function generateAnimPlan(concept: string, transcript: string): Promise<AnimPlan> {
	const msg = await client.messages.create({
		model: "claude-sonnet-4-6",
		max_tokens: 2500,
		messages: [
			{
				role: "user",
				content: `You are generating a narrated Manim animation to help a 5th-grade student understand a concept they are confused about.

MISCONCEPTION / CONCEPT TO ANIMATE: ${concept}

LESSON CONTEXT (last few minutes of teacher transcript):
${transcript.slice(-1200) || "(no transcript — animate the concept directly)"}

OUTPUT: Respond with ONLY valid JSON, no markdown:
{
  "narration": "2–4 warm sentences a teacher would say out loud while drawing this. Start with the student's confusion, then walk through the correct understanding step by step. Simple language, 10-year-old level.",
  "manimCode": "Complete Manim Python script (see rules below)"
}

ANIMATION RULES — the manimCode must follow ALL of these:
1. Single class: AnimScene(Scene)
2. Import ONLY: from manim import *
3. Background: self.camera.background_color = WHITE — always use a white background
4. Text color: always BLACK or dark colors (DARK_BLUE, DARK_GREEN, etc.) — never WHITE text on WHITE
5. ONLY use these Manim color constants (others crash with NameError): WHITE, BLACK, GRAY, GREY, BLUE, BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E, RED, RED_A, RED_B, RED_C, RED_D, RED_E, GREEN, GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E, YELLOW, YELLOW_A, YELLOW_B, YELLOW_C, YELLOW_D, YELLOW_E, ORANGE, GOLD, GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E, TEAL, TEAL_A, TEAL_B, TEAL_C, TEAL_D, TEAL_E, PURPLE, PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E, MAROON, PINK — NEVER use DARK_GREEN, DARK_BLUE, LIGHT_BLUE, LIGHT_GREEN, NAVY, CRIMSON, DARK_RED, or any other invented name
6. Animate step by step — each concept beat is self.play(...) then self.wait(1)
7. Total runtime: 18–28 seconds
8. Font sizes: title=44, labels=36, body=28 — always readable
9. The animation must DIRECTLY show the specific concept: if it is fractions, show fraction bars. If it is coordinate pairs, show a grid with plotted points. If it is multiplication, show area models. Match the visual to the concept.
10. End with the correct answer/rule clearly displayed on screen for 3 seconds
11. NO audio calls, NO external files, NO imports beyond manim

MANIM v0.20.1 STRICT — these CRASH, never use them:
- NEVER pass height= or width= to Axes/NumberLine/VGroup — use x_length= y_length= or scale()
- NEVER pass color= inside axis_config — use stroke_color=
- NEVER use BarChart — build bar graphs from Rectangle objects manually
- NEVER call .move_to() on an object not yet rendered — use .shift() or position at creation
- NumberLine: use length= (not x_length=): NumberLine(x_range=[0,10,1], length=8)
- Axes: use x_length= and y_length=: Axes(x_range=[0,5,1], y_range=[0,5,1], x_length=5, y_length=5)
- NEVER use color names not in the approved list above — DARK_GREEN, DARK_BLUE, LIGHT_BLUE, NAVY, CRIMSON, etc. all raise NameError
- SAFE primitives that never break: Rectangle, Line, Text, MathTex, Arrow, Circle, Square, Dot, VGroup, FadeIn, FadeOut, Write, Create, Transform
- Always add objects to scene with self.play(Create(x)) or self.play(Write(x)) before self.wait()`,
			},
		],
	});

	const raw = msg.content[0];
	if (raw.type !== "text") throw new Error("No script generated");

	const text = raw.text;
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1) throw new Error("No JSON in generation response");

	let plan: AnimPlan;
	try {
		plan = JSON.parse(text.slice(start, end + 1)) as AnimPlan;
	} catch {
		throw new Error("Failed to parse animation plan JSON");
	}

	if (!plan.manimCode || !plan.narration) throw new Error("Incomplete animation plan");

	// Strip any markdown fences from manimCode
	plan.manimCode = plan.manimCode
		.replace(/^```python\n?/m, "")
		.replace(/^```\n?/m, "")
		.replace(/```$/m, "")
		.trim();

	return plan;
}

// ── Narration audio synthesis ──────────────────────────────────────────────────

async function synthesizeNarration(text: string, outPath: string): Promise<void> {
	await execFileAsync(
		EDGE_TTS_BIN,
		["--text", text, "--voice", "en-US-AndrewNeural", "--write-media", outPath],
		{ timeout: 15_000 },
	);
}

// ── Manim render ──────────────────────────────────────────────────────────────

async function renderAnimation(plan: AnimPlan, animId: string): Promise<string> {
	const workDir = await mkdtemp(path.join(tmpdir(), "manim-"));
	const scriptPath = path.join(workDir, "scene.py");
	const audioPath = path.join(workDir, "narration.mp3");

	try {
		// Render video and synthesize narration in parallel
		await writeFile(scriptPath, plan.manimCode, "utf-8");
		const [manimResult, audioOk] = await Promise.allSettled([
			execFileAsync(
				MANIM_BIN,
				["-ql", "--media_dir", workDir, "--disable_caching", "scene.py", "AnimScene"],
				{
					cwd: workDir,
					timeout: 90_000,
					env: {
						...process.env,
						PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
					},
				},
			),
			synthesizeNarration(plan.narration, audioPath),
		]);

		// Surface Manim errors immediately — if it failed, the video file doesn't exist
		if (manimResult.status === "rejected") {
			const reason = manimResult.reason as { message?: string; stderr?: string };
			throw new Error(reason?.message ?? "Manim render failed");
		}

		// Manim outputs to workDir/videos/scene/480p15/AnimScene.mp4
		const rendered = path.join(workDir, "videos", "scene", "480p15", "AnimScene.mp4");

		await mkdir(OUT_DIR, { recursive: true });
		const destFile = path.join(OUT_DIR, `${animId}.mp4`);

		// If narration succeeded, merge audio+video with ffmpeg
		const narrationReady = audioOk.status === "fulfilled";
		if (narrationReady) {
			// Merge: loop video audio track (silent) replaced by narration, shortest wins
			await execFileAsync(
				FFMPEG_BIN,
				[
					"-y",
					"-i",
					rendered,
					"-i",
					audioPath,
					"-c:v",
					"copy",
					"-c:a",
					"aac",
					"-shortest",
					"-map",
					"0:v:0",
					"-map",
					"1:a:0",
					destFile,
				],
				{ timeout: 30_000 },
			);
		} else {
			await cp(rendered, destFile);
		}

		return `/generated-animations/${animId}.mp4`;
	} finally {
		rm(workDir, { recursive: true, force: true }).catch(() => {});
	}
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!animateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many animation requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = (await request.json()) as { concept?: string; transcript?: string };
	const concept = body.concept?.trim();
	const transcript = body.transcript?.trim() ?? "";

	if (!concept) return NextResponse.json({ error: "concept is required" }, { status: 400 });

	const animId = crypto.randomUUID();

	try {
		const plan = await generateAnimPlan(concept, transcript);
		const videoUrl = await renderAnimation(plan, animId);
		return NextResponse.json({ videoUrl, animId });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Render failed";
		console.error("[animate]", msg);
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
