import { getRequiredEnv, readBooleanEnv } from "@/lib/env";

describe("env helpers", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("returns a required env var when present", () => {
		process.env.DATABASE_URL = "postgresql://example";
		expect(getRequiredEnv("DATABASE_URL")).toBe("postgresql://example");
	});

	it("throws when a required env var is missing", () => {
		delete process.env.NEON_AUTH_COOKIE_SECRET;
		expect(() => getRequiredEnv("NEON_AUTH_COOKIE_SECRET")).toThrow(
			"Missing required environment variable: NEON_AUTH_COOKIE_SECRET",
		);
	});

	it("reads boolean env vars explicitly", () => {
		process.env.ALLOW_DEV_AUTH_BYPASS = "true";
		expect(readBooleanEnv("ALLOW_DEV_AUTH_BYPASS")).toBe(true);
		process.env.ALLOW_DEV_AUTH_BYPASS = "false";
		expect(readBooleanEnv("ALLOW_DEV_AUTH_BYPASS")).toBe(false);
	});
});
