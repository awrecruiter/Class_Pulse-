import { analyzeHookInput, isProtectedPath } from "../../../.claude/hooks/protect-env.mjs";

describe("protect-env Claude hook", () => {
	it("blocks protected env files but allows .env.example", () => {
		expect(isProtectedPath(".env.local")).toBe(true);
		expect(isProtectedPath("/tmp/project/.env.production")).toBe(true);
		expect(isProtectedPath(".claude/settings.local.json")).toBe(true);
		expect(isProtectedPath(".env.example")).toBe(false);
	});

	it("blocks read access to env files", () => {
		const result = analyzeHookInput({
			tool_name: "Read",
			tool_input: {
				file_path: "/Applications/ApplicationsReady/UnGhettoMyLife/.env.local",
			},
		});

		expect(result).toEqual({
			allow: false,
			reason:
				"Access to protected env-related path is blocked: /Applications/ApplicationsReady/UnGhettoMyLife/.env.local",
		});
	});

	it("blocks shell commands that reference env files", () => {
		const result = analyzeHookInput({
			tool_name: "Bash",
			tool_input: {
				command: "cat .env.local",
			},
		});

		expect(result).toEqual({
			allow: false,
			reason: "Bash command references a protected env file or local Claude settings.",
		});
	});

	it("blocks shell commands that dump the process environment", () => {
		const result = analyzeHookInput({
			tool_name: "Bash",
			tool_input: {
				command: "node -e 'console.log(process.env)'",
			},
		});

		expect(result).toEqual({
			allow: false,
			reason: "Bash command appears to dump environment variables.",
		});
	});

	it("allows normal project commands", () => {
		const result = analyzeHookInput({
			tool_name: "Bash",
			tool_input: {
				command: "npm run test:run",
			},
		});

		expect(result).toEqual({ allow: true });
	});
});
