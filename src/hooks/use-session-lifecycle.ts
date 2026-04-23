"use client";

/**
 * useSessionLifecycle
 *
 * Owns the go-live / end-session fetch logic and exposes named action
 * functions so callers never have to duplicate session API calls.
 *
 * State ownership note: activeSessionId lives in useCoachClassroom (where
 * zombie cleanup and class-fetch effects also live). This hook receives the
 * setters from that hook and owns only the action logic + sessionStorage
 * day-gating check on mount.
 *
 * Day-gating: sessionStorage stores the ISO calendar date alongside the
 * session ID. On mount this hook clears any stored session from a previous
 * calendar day so yesterday's session is never mistakenly restored.
 */

import { useEffect } from "react";

const SESSION_KEY = "activeSessionId";
const SESSION_DATE_KEY = "activeSessionDate";

/** Call once on mount to evict any sessionStorage entry from a previous day. */
export function clearStaleSessionStorage(): void {
	try {
		const storedDate = sessionStorage.getItem(SESSION_DATE_KEY);
		const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
		if (storedDate && storedDate !== today) {
			sessionStorage.removeItem(SESSION_KEY);
			sessionStorage.removeItem(SESSION_DATE_KEY);
		}
	} catch {
		// sessionStorage unavailable (SSR guard)
	}
}

/** Write a session to sessionStorage, stamped with today's date. */
export function writeSessionToStorage(sessionId: string): void {
	try {
		sessionStorage.setItem(SESSION_KEY, sessionId);
		sessionStorage.setItem(SESSION_DATE_KEY, new Date().toISOString().slice(0, 10));
	} catch {
		// ignore
	}
}

/** Remove the active session from sessionStorage. */
export function clearSessionFromStorage(): void {
	try {
		sessionStorage.removeItem(SESSION_KEY);
		sessionStorage.removeItem(SESSION_DATE_KEY);
	} catch {
		// ignore
	}
}

interface SessionLifecycleOptions {
	/** The currently selected class ID. Required to start a session. */
	classId: string | null;
	/** Optional standard code to attach when starting a session. */
	sessionStandardCode?: string;
	/** Setter from useCoachClassroom. */
	setActiveSessionId: (id: string | undefined) => void;
	/** Setter from useCoachClassroom. */
	setActiveJoinCode: (code: string | undefined) => void;
	/** Called after a session is successfully ended so the page can reset mic/signal state. */
	onSessionEnded?: () => void;
	/** Called after a session is successfully started so the page can auto-start the lecture mic. */
	onSessionStarted?: () => void;
}

export function useSessionLifecycle({
	classId,
	sessionStandardCode,
	setActiveSessionId,
	setActiveJoinCode,
	onSessionEnded,
	onSessionStarted,
}: SessionLifecycleOptions) {
	// Day-gate: clear any sessionStorage entry from a previous calendar day on mount.
	useEffect(() => {
		clearStaleSessionStorage();
	}, []);

	async function goLive(): Promise<void> {
		if (!classId) return;
		try {
			const res = await fetch("/api/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					classId,
					...(sessionStandardCode ? { standardCode: sessionStandardCode } : {}),
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(
					(data as { error?: string }).error ?? `Failed to start session (${res.status})`,
				);
			}
			const s = (data as { session?: { id?: string; joinCode?: string } }).session;
			setActiveSessionId(s?.id);
			setActiveJoinCode(s?.joinCode);
			if (s?.id) {
				writeSessionToStorage(s.id);
			}
			onSessionStarted?.();
		} catch {
			// Callers handle errors via their own toast/UI — swallow here to keep
			// the function signature clean. Errors from API surface as no-op.
		}
	}

	async function endSession(sessionId: string): Promise<void> {
		try {
			const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "PUT" });
			if (res.ok) {
				setActiveSessionId(undefined);
				setActiveJoinCode(undefined);
				clearSessionFromStorage();
				onSessionEnded?.();
			}
		} catch {
			// ignore — session will be garbage-collected on next class load
		}
	}

	return { goLive, endSession };
}
