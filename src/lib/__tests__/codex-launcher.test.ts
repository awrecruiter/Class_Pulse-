import {
	buildCodexArgs,
	buildSanitizedEnv,
	isSafeExtraEnvName,
	readAllowlistFile,
} from "../../../.codex/launch-safe-codex.mjs";

describe("codex safe launcher", () => {
	it("filters secret-looking env names from extra allowlists", () => {
		expect(isSafeExtraEnvName("NEXT_PUBLIC_APP_ENV")).toBe(true);
		expect(isSafeExtraEnvName("DATABASE_URL")).toBe(false);
		expect(isSafeExtraEnvName("OPENAI_API_KEY")).toBe(false);
	});

	it("keeps builtin terminal env and drops secrets by default", () => {
		const sanitized = buildSanitizedEnv({
			PATH: "/usr/bin",
			HOME: "/Users/clover",
			DATABASE_URL: "postgres://secret",
			OPENAI_API_KEY: "secret",
			NEXT_PUBLIC_APP_ENV: "dev",
		});

		expect(sanitized).toEqual({
			PATH: "/usr/bin",
			HOME: "/Users/clover",
		});
	});

	it("allows extra non-secret vars when allowlisted", () => {
		const sanitized = buildSanitizedEnv(
			{
				PATH: "/usr/bin",
				HOME: "/Users/clover",
				NEXT_PUBLIC_APP_ENV: "dev",
				DATABASE_URL: "postgres://secret",
			},
			["NEXT_PUBLIC_APP_ENV", "DATABASE_URL"],
		);

		expect(sanitized).toEqual({
			PATH: "/usr/bin",
			HOME: "/Users/clover",
			NEXT_PUBLIC_APP_ENV: "dev",
		});
	});

	it("builds codex args with a forced repo root", () => {
		expect(buildCodexArgs(["exec", "fix it"], "/repo")).toEqual([
			"--cd",
			"/repo",
			"exec",
			"fix it",
		]);
	});

	it("returns an empty allowlist when no file exists", () => {
		expect(readAllowlistFile("/definitely/missing/file")).toEqual([]);
	});
});
