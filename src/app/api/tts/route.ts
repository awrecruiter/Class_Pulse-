import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { type NextRequest, NextResponse } from "next/server";
import { ttsRateLimiter } from "@/lib/rate-limit";

const execFileAsync = promisify(execFile);

const EDGE_TTS_BIN = "/Library/Frameworks/Python.framework/Versions/3.12/bin/edge-tts";

// Whitelist of allowed voices (Microsoft neural voices)
const ALLOWED_VOICES = new Set([
	"en-US-AvaNeural",
	"en-US-AndrewNeural",
	"en-US-EmmaNeural",
	"en-US-BrianNeural",
	"en-US-JennyNeural",
	"en-US-AriaNeural",
	"en-US-AnaNeural",
	"en-US-GuyNeural",
	"en-US-MichelleNeural",
	"en-US-RogerNeural",
]);

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!ttsRateLimiter.check(ip).success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	let body: { text?: string; voice?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const text = body.text?.trim();
	if (!text || text.length < 1) {
		return NextResponse.json({ error: "text is required" }, { status: 400 });
	}
	if (text.length > 3000) {
		return NextResponse.json({ error: "text too long (max 3000 chars)" }, { status: 400 });
	}

	const voice = body.voice ?? "en-US-AvaNeural";
	if (!ALLOWED_VOICES.has(voice)) {
		return NextResponse.json({ error: "Voice not allowed" }, { status: 400 });
	}

	const outPath = path.join(tmpdir(), `tts-${crypto.randomUUID()}.mp3`);

	try {
		await execFileAsync(
			EDGE_TTS_BIN,
			["--text", text, "--voice", voice, "--write-media", outPath],
			{
				timeout: 15_000,
			},
		);

		const audio = await readFile(outPath);

		return new NextResponse(audio, {
			status: 200,
			headers: {
				"Content-Type": "audio/mpeg",
				"Content-Length": String(audio.byteLength),
				"Cache-Control": "no-store",
			},
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : "TTS failed";
		console.error("[tts]", msg);
		return NextResponse.json({ error: "TTS synthesis failed" }, { status: 500 });
	} finally {
		rm(outPath, { force: true }).catch(() => {});
	}
}
