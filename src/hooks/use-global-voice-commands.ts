"use client";

import { useCallback, useEffect, useRef } from "react";
import { type BoardCommand, matchBoardCommand } from "@/hooks/use-board-voice";
import { type MicConfig, useMicSlot } from "@/hooks/use-mic-manager";
import {
	PRODUCTION_HANDOFF_MODE_KEY,
	readBooleanPreference,
	VOICE_LOCK_ENABLED_KEY,
} from "@/lib/ui-prefs";
import { detectPitch, getVoiceProfile, pitchMatchesProfile } from "@/lib/voice-profile";

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseGlobalVoiceOptions {
	onCommand?: (data: import("@/contexts/voice-queue").QueueItemData, transcript: string) => void;
	onHeard?: (transcript: string) => void;
	onBoardCommand?: (cmd: BoardCommand, transcript: string) => void;
	onVoiceTranscript?: (transcript: string) => void;
	enabled: boolean;
}

export function useGlobalVoiceCommands({
	onCommand: _onCommand,
	onHeard,
	onBoardCommand,
	onVoiceTranscript,
	enabled,
}: UseGlobalVoiceOptions) {
	const onHeardRef = useRef(onHeard);
	const onBoardCommandRef = useRef(onBoardCommand);
	const onVoiceTranscriptRef = useRef(onVoiceTranscript);
	onHeardRef.current = onHeard;
	onBoardCommandRef.current = onBoardCommand;
	onVoiceTranscriptRef.current = onVoiceTranscript;

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

	const shouldVerifySpeaker = useCallback(() => {
		if (readBooleanPreference(PRODUCTION_HANDOFF_MODE_KEY, false)) return false;
		if (!readBooleanPreference(VOICE_LOCK_ENABLED_KEY, true)) return false;
		return !!getVoiceProfile();
	}, []);

	const speakerVerified = useCallback((): boolean => {
		if (!shouldVerifySpeaker()) return true;
		const profile = getVoiceProfile();
		if (!profile) return true;
		const recent = pitchBufferRef.current;
		if (recent.length === 0) return true;
		const avg = recent.reduce((s, p) => s + p.pitch, 0) / recent.length;
		return pitchMatchesProfile(avg, profile);
	}, [shouldVerifySpeaker]);

	// Start/stop pitch analyser alongside the recognition slot
	useEffect(() => {
		if (enabled && shouldVerifySpeaker()) {
			startPitchAnalyser();
		} else {
			stopPitchAnalyser();
		}
	}, [enabled, shouldVerifySpeaker, startPitchAnalyser, stopPitchAnalyser]);

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
