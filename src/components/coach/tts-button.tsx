"use client";

import { StopCircleIcon, Volume2Icon } from "lucide-react";
import { useEffect, useState } from "react";

type TtsButtonProps = {
	text: string;
	label?: string;
};

export function TtsButton({ text, label }: TtsButtonProps) {
	const [speaking, setSpeaking] = useState(false);
	const [supported, setSupported] = useState(false);

	useEffect(() => {
		setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
		return () => {
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		};
	}, []);

	if (!supported) return null;

	function handleToggle() {
		if (speaking) {
			window.speechSynthesis.cancel();
			setSpeaking(false);
		} else {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.onstart = () => setSpeaking(true);
			utterance.onend = () => setSpeaking(false);
			utterance.onerror = () => setSpeaking(false);
			window.speechSynthesis.speak(utterance);
		}
	}

	return (
		<div className="flex flex-col items-center gap-2 py-3">
			<button
				type="button"
				onClick={handleToggle}
				className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all ${
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
					<StopCircleIcon className="h-7 w-7 text-primary-foreground" />
				) : (
					<Volume2Icon className="h-7 w-7 text-primary" />
				)}
			</button>
			<p className="text-xs text-muted-foreground">
				{speaking ? "Tap to stop" : (label ?? "Tap to hear")}
			</p>
		</div>
	);
}
