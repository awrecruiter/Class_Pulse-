"use client";

import { useCallback, useEffect, useRef } from "react";
import { type BoardCommand, matchBoardCommand } from "@/hooks/use-board-voice";
import { type MicConfig, useMicSlot } from "@/hooks/use-mic-manager";
import { playActivationChime } from "@/lib/chime";
import { detectPitch, getVoiceProfile, pitchMatchesProfile } from "@/lib/voice-profile";

const WAKE_PHRASES = ["listen up", "hey coach", "ok listen up"] as const;
const WAKE_TIMEOUT_MS = 6000;

function phraseBoundaryMatch(utterance: string, phrase: string): boolean {
	return new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(
		utterance,
	);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseGlobalVoiceOptions {
	onCommand?: (data: import("@/contexts/voice-queue").QueueItemData, transcript: string) => void;
	onHeard?: (transcript: string) => void;
	onBoardCommand?: (cmd: BoardCommand, transcript: string) => void;
	onVoiceTranscript?: (transcript: string) => void;
	enabled: boolean;
	requireWakePhrase?: boolean;
}

export function useGlobalVoiceCommands({
	onCommand: _onCommand,
	onHeard,
	onBoardCommand,
	onVoiceTranscript,
	enabled,
	requireWakePhrase,
}: UseGlobalVoiceOptions) {
	const onHeardRef = useRef(onHeard);
	const onBoardCommandRef = useRef(onBoardCommand);
	const onVoiceTranscriptRef = useRef(onVoiceTranscript);
	onHeardRef.current = onHeard;
	onBoardCommandRef.current = onBoardCommand;
	onVoiceTranscriptRef.current = onVoiceTranscript;

	// ── Wake phrase gate ────────────────────────────────────────────────────────
	const requireWakePhraseRef = useRef(requireWakePhrase ?? false);
	useEffect(() => {
		requireWakePhraseRef.current = requireWakePhrase ?? false;
	}, [requireWakePhrase]);

	const wakeActiveRef = useRef(false);
	const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const activateWake = useCallback(() => {
		wakeActiveRef.current = true;
		playActivationChime();
		window.dispatchEvent(new CustomEvent("voice:wake-activated"));
		if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
		wakeTimerRef.current = setTimeout(() => {
			wakeActiveRef.current = false;
			window.dispatchEvent(new CustomEvent("voice:wake-expired"));
		}, WAKE_TIMEOUT_MS);
	}, []);

	const extendWake = useCallback(() => {
		if (!wakeActiveRef.current) return;
		if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
		wakeTimerRef.current = setTimeout(() => {
			wakeActiveRef.current = false;
			window.dispatchEvent(new CustomEvent("voice:wake-expired"));
		}, WAKE_TIMEOUT_MS);
	}, []);

	useEffect(() => {
		return () => {
			if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
		};
	}, []);

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
			if (!rawTranscript.trim()) return;
			console.log("[voice] heard:", JSON.stringify(rawTranscript));
			onHeardRef.current?.(rawTranscript);

			// Navigate commands: ALWAYS ungated — teacher must be able to escape.
			const navMatch = rawTranscript
				.toLowerCase()
				.trim()
				.match(
					/\b(?:go(?:\s+to)?|navigate(?:\s+to)?|take(?:\s+me)?(?:\s+to)?|open|switch(?:\s+to)?)\s+(?:the\s+)?(?:my\s+)?(board|classes?|settings|coach|store|gradebook)\b/i,
				);
			console.log("[voice] navMatch:", navMatch ? navMatch[1] : "none");
			if (navMatch) {
				const dest = navMatch[1].toLowerCase().replace(/^class$/, "classes");
				console.log("[voice] NAVIGATING to:", dest);
				window.location.href = `/${dest}`;
				return;
			}

			// Wake phrase gate — applies to board commands and agent calls only
			if (requireWakePhraseRef.current) {
				const lower = rawTranscript.toLowerCase().trim();
				const isWakePhrase = WAKE_PHRASES.some((p) => phraseBoundaryMatch(lower, p));
				if (isWakePhrase) {
					activateWake();
					return; // consume wake phrase — don't process as a command
				}
				if (!wakeActiveRef.current) return; // not awake — drop silently
				extendWake(); // extend the 6s window on each command heard
			}

			if (!speakerVerified()) return;

			// Board commands stay regex — instant, no API call
			const boardCmd = matchBoardCommand(rawTranscript.toLowerCase().trim());
			if (boardCmd) {
				onBoardCommandRef.current?.(boardCmd, rawTranscript);
				return;
			}

			// Everything else → voice agent (async, via VoiceCommandProvider)
			onVoiceTranscriptRef.current?.(rawTranscript);
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
