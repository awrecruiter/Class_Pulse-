interface RateLimitEntry {
	count: number;
	resetTime: number;
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
	const store = new Map<string, RateLimitEntry>();

	return {
		check(key: string): { success: boolean; remaining: number } {
			const now = Date.now();
			const entry = store.get(key);

			if (!entry || now > entry.resetTime) {
				store.set(key, { count: 1, resetTime: now + windowMs });
				return { success: true, remaining: maxRequests - 1 };
			}

			if (entry.count >= maxRequests) {
				return { success: false, remaining: 0 };
			}

			entry.count++;
			return { success: true, remaining: maxRequests - entry.count };
		},

		reset() {
			store.clear();
		},
	};
}

export const coachRateLimiter = createRateLimiter(10, 60_000); // 10 req/min (AI coach)
export const behaviorCoachLimiter = createRateLimiter(20, 60_000); // 20 req/min (behavior coach — chatty all day)
export const sessionRateLimiter = createRateLimiter(30, 60_000); // 30 req/min (class/session management)
export const joinRateLimiter = createRateLimiter(20, 60_000); // 20 req/min (student join)
export const smsRateLimiter = createRateLimiter(10, 60_000); // 10 req/min (AWS SNS SMS sends)
export const ambientScanLimiter = createRateLimiter(20, 60_000); // 20 req/min (noise heartbeat)
export const correctionRateLimiter = createRateLimiter(5, 60_000); // 5 req/min (student I'm Lost)
export const animateLimiter = createRateLimiter(3, 60_000); // 3 req/min (Manim render — expensive)
export const diRateLimiter = createRateLimiter(30, 60_000); // 30 req/min (DI session CRUD)
