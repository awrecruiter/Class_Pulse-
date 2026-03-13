"use client";

/**
 * useMicManager — single SpeechRecognition semaphore for the entire app.
 *
 * Problem solved: multiple hooks/panels each creating their own SpeechRecognition
 * instance causes the browser to grant the mic to only one, silently failing all
 * others and causing constant NetworkError / restart collisions.
 *
 * Solution: one global recognition instance at a time. Consumers register with
 * a priority; the highest-priority enabled consumer always wins. When ownership
 * changes, the current instance is cleanly stopped before the new one starts.
 *
 * Priorities (highest wins):
 *   lecture    4  — continuous lesson transcription
 *   dictation  3  — teacher composing a message or behavior note by voice
 *   orb        2  — single-utterance coach query / command capture
 *   globalVoice 1 — continuous background command listening
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MicConsumer = "lecture" | "dictation" | "orb" | "globalVoice";

export interface MicConfig {
	continuous: boolean;
	interimResults: boolean;
	onResult: (transcript: string, isFinal: boolean) => void;
	onError?: (error: string) => void;
	/** Called when recognition ends naturally (not because of a priority switch). */
	onNaturalEnd?: () => void;
}

// ─── Priority ─────────────────────────────────────────────────────────────────

const PRIORITY: Record<MicConsumer, number> = {
	lecture: 4,
	dictation: 3,
	orb: 2,
	globalVoice: 1,
};

// ─── Module-level singleton state ─────────────────────────────────────────────

interface Slot {
	config: MicConfig;
	wantsActive: boolean;
	/** React useSyncExternalStore subscriber callbacks */
	listeners: Set<() => void>;
}

const slots = new Map<MicConsumer, Slot>();
let recognition: SpeechRecognition | null = null;
let activeOwner: MicConsumer | null = null;
/** True while we're waiting for onend to fire before switching to a new owner. */
let switching = false;

// ─── Manager helpers ──────────────────────────────────────────────────────────

function getSpeechAPI(): typeof SpeechRecognition | null {
	if (typeof window === "undefined") return null;
	return (
		(
			window as typeof window & {
				webkitSpeechRecognition?: typeof SpeechRecognition;
			}
		).webkitSpeechRecognition ??
		window.SpeechRecognition ??
		null
	);
}

function getWinner(): MicConsumer | null {
	let winner: MicConsumer | null = null;
	let best = -1;
	for (const [id, slot] of slots) {
		if (slot.wantsActive && PRIORITY[id] > best) {
			winner = id;
			best = PRIORITY[id];
		}
	}
	return winner;
}

function notifyAll() {
	for (const slot of slots.values()) {
		for (const fn of slot.listeners) fn();
	}
}

function startFor(owner: MicConsumer) {
	const SpeechAPI = getSpeechAPI();
	if (!SpeechAPI) return;
	const slot = slots.get(owner);
	if (!slot) return;

	const rec = new SpeechAPI();
	rec.continuous = slot.config.continuous;
	rec.interimResults = slot.config.interimResults;
	rec.lang = "en-US";

	rec.onresult = (e: SpeechRecognitionEvent) => {
		// Always read from slot.config (updated every render via configRef)
		for (let i = e.resultIndex; i < e.results.length; i++) {
			const result = e.results[i];
			slot.config.onResult(result[0].transcript, result.isFinal);
		}
	};

	rec.onerror = (e: SpeechRecognitionErrorEvent) => {
		slot.config.onError?.(e.error);
		if (e.error === "not-allowed" || e.error === "service-not-allowed") {
			slot.wantsActive = false;
			notifyAll();
		}
	};

	rec.onend = () => {
		if (recognition !== rec) return; // stale — a switch already happened
		recognition = null;
		activeOwner = null;
		switching = false;
		notifyAll();

		const currentSlot = slots.get(owner);
		const winner = getWinner();

		if (winner === owner && currentSlot?.wantsActive && currentSlot.config.continuous) {
			// Continuous consumer still wants the mic — auto-restart with a short backoff
			setTimeout(() => {
				if (slots.get(owner)?.wantsActive && getWinner() === owner) {
					startFor(owner);
				} else {
					applyState();
				}
			}, 300);
		} else {
			// Non-continuous: auto-release after a single utterance
			if (currentSlot && !currentSlot.config.continuous) {
				currentSlot.wantsActive = false;
			}
			currentSlot?.config.onNaturalEnd?.();
			applyState();
		}
	};

	recognition = rec;
	activeOwner = owner;
	switching = false;
	notifyAll();

	try {
		rec.start();
	} catch {
		recognition = null;
		activeOwner = null;
		notifyAll();
	}
}

/**
 * Recompute who should own the mic and switch if necessary.
 * Called whenever any slot's wantsActive changes.
 */
function applyState() {
	if (switching) return; // already mid-transition — onend will call applyState again
	const winner = getWinner();

	if (winner === activeOwner) return; // already correct

	if (recognition) {
		// Stop the current owner; start winner in onend callback
		switching = true;
		recognition.onend = () => {
			recognition = null;
			activeOwner = null;
			switching = false;
			notifyAll();
			if (winner && slots.get(winner)?.wantsActive) {
				startFor(winner);
			}
		};
		recognition.stop();
	} else if (winner) {
		startFor(winner);
	}
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * Register a consumer with the mic manager.
 *
 * Usage:
 *   const { isActive, start, stop } = useMicSlot("orb", config);
 *   // isActive === true when this consumer currently owns the mic
 *
 * Config callbacks are kept as live refs — updating them between renders is safe.
 */
export function useMicSlot(consumer: MicConsumer, config: MicConfig) {
	// Ensure slot exists
	if (!slots.has(consumer)) {
		slots.set(consumer, {
			config,
			wantsActive: false,
			listeners: new Set(),
		});
	}

	// Keep config current every render (callbacks are live)
	const slot = slots.get(consumer);
	if (slot) slot.config = config;

	// useSyncExternalStore subscription
	const subscribe = useCallback(
		(onChange: () => void) => {
			const s = slots.get(consumer);
			s?.listeners.add(onChange);
			return () => {
				slots.get(consumer)?.listeners.delete(onChange);
			};
		},
		[consumer],
	);

	const getSnapshot = useCallback(() => activeOwner === consumer, [consumer]);

	const isActive = useSyncExternalStore(subscribe, getSnapshot, () => false);

	const start = useCallback(() => {
		const s = slots.get(consumer);
		if (!s) return;
		if (s.wantsActive) return; // already requested
		s.wantsActive = true;
		applyState();
	}, [consumer]);

	const stop = useCallback(() => {
		const s = slots.get(consumer);
		if (!s) return;
		if (!s.wantsActive) return; // already released
		s.wantsActive = false;
		applyState();
	}, [consumer]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			const s = slots.get(consumer);
			if (s) {
				s.wantsActive = false;
				s.listeners.clear();
				slots.delete(consumer);
				applyState();
			}
		};
	}, [consumer]);

	return { isActive, start, stop };
}
