import type { NoiseFrame } from "@/types";

/** In-memory map: sessionId → latest NoiseFrame (expires after 30 s of silence). */
const store = new Map<string, NoiseFrame>();

/**
 * Store the teacher mic amplitude for a session.
 * Level is clamped to [0, 100] so consumers never see out-of-range values
 * even if a caller bypasses the Zod validation in the route.
 */
export function setNoiseLevel(sessionId: string, level: number) {
	const clamped = Math.max(0, Math.min(100, Math.round(level)));
	store.set(sessionId, { level: clamped, timestamp: Date.now() });
}

export function getNoiseLevel(sessionId: string): number {
	const entry = store.get(sessionId);
	if (!entry || Date.now() - entry.timestamp > 30_000) return 0;
	return entry.level;
}

export function clearNoiseLevel(sessionId: string) {
	store.delete(sessionId);
}
