#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const BUILTIN_ENV_ALLOWLIST = [
	"HOME",
	"PATH",
	"SHELL",
	"TERM",
	"TMPDIR",
	"LANG",
	"LC_ALL",
	"COLORTERM",
	"TERM_PROGRAM",
	"TERM_PROGRAM_VERSION",
	"USER",
	"LOGNAME",
	"DISPLAY",
	"SSH_AUTH_SOCK",
	"EDITOR",
	"VISUAL",
	"PAGER",
	"PWD",
];

const SECRET_ENV_PATTERNS = [
	/API[_-]?KEY/i,
	/SECRET/i,
	/TOKEN/i,
	/PASSWORD/i,
	/CREDENTIAL/i,
	/DATABASE_URL/i,
	/AWS_/i,
	/ANTHROPIC_/i,
	/OPENAI_/i,
	/NEON_AUTH_/i,
	/GOOGLE_CLIENT_/i,
];

function getRepoRoot() {
	return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}

export function readAllowlistFile(filePath) {
	if (!fs.existsSync(filePath)) {
		return [];
	}

	return fs
		.readFileSync(filePath, "utf8")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));
}

export function isSafeExtraEnvName(name) {
	return !SECRET_ENV_PATTERNS.some((pattern) => pattern.test(name));
}

export function buildSanitizedEnv(baseEnv, extraAllowlist = []) {
	const mergedAllowlist = new Set([
		...BUILTIN_ENV_ALLOWLIST,
		...extraAllowlist.filter(isSafeExtraEnvName),
	]);
	const sanitizedEnv = {};

	for (const [key, value] of Object.entries(baseEnv)) {
		if (!mergedAllowlist.has(key)) {
			continue;
		}

		if (typeof value === "string") {
			sanitizedEnv[key] = value;
		}
	}

	return sanitizedEnv;
}

export function buildCodexArgs(userArgs, repoRoot) {
	return ["--cd", repoRoot, ...userArgs];
}

function printSessionReminder(repoRoot) {
	const reminderScript = path.join(repoRoot, ".codex", "hooks", "session-reminder.mjs");
	try {
		const child = spawn(process.execPath, [reminderScript], {
			stdio: ["ignore", "pipe", "inherit"],
		});

		child.stdout.on("data", (chunk) => {
			process.stderr.write(`${chunk}`);
			if (!String(chunk).endsWith("\n")) {
				process.stderr.write("\n");
			}
		});
	} catch {
		// Best effort only.
	}
}

export async function main() {
	const repoRoot = getRepoRoot();
	const allowlistPath = path.join(repoRoot, ".codex", "env.allowlist");
	const extraAllowlist = readAllowlistFile(allowlistPath);
	const sanitizedEnv = buildSanitizedEnv(process.env, extraAllowlist);
	const codexArgs = buildCodexArgs(process.argv.slice(2), repoRoot);

	sanitizedEnv.CODEX_ENV_GUARD = path.join(repoRoot, ".codex", "hooks", "protect-env.mjs");
	sanitizedEnv.CODEX_ENV_GUARD_MODE = "active";

	printSessionReminder(repoRoot);

	const child = spawn("codex", codexArgs, {
		cwd: repoRoot,
		env: sanitizedEnv,
		stdio: "inherit",
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}

		process.exit(code ?? 0);
	});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		process.stderr.write(
			`codex-safe launcher failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exit(1);
	});
}
