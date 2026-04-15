"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type MicConfig, useMicSlot } from "@/hooks/use-mic-manager";

const MAX_WORDS = 2500;

function trimToWordLimit(text: string, limit: number): string {
	const words = text.trim().split(/\s+/);
	if (words.length <= limit) return text;
	return words.slice(words.length - limit).join(" ");
}

export type UseLectureTranscriptReturn = {
	transcript: string;
	isListening: boolean;
	wordCount: number;
	startListening: () => void;
	stopListening: () => void;
	clearTranscript: () => void;
	isSupported: boolean;
};

interface UseLectureTranscriptOptions {
	onFinalResult?: (text: string) => void;
}

export function useLectureTranscript(
	options?: UseLectureTranscriptOptions,
): UseLectureTranscriptReturn {
	const onFinalResultRef = useRef(options?.onFinalResult);
	useEffect(() => {
		onFinalResultRef.current = options?.onFinalResult;
	});

	const [transcript, setTranscript] = useState("");
	const [wantsListening, setWantsListening] = useState(false);
	const [isSupported, setIsSupported] = useState(false);
	const accumulatedRef = useRef<string>("");
	// Track interim text separately so we don't corrupt the accumulated buffer
	const interimRef = useRef<string>("");

	useEffect(() => {
		const supported =
			typeof window !== "undefined" &&
			("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
		setIsSupported(supported);
	}, []);

	const config: MicConfig = {
		continuous: true,
		interimResults: true,
		onResult: (text, isFinal) => {
			if (isFinal) {
				const finalText = `${text} `;
				accumulatedRef.current = trimToWordLimit(accumulatedRef.current + finalText, MAX_WORDS);
				interimRef.current = "";
				onFinalResultRef.current?.(text.trim());
				setTranscript(trimToWordLimit(accumulatedRef.current, MAX_WORDS));
			} else {
				interimRef.current = text;
				const display = trimToWordLimit(
					`${accumulatedRef.current}[${interimRef.current}]`,
					MAX_WORDS,
				);
				setTranscript(display);
			}
		},
		onNaturalEnd: () => {
			// Manager handles auto-restart — nothing to do here
		},
	};

	const { isActive, start, stop } = useMicSlot("lecture", config);

	// isListening = we want it AND we actually have the mic
	const isListening = wantsListening && isActive;

	const startListening = useCallback(() => {
		setWantsListening(true);
		start();
	}, [start]);

	const stopListening = useCallback(() => {
		setWantsListening(false);
		stop();
	}, [stop]);

	const clearTranscript = useCallback(() => {
		accumulatedRef.current = "";
		interimRef.current = "";
		setTranscript("");
	}, []);

	// Suppress voice command phrases from the lecture transcript
	useEffect(() => {
		function handleCommandText(e: Event) {
			const text = ((e as CustomEvent<{ text: string }>).detail.text ?? "").trim().toLowerCase();
			if (!text) return;
			const lower = accumulatedRef.current.toLowerCase();
			const idx = lower.lastIndexOf(text);
			if (idx !== -1) {
				accumulatedRef.current = (
					accumulatedRef.current.slice(0, idx) + accumulatedRef.current.slice(idx + text.length)
				)
					.replace(/\s+/g, " ")
					.trim();
				setTranscript(trimToWordLimit(accumulatedRef.current, MAX_WORDS));
			}
		}
		window.addEventListener("voice-command-text", handleCommandText);
		return () => window.removeEventListener("voice-command-text", handleCommandText);
	}, []);

	// If we wanted listening but lost the mic (e.g. another consumer took over),
	// reacquire when it becomes available again — manager handles this via applyState.
	// We just need to make sure wantsActive stays true.

	// Cleanup
	useEffect(() => {
		return () => {
			stop();
		};
	}, [stop]);

	const wordCount = transcript
		? transcript
				.replace(/\[.*?\]/g, "")
				.trim()
				.split(/\s+/)
				.filter(Boolean).length
		: 0;

	return {
		transcript,
		isListening,
		wordCount,
		startListening,
		stopListening,
		clearTranscript,
		isSupported,
	};
}
