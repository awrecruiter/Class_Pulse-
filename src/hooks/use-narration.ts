"use client";
import { useEffect, useRef, useState } from "react";
import type { TtsVoiceId } from "@/components/coach/tts-button";

export function useNarration(defaultVoice: TtsVoiceId = "en-US-AvaNeural") {
	const [speaking, setSpeaking] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		return () => {
			audioRef.current?.pause();
			audioRef.current = null;
		};
	}, []);

	async function speak(text: string, voice: TtsVoiceId = defaultVoice) {
		stop();
		setSpeaking(true);
		try {
			const res = await fetch("/api/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text, voice }),
			});
			if (!res.ok) throw new Error("TTS failed");
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);
			audioRef.current = audio;
			audio.onended = () => {
				setSpeaking(false);
				URL.revokeObjectURL(url);
				audioRef.current = null;
			};
			audio.onerror = () => {
				setSpeaking(false);
				URL.revokeObjectURL(url);
				audioRef.current = null;
			};
			await audio.play();
		} catch {
			setSpeaking(false);
		}
	}

	function stop() {
		audioRef.current?.pause();
		audioRef.current = null;
		setSpeaking(false);
	}

	return { speaking, speak, stop };
}
