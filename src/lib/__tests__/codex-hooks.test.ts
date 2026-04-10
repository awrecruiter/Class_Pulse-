import { buildAuditRecord } from "../../../.codex/hooks/audit-config-change.mjs";
import { buildToolEventRecord } from "../../../.codex/hooks/log-tool-event.mjs";
import { analyzeInvocation, isProtectedPath } from "../../../.codex/hooks/protect-env.mjs";
import {
	buildDirenvExports,
	shouldReloadDirenv,
} from "../../../.codex/hooks/reload-env-on-cwd.mjs";

describe("codex hooks", () => {
	it("blocks protected env paths but allows .env.example", () => {
		expect(isProtectedPath(".env.local")).toBe(true);
		expect(isProtectedPath("/tmp/project/.env.production")).toBe(true);
		expect(isProtectedPath(".codex/config.local.toml")).toBe(true);
		expect(isProtectedPath(".env.example")).toBe(false);
	});

	it("blocks shell-style commands that reference secrets or env dumps", () => {
		expect(analyzeInvocation({ cmd: "cat .env.local" })).toEqual({
			allow: false,
			reason: "Command references a protected env file or local Codex config.",
		});
		expect(analyzeInvocation({ command: "node -e 'console.log(process.env)'" })).toEqual({
			allow: false,
			reason: "Command appears to dump environment variables.",
		});
	});

	it("allows normal invocations", () => {
		expect(analyzeInvocation({ command: "npm run test:run" })).toEqual({ allow: true });
	});

	it("builds audit records", () => {
		const record = buildAuditRecord({
			source: "codex_config",
			file_path: "/repo/.codex/config.toml",
		});

		expect(record.source).toBe("codex_config");
		expect(record.file_path).toBe("/repo/.codex/config.toml");
		expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("builds tool event records", () => {
		const record = buildToolEventRecord(
			{
				tool_name: "Read",
				tool_input: {
					file_path: "/Applications/ApplicationsReady/UnGhettoMyLife/.env.local",
				},
			},
			"failure",
		);

		expect(record).toEqual({
			timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
			status: "failure",
			tool_name: "Read",
			protected_path_touched: true,
			paths: ["/Applications/ApplicationsReady/UnGhettoMyLife/.env.local"],
		});
	});

	it("handles direnv export helpers", () => {
		expect(shouldReloadDirenv("", "/tmp/codex-env")).toBe(false);
		expect(shouldReloadDirenv(process.cwd(), "")).toBe(false);

		const output = buildDirenvExports(
			JSON.stringify({
				APP_MODE: "dev",
				DIRENV_DIFF: "ignored",
				QUOTED: "teacher's laptop",
			}),
		);

		expect(output).toContain("export APP_MODE='dev'");
		expect(output).not.toContain("DIRENV_DIFF");
		expect(output).toContain("export QUOTED='teacher'\"'\"'s laptop'");
	});
});
