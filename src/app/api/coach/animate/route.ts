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
const OUT_DIR = path.join(process.cwd(), "public", "generated-animations");

// ── Script generation ──────────────────────────────────────────────────────────

async function generateManimScript(concept: string, transcript: string): Promise<string> {
	const msg = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 2000,
		messages: [
			{
				role: "user",
				content: `Generate a complete Manim Community v0.20.1 Python script to animate this 5th-grade math concept on the fly.

CONCEPT THAT CONFUSED STUDENTS: ${concept}

RECENT LESSON TRANSCRIPT (for context):
${transcript.slice(-1200)}

RULES — follow exactly:
- Single class named AnimScene(Scene)
- Import only: from manim import *
- Use vivid colors: YELLOW, BLUE, GREEN, RED, TEAL, ORANGE, PURPLE, WHITE, GOLD
- Animate step by step — each step self.play() then self.wait(1)
- Total runtime 15–25 seconds
- Large readable text (font_size 36–48 for labels)
- Show the concept visually — fraction bars, number lines, grids, arrows — whatever makes it click
- End with a clean summary on screen
- NO audio, NO external files, NO imports beyond manim
- Output ONLY the Python code, nothing else`,
			},
		],
	});

	const raw = msg.content[0];
	if (raw.type !== "text") throw new Error("No script generated");

	// Strip markdown code fences if Claude wrapped it
	return raw.text
		.replace(/^```python\n?/m, "")
		.replace(/^```\n?/m, "")
		.replace(/```$/m, "")
		.trim();
}

// ── Manim render ──────────────────────────────────────────────────────────────

async function renderAnimation(script: string, animId: string): Promise<string> {
	const workDir = await mkdtemp(path.join(tmpdir(), "manim-"));
	const scriptPath = path.join(workDir, "scene.py");

	try {
		await writeFile(scriptPath, script, "utf-8");

		// Render at low quality for speed (~15s typical)
		await execFileAsync(
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
		);

		// Manim outputs to workDir/videos/scene/480p15/AnimScene.mp4
		const rendered = path.join(workDir, "videos", "scene", "480p15", "AnimScene.mp4");

		await mkdir(OUT_DIR, { recursive: true });
		const destFile = path.join(OUT_DIR, `${animId}.mp4`);
		await cp(rendered, destFile);

		return `/generated-animations/${animId}.mp4`;
	} finally {
		// Clean up temp dir async, don't block response
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
		const script = await generateManimScript(concept, transcript);
		const videoUrl = await renderAnimation(script, animId);
		return NextResponse.json({ videoUrl, animId });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Render failed";
		console.error("[animate]", msg);
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
