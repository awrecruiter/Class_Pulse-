const store = new Map<string, { level: number; ts: number }>();

export function setNoiseLevel(sessionId: string, level: number) {
	store.set(sessionId, { level, ts: Date.now() });
}

export function getNoiseLevel(sessionId: string): number {
	const entry = store.get(sessionId);
	if (!entry || Date.now() - entry.ts > 10_000) return 0;
	return entry.level;
}

export function clearNoiseLevel(sessionId: string) {
	store.delete(sessionId);
}
