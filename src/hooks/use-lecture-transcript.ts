"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function useLectureTranscript(): UseLectureTranscriptReturn {
	const [transcript, setTranscript] = useState("");
	const [isListening, setIsListening] = useState(false);
	const [isSupported, setIsSupported] = useState(false);
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const accumulatedRef = useRef<string>("");

	useEffect(() => {
		const supported =
			typeof window !== "undefined" &&
			("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
		setIsSupported(supported);
	}, []);

	const startListening = useCallback(() => {
		if (typeof window === "undefined") return;

		const SpeechRecognitionAPI =
			(window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition })
				.webkitSpeechRecognition ?? window.SpeechRecognition;

		if (!SpeechRecognitionAPI) return;

		const recognition = new SpeechRecognitionAPI();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = "en-US";

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			let interimText = "";
			let finalText = "";

			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				if (result.isFinal) {
					finalText += `${result[0].transcript} `;
				} else {
					interimText += result[0].transcript;
				}
			}

			if (finalText) {
				accumulatedRef.current = trimToWordLimit(accumulatedRef.current + finalText, MAX_WORDS);
			}

			const display = trimToWordLimit(
				accumulatedRef.current + (interimText ? `[${interimText}]` : ""),
				MAX_WORDS,
			);
			setTranscript(display);
		};

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			if (event.error === "not-allowed" || event.error === "service-not-allowed") {
				setIsListening(false);
			}
		};

		recognition.onend = () => {
			// Auto-restart if we're still in listening mode (browser stops after silence)
			if (recognitionRef.current === recognition) {
				try {
					recognition.start();
				} catch {
					setIsListening(false);
				}
			}
		};

		recognitionRef.current = recognition;
		recognition.start();
		setIsListening(true);
	}, []);

	const stopListening = useCallback(() => {
		if (recognitionRef.current) {
			recognitionRef.current.onend = null;
			recognitionRef.current.stop();
			recognitionRef.current = null;
		}
		setIsListening(false);
	}, []);

	const clearTranscript = useCallback(() => {
		accumulatedRef.current = "";
		setTranscript("");
	}, []);

	// Clean up on unmount
	useEffect(() => {
		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.onend = null;
				recognitionRef.current.stop();
				recognitionRef.current = null;
			}
		};
	}, []);

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
