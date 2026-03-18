"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type FeedStatus = "connecting" | "connected" | "reconnecting" | "failed";
type RamAwardEvent = { amount: number; newBalance: number; reason: string };

const MAX_RETRIES = 8;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

export function useStudentFeed(sessionId: string, isActive: boolean) {
	const [status, setStatus] = useState<FeedStatus>("connecting");
	const [pushedSpec, setPushedSpec] = useState<unknown>(null);
	const [pushedStandardCode, setPushedStandardCode] = useState<string | undefined>(undefined);
	const [showManip, setShowManip] = useState(false);
	const [ramAward, setRamAward] = useState<RamAwardEvent | null>(null);

	const esRef = useRef<EventSource | null>(null);
	const retryCountRef = useRef(0);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mountedRef = useRef(true);

	const connect = useCallback(() => {
		if (!mountedRef.current || !isActive) return;
		const es = new EventSource(`/api/sessions/${sessionId}/student-feed`);
		esRef.current = es;

		es.onopen = () => {
			if (!mountedRef.current) return;
			retryCountRef.current = 0;
			setStatus("connected");
		};

		// Named events (new server format)
		es.addEventListener("push", (e: MessageEvent) => {
			if (!mountedRef.current) return;
			try {
				const data = JSON.parse(e.data);
				if (data.spec) {
					setPushedSpec(data.spec);
					setPushedStandardCode(data.standardCode ?? undefined);
					setShowManip(true);
				}
			} catch {
				/* ignore */
			}
		});

		es.addEventListener("ram_award", (e: MessageEvent) => {
			if (!mountedRef.current) return;
			try {
				setRamAward(JSON.parse(e.data) as RamAwardEvent);
			} catch {
				/* ignore */
			}
		});

		// Fallback for unnamed messages (backward compat)
		es.onmessage = (e) => {
			if (!mountedRef.current) return;
			try {
				const data = JSON.parse(e.data);
				if (data.spec) {
					setPushedSpec(data.spec);
					setPushedStandardCode(data.standardCode ?? undefined);
					setShowManip(true);
				}
			} catch {
				/* ignore */
			}
		};

		es.onerror = () => {
			if (!mountedRef.current) return;
			es.close();
			esRef.current = null;
			const attempt = retryCountRef.current;
			if (attempt >= MAX_RETRIES) {
				setStatus("failed");
				return;
			}
			setStatus("reconnecting");
			retryCountRef.current += 1;
			const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
			retryTimerRef.current = setTimeout(() => {
				if (mountedRef.current) connect();
			}, delay);
		};
	}, [sessionId, isActive]);

	useEffect(() => {
		mountedRef.current = true;
		if (isActive) connect();
		return () => {
			mountedRef.current = false;
			if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
			esRef.current?.close();
		};
	}, [isActive, connect]);

	return {
		status,
		pushedSpec,
		pushedStandardCode,
		showManip,
		dismissManip: () => setShowManip(false),
		ramAward,
		clearRamAward: () => setRamAward(null),
	};
}
