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
	sendAcademic: RefObject<(question: string) => void | Promise<void>>;
	setInputMode: (mode: "behavior" | "ask" | "di") => void;
	/** goLive from useSessionLifecycle — starts a session for selectedClassIdRef.current */
	goLive: () => Promise<void>;
	/** endSession from useSessionLifecycle — ends the given session */
	endSession: (sessionId: string) => Promise<void>;
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
	goLive,
	endSession,
}: UseCoachVoiceEventsOptions) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: sendAcademic is a stable ref — .current must never be a dep
	useEffect(() => {
		async function handleVoiceStartSession() {
			const classId = selectedClassIdRef.current;
			if (!classId) {
				toast.error("No class selected — open Coach and pick a class first");
				return;
			}
			if (activeSessionIdRef.current) return;
			try {
				// goLive handles the API call, sessionStorage write, and setActiveSessionId/setActiveJoinCode
				await goLive();
				// Auto-start lecture mic — mirrors the manual Go Live button behavior
				stopCommandsNow();
				setIsOrbRecording(false);
				setTimeout(startListening, 350);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to start session");
			}
		}

		async function handleVoiceEndSession() {
			const sessionId = activeSessionIdRef.current;
			if (!sessionId) return;
			try {
				// endSession handles the API call, sessionStorage clear, and setActiveSessionId/setActiveJoinCode
				await endSession(sessionId);
				// Stop lecture mic and reset auto-command state — mirrors the manual Stop Session button
				stopListening();
				clearOrbRestartTimer();
				disableAutoCommand();
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
			sendAcademic.current?.(question);
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
		endSession,
		goLive,
		isListening,
		selectedClassIdRef,
		setInputMode,
		setIsOrbRecording,
		startListening,
		stopCommandsNow,
		stopListening,
	]);
}
