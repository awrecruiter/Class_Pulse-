"use client";

import { useCallback, useEffect, useRef } from "react";
import type { QueueItemData } from "@/contexts/voice-queue";
import { type BoardCommand, matchBoardCommand } from "@/hooks/use-board-voice";
import { type MicConfig, useMicSlot } from "@/hooks/use-mic-manager";
import { detectPitch, getVoiceProfile, pitchMatchesProfile } from "@/lib/voice-profile";

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUPS = ["dogs", "cats", "birds", "bears"];

const CONSEQUENCE_MAP: Record<string, { step: number; label: string }> = {
	warning: { step: 1, label: "RAM Buck Fine" },
	fine: { step: 1, label: "RAM Buck Fine" },
	"buck fine": { step: 1, label: "RAM Buck Fine" },
	"no games": { step: 2, label: "No Games" },
	"no pe": { step: 3, label: "No PE" },
	"no physical education": { step: 3, label: "No PE" },
	"silent lunch": { step: 4, label: "Silent Lunch" },
	"call home": { step: 5, label: "Call Home" },
	"write up": { step: 6, label: "Write Up" },
	"written up": { step: 6, label: "Write Up" },
	writeup: { step: 6, label: "Write Up" },
	detention: { step: 7, label: "Detention" },
	"saturday school": { step: 8, label: "Saturday School" },
};

const WORD_TO_NUM: Record<string, number> = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
	thirteen: 13,
	fourteen: 14,
	fifteen: 15,
	sixteen: 16,
	seventeen: 17,
	eighteen: 18,
	nineteen: 19,
	twenty: 20,
	"twenty five": 25,
	"twenty-five": 25,
	thirty: 30,
	forty: 40,
	fifty: 50,
	hundred: 100,
	"one hundred": 100,
};

function extractNumber(text: string): number | null {
	const digit = text.match(/\b(\d+)\b/);
	if (digit) return Number.parseInt(digit[1], 10);
	for (const [word, num] of Object.entries(WORD_TO_NUM).sort((a, b) => b[0].length - a[0].length)) {
		if (text.toLowerCase().includes(word)) return num;
	}
	return null;
}

