import { signStudentToken, verifyStudentToken } from "@/lib/auth/student";

describe("student auth tokens", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv, NEON_AUTH_COOKIE_SECRET: "test-secret" };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("signs and verifies student tokens when the secret is configured", () => {
		const token = signStudentToken({ sessionId: "session-1", rosterId: "roster-1" });
		expect(verifyStudentToken(token)).toEqual({
			sessionId: "session-1",
			rosterId: "roster-1",
		});
	});

	it("uses the dev fallback secret when the cookie secret is missing in non-production", () => {
		delete process.env.NEON_AUTH_COOKIE_SECRET;
		// In non-production (test/development), missing secret uses the local-only fallback.
		// Tokens should still sign and verify consistently with the fallback.
		const token = signStudentToken({ sessionId: "session-1", rosterId: "roster-1" });
		expect(verifyStudentToken(token)).toEqual({
			sessionId: "session-1",
			rosterId: "roster-1",
		});
		expect(verifyStudentToken("bad.token")).toBeNull();
	});

	it("throws in production when the cookie secret is missing", () => {
		const savedEnv = process.env;
		try {
			// Replace the entire env object so NODE_ENV can be overridden
			process.env = { ...savedEnv, NODE_ENV: "production" };
			delete process.env.NEON_AUTH_COOKIE_SECRET;
			expect(() => signStudentToken({ sessionId: "session-1", rosterId: "roster-1" })).toThrow(
				"NEON_AUTH_COOKIE_SECRET must be set in production",
			);
		} finally {
			process.env = savedEnv;
		}
	});
});
