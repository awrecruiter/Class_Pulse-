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

	it("fails closed when the cookie secret is missing", () => {
		delete process.env.NEON_AUTH_COOKIE_SECRET;
		expect(() => signStudentToken({ sessionId: "session-1", rosterId: "roster-1" })).toThrow(
			"Missing required environment variable: NEON_AUTH_COOKIE_SECRET",
		);
		expect(verifyStudentToken("bad.token")).toBeNull();
	});
});
