import { buildAuditRecord } from "../../../.claude/hooks/audit-config-change.mjs";
import { buildToolEventRecord } from "../../../.claude/hooks/log-tool-event.mjs";
import {
	buildDirenvExports,
	shouldReloadDirenv,
} from "../../../.claude/hooks/reload-env-on-cwd.mjs";

describe("additional Claude hooks", () => {
	it("builds minimal config audit records", () => {
		const record = buildAuditRecord({
			source: "project_settings",
			file_path: "/repo/.claude/settings.json",
		});

		expect(record.source).toBe("project_settings");
		expect(record.file_path).toBe("/repo/.claude/settings.json");
		expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("only reloads direnv when both cwd and env file are present", () => {
		expect(shouldReloadDirenv("", "/tmp/claude-env")).toBe(false);
		expect(shouldReloadDirenv(process.cwd(), "")).toBe(false);
	});

	it("converts direnv json into shell exports", () => {
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

	it("summarizes post-tool events without logging command contents", () => {
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
});
