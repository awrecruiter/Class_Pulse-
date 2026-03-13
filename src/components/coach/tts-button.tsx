"use client";

import { StopCircleIcon, Volume2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Microsoft neural voices available via edge-tts
export const TTS_VOICES = [
	{ id: "en-US-AvaNeural", label: "Ava (warm)" },
	{ id: "en-US-EmmaNeural", label: "Emma (cheerful)" },
	{ id: "en-US-JennyNeural", label: "Jenny (friendly)" },
	{ id: "en-US-AndrewNeural", label: "Andrew (warm)" },
	{ id: "en-US-BrianNeural", label: "Brian (casual)" },
	{ id: "en-US-GuyNeural", label: "Guy (lively)" },
	{ id: "en-US-AriaNeural", label: "Aria (confident)" },
	{ id: "en-US-MichelleNeural", label: "Michelle (pleasant)" },
] as const;

export type TtsVoiceId = (typeof TTS_VOICES)[number]["id"];

type TtsButtonProps = {
	text: string;
	label?: string;
	autoPlay?: boolean;
	size?: "sm" | "lg";
	voice?: TtsVoiceId;
};

export function TtsButton({
	text,
	label,
	autoPlay = false,
	size = "sm",
	voice = "en-US-AvaNeural",
}: TtsButtonProps) {
	const [speaking, setSpeaking] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, []);

	async function speak() {
		if (speaking) return;
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
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}
		setSpeaking(false);
	}

	// Auto-play on mount when requested
	// biome-ignore lint/correctness/useExhaustiveDependencies: speak is intentionally excluded; it changes every render but only mount matters
	useEffect(() => {
		if (!autoPlay) return;
		const t = setTimeout(() => speak(), 400);
		return () => clearTimeout(t);
	}, [autoPlay]);

	const btnSize = size === "lg" ? "h-20 w-20" : "h-16 w-16";
	const iconSize = size === "lg" ? "h-9 w-9" : "h-7 w-7";

	return (
		<div className="flex flex-col items-center gap-2 py-3">
			<button
				type="button"
				onClick={speaking ? stop : speak}
				className={`relative flex ${btnSize} items-center justify-center rounded-full transition-all ${
					speaking ? "bg-primary shadow-lg shadow-primary/40" : "bg-primary/10 hover:bg-primary/20"
				}`}
				aria-label={speaking ? "Stop" : "Hear this"}
			>
				{speaking && (
					<>
						<span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
						<span className="absolute inset-[-8px] rounded-full border border-primary/20 animate-pulse" />
					</>
				)}
				{speaking ? (
					<StopCircleIcon className={`${iconSize} text-primary-foreground`} />
				) : (
					<Volume2Icon className={`${iconSize} text-primary`} />
				)}
			</button>
			<p className="text-xs text-muted-foreground">
				{speaking ? "Tap to stop" : (label ?? "Tap to hear")}
			</p>
		</div>
	);
}