function titleCase(s: string) {
	return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseCommand(raw: string): QueueItemData | null {
	const text = raw.toLowerCase().trim();

	// ── Parent message ─────────────────────────────────────────────────────────
	const parentWords = "(?:parent|mom|dad|mother|father|guardian|family)";
	const triggerWords =
		"(?:message|text|tell|call|contact|notify|send(?:\\s+a\\s+(?:message|text)\\s+to)?)";
	const msgMatch = text.match(
		new RegExp(`${triggerWords}\\s+(\\w+)(?:'s?|s)?\\s+${parentWords}(?:\\s+(.+))?`),
	);
	if (msgMatch) {
		return {
			type: "parent_message",
			studentName: titleCase(msgMatch[1]),
			messageText: (msgMatch[2] ?? "").trim(),
		};
	}

	// ── Group coins ────────────────────────────────────────────────────────────
	for (const group of GROUPS) {
		const patterns = [
			new RegExp(
				`(?:give|award|grant|reward|bonus)\\s+(?:the\\s+)?${group}(?:\\s+group)?\\s+((?:\\w+\\s+){0,3}?)(?:coins?|points?|bucks?|rams?)`,
			),
			new RegExp(
				`${group}(?:\\s+group)?\\s+(?:gets?|get|earns?|earned)\\s+((?:\\w+\\s+){0,3}?)(?:coins?|points?|bucks?|rams?)`,
			),
		];
		for (const p of patterns) {
			const m = text.match(p);
			if (m) {
				const num = extractNumber(m[1] || text);
				if (num) return { type: "group_coins", group: titleCase(group), amount: num };
			}
		}
	}

	// ── RAM Bucks ──────────────────────────────────────────────────────────────
	const bucksPatterns = [
		/(?:give|award|grant|reward|bonus)\s+(\w+)\s+([\w\s]+?)\s+(?:ram\s+)?(?:bucks?|rams?|points?|coins?)/,
		/(\w+)\s+(?:gets?|got|earns?|earned)\s+([\w\s]+?)\s+(?:ram\s+)?(?:bucks?|rams?|points?|coins?)/,
		/(?:give|award|grant|reward|bonus)\s+(\w+)\s+(?:a\s+)?(?:bonus\s+)?(?:of\s+)?([\w\s]+?)\s+(?:ram\s+)?(?:bucks?|rams?|points?|coins?)/,
	];
	for (const p of bucksPatterns) {
		const m = text.match(p);
		if (m) {
			const num = extractNumber(m[2]);
			if (num) return { type: "ram_bucks", studentName: titleCase(m[1]), amount: num };
		}
	}

	// ── Consequence ────────────────────────────────────────────────────────────
	for (const [keyword, info] of Object.entries(CONSEQUENCE_MAP).sort(
		(a, b) => b[0].length - a[0].length,
	)) {
		const kw = keyword.replace(/\s+/g, "\\s+");
		const patterns = [
			new RegExp(`(?:give|log|mark|issue)\\s+(\\w+)\\s+(?:a\\s+|an\\s+)?${kw}`),
			new RegExp(`(\\w+)\\s+(?:gets?|got)\\s+(?:a\\s+|an\\s+)?${kw}`),
			/(?:write\s+up|writeup)\s+(\w+)/,
		];
		for (const p of patterns) {
			const m = text.match(p);
			if (m?.[1] && m[1].length > 1) {
				return {
					type: "consequence",
					studentName: titleCase(m[1]),
					step: info.step,
					stepLabel: info.label,
				};
			}
		}
	}

	// ── Move student to group ──────────────────────────────────────────────────
	const moveGroupPatterns = [
		/(?:put|move|add|place|assign)\s+(\w+)\s+(?:in(?:to)?|to)\s+(?:the\s+)?(\w+)(?:\s+group)?/,
		/(\w+)\s+(?:goes?|join|belongs)\s+(?:to\s+)?(?:the\s+)?(\w+)(?:\s+group)?/,
		/(\w+)\s+(?:is|are)\s+(?:in|with)\s+(?:the\s+)?(\w+)(?:\s+group)?/,
	];
	for (const p of moveGroupPatterns) {
		const m = text.match(p);
		if (m) {
			const studentName = titleCase(m[1]);
			const groupName = titleCase(m[2]);
			const skip = ["a", "an", "the", "his", "her", "my", "their", "this", "that"];
			if (!skip.includes(groupName.toLowerCase()) && groupName.length > 1) {
				return { type: "move_to_group", studentName, groupName };
			}
		}
	}

	return null;
}

// ─── Wake word ────────────────────────────────────────────────────────────────

export const VOICE_WAKE_WORD_KEY = "voice-wake-word";
export const DEFAULT_WAKE_WORD = "coach";

function stripWakeWord(rawTranscript: string): string | null {
	const wakeWord = (() => {
		try {
			return (localStorage.getItem(VOICE_WAKE_WORD_KEY) ?? DEFAULT_WAKE_WORD).toLowerCase().trim();
		} catch {
			return DEFAULT_WAKE_WORD;
		}
	})();

	if (wakeWord === "") return rawTranscript;

	const lower = rawTranscript.toLowerCase();
	const escaped = wakeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = lower.match(new RegExp(`^${escaped}[,\\s]+`));
	if (!match) return null;
	return rawTranscript.slice(match[0].length).trim();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseGlobalVoiceOptions {
	onCommand: (data: QueueItemData, transcript: string) => void;
	onHeard?: (transcript: string) => void;
	onBoardCommand?: (cmd: BoardCommand, transcript: string) => void;
	enabled: boolean;
}

export function useGlobalVoiceCommands({
	onCommand,
	onHeard,
	onBoardCommand,
	enabled,
}: UseGlobalVoiceOptions) {
	const onCommandRef = useRef(onCommand);
	const onHeardRef = useRef(onHeard);
	const onBoardCommandRef = useRef(onBoardCommand);
	onCommandRef.current = onCommand;
	onHeardRef.current = onHeard;
	onBoardCommandRef.current = onBoardCommand;

	// ── Parallel Web Audio analyser for voice-profile pitch verification ────────
	// This uses Web Audio API (getUserMedia) independently — does NOT conflict with
	// SpeechRecognition because it's a separate audio graph, not a second recognizer.
	const audioCtxRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const audioStreamRef = useRef<MediaStream | null>(null);
	const pitchBufferRef = useRef<Array<{ pitch: number; ts: number }>>([]);
	const pitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const startPitchAnalyser = useCallback(async () => {
		if (audioCtxRef.current) return; // already running
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
			const ctx = new AudioContext();
			const source = ctx.createMediaStreamSource(stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 4096;
			source.connect(analyser);
			audioCtxRef.current = ctx;
			analyserRef.current = analyser;
			audioStreamRef.current = stream;

			pitchTimerRef.current = setInterval(() => {
				const pitch = detectPitch(analyser);
				if (pitch !== null) {
					const now = Date.now();
					pitchBufferRef.current.push({ pitch, ts: now });
					pitchBufferRef.current = pitchBufferRef.current.filter((p) => now - p.ts < 2000);
				}
			}, 80);
		} catch {
			// Mic unavailable for parallel audio — voice lock won't function but commands still work
		}
	}, []);

	const stopPitchAnalyser = useCallback(() => {
		if (pitchTimerRef.current) {
			clearInterval(pitchTimerRef.current);
			pitchTimerRef.current = null;
		}
		audioStreamRef.current?.getTracks().forEach((t) => {
			t.stop();
		});
		audioCtxRef.current?.close();
		audioCtxRef.current = null;
		analyserRef.current = null;
		audioStreamRef.current = null;
		pitchBufferRef.current = [];
	}, []);

	const speakerVerified = useCallback((): boolean => {
		const profile = getVoiceProfile();
		if (!profile) return true;
		const recent = pitchBufferRef.current;
		if (recent.length === 0) return true;
		const avg = recent.reduce((s, p) => s + p.pitch, 0) / recent.length;
		return pitchMatchesProfile(avg, profile);
	}, []);

	// Start/stop pitch analyser alongside the recognition slot
	useEffect(() => {
		if (enabled) {
			startPitchAnalyser();
		} else {
			stopPitchAnalyser();
		}
	}, [enabled, startPitchAnalyser, stopPitchAnalyser]);

	// Cleanup on unmount
	useEffect(() => {
		return () => stopPitchAnalyser();
	}, [stopPitchAnalyser]);

	// ── Mic slot ────────────────────────────────────────────────────────────────

	const config: MicConfig = {
		continuous: true,
		interimResults: false,
		onResult: (rawTranscript, isFinal) => {
			if (!isFinal) return;
			onHeardRef.current?.(rawTranscript);

			if (!speakerVerified()) return;

			const commandText = stripWakeWord(rawTranscript);
			if (commandText === null) return;

			const cmd = parseCommand(commandText);
			if (cmd) {
				onCommandRef.current(cmd, rawTranscript);
			} else {
				const boardCmd = matchBoardCommand(commandText);
				if (boardCmd) onBoardCommandRef.current?.(boardCmd, rawTranscript);
			}
		},
	};

	const { isActive, start, stop } = useMicSlot("globalVoice", config);

	useEffect(() => {
		if (enabled) start();
		else stop();
	}, [enabled, start, stop]);

	// Expose stop so VoiceCommandProvider can imperatively kill the mic
	const stopNow = useCallback(() => stop(), [stop]);

	return { isListening: isActive, stop: stopNow };
}
