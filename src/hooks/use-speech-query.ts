"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UseSpeechQueryReturn = {
	query: string;
	isRecording: boolean;
	startRecording: (onComplete?: (text: string) => void) => void;
	clearQuery: () => void;
	isSupported: boolean;
};

export function useSpeechQuery(): UseSpeechQueryReturn {
	const [query, setQuery] = useState("");
	const [isRecording, setIsRecording] = useState(false);
	const [isSupported, setIsSupported] = useState(false);
	const recognitionRef = useRef<SpeechRecognition | null>(null);

	useEffect(() => {
		const supported =
			typeof window !== "undefined" &&
			("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
		setIsSupported(supported);
	}, []);

	const startRecording = useCallback((onComplete?: (text: string) => void) => {
		if (typeof window === "undefined") return;

		const SpeechRecognitionAPI =
			(window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition })
				.webkitSpeechRecognition ?? window.SpeechRecognition;

		if (!SpeechRecognitionAPI) return;

		// Stop any existing recording
		if (recognitionRef.current) {
			recognitionRef.current.stop();
		}

		const recognition = new SpeechRecognitionAPI();
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = "en-US";

		let finalResult = "";

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			let interim = "";
			let final = "";
			for (let i = 0; i < event.results.length; i++) {
				const result = event.results[i];
				if (result.isFinal) {
					final += result[0].transcript;
				} else {
					interim += result[0].transcript;
				}
			}
			finalResult = final || interim;
			setQuery(finalResult);
		};

		recognition.onerror = () => {
			setIsRecording(false);
			recognitionRef.current = null;
		};

		recognition.onend = () => {
			setIsRecording(false);
			recognitionRef.current = null;
			if (finalResult && onComplete) {
				onComplete(finalResult);
			}
		};

		recognitionRef.current = recognition;
		recognition.start();
		setIsRecording(true);
	}, []);

	const clearQuery = useCallback(() => {
		setQuery("");
		if (recognitionRef.current) {
			recognitionRef.current.stop();
			recognitionRef.current = null;
		}
		setIsRecording(false);
	}, []);

	useEffect(() => {
		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.stop();
				recognitionRef.current = null;
			}
		};
	}, []);

	return { query, isRecording, startRecording, clearQuery, isSupported };
}
