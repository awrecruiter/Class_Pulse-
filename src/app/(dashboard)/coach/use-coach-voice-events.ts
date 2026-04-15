"use client";

import type { RefObject } from "react";
import { useEffect } from "react";
import { toast } from "sonner";

interface UseCoachVoiceEventsOptions {
	selectedClassIdRef: RefObject<string>;
	activeSessionIdRef: RefObject<string | undefined>;
	isListening: boolean;
	startListening: () => void;
	stopListening: () => void;
	stopCommandsNow: () => void;
	setIsOrbRecording: (value: boolean) => void;
	clearOrbRestartTimer: () => void;
	disableAutoCommand: () => void;
	sendAcademic: (question: string) => void | Promise<void>;
	setInputMode: (mode: "behavior" | "ask" | "di") => void;
	setActiveSessionId: (sessionId: string | undefined) => void;
	setActiveJoinCode: (joinCode: string | undefined) => void;
}

export function useCoachVoiceEvents({
	selectedClassIdRef,
	activeSessionIdRef,
	isListening,
	startListening,
	stopListening,
	stopCommandsNow,
	setIsOrbRecording,
	clearOrbRestartTimer,
	disableAutoCommand,
	sendAcademic,
	setInputMode,
	setActiveSessionId,
	setActiveJoinCode,
}: UseCoachVoiceEventsOptions) {
	useEffect(() => {
		async function handleVoiceStartSession() {
			const classId = selectedClassIdRef.current;
			if (!classId) {
				toast.error("No class selected — open Coach and pick a class first");
				return;
			}
			if (activeSessionIdRef.current) return;
			try {
				const res = await fetch("/api/sessions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ classId }),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok)
					throw new Error((data as { error?: string }).error ?? "Failed to start session");
				const s = (data as { session?: { id?: string; joinCode?: string } }).session;
				setActiveSessionId(s?.id);
				setActiveJoinCode(s?.joinCode);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to start session");
			}
		}

		async function handleVoiceEndSession() {
			const sessionId = activeSessionIdRef.current;
			if (!sessionId) return;
			try {
				const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "PUT" });
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to end session");
				setActiveSessionId(undefined);
				setActiveJoinCode(undefined);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to end session");
			}
		}

		function handleVoiceStartLecture() {
			if (!isListening) {
				disableAutoCommand();
				clearOrbRestartTimer();
				stopCommandsNow();
				setIsOrbRecording(false);
				setTimeout(startListening, 350);
			}
		}

		function handleVoiceStopLecture() {
			if (isListening) stopListening();
		}

		function handleVoiceAskCoach(e: Event) {
			const question = (e as CustomEvent<{ question: string }>).detail.question;
			sendAcademic(question);
			setInputMode("ask");
		}

		window.addEventListener("voice-start_session", handleVoiceStartSession);
		window.addEventListener("voice-end_session", handleVoiceEndSession);
		window.addEventListener("voice-start_lecture", handleVoiceStartLecture);
		window.addEventListener("voice-stop_lecture", handleVoiceStopLecture);
		window.addEventListener("voice-ask-coach", handleVoiceAskCoach);

		return () => {
			window.removeEventListener("voice-start_session", handleVoiceStartSession);
			window.removeEventListener("voice-end_session", handleVoiceEndSession);
			window.removeEventListener("voice-start_lecture", handleVoiceStartLecture);
			window.removeEventListener("voice-stop_lecture", handleVoiceStopLecture);
			window.removeEventListener("voice-ask-coach", handleVoiceAskCoach);
		};
	}, [
		activeSessionIdRef,
		clearOrbRestartTimer,
		disableAutoCommand,
		isListening,
		selectedClassIdRef,
		sendAcademic,
		setActiveJoinCode,
		setActiveSessionId,
		setInputMode,
		setIsOrbRecording,
		startListening,
		stopCommandsNow,
		stopListening,
	]);
}
