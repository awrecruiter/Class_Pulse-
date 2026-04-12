#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

const PROTECTED_BASENAMES = new Set([".env", ".env.local", ".envrc"]);
const PROTECTED_SUFFIXES = ["/.claude/settings.local.json", ".claude/settings.local.json"];

const PROTECTED_PREFIXES = [".env."];
const SAFE_BASENAMES = new Set([".env.example"]);

function normalizePath(filePath) {
	return String(filePath).replaceAll("\\", "/");
}

export function isProtectedPath(filePath) {
	if (!filePath) {
		return false;
	}

	const normalizedPath = normalizePath(filePath);
	const basename = path.posix.basename(normalizedPath);

	if (SAFE_BASENAMES.has(basename)) {
		return false;
	}

	if (PROTECTED_BASENAMES.has(basename)) {
		return true;
	}

	if (PROTECTED_SUFFIXES.some((suffix) => normalizedPath.endsWith(suffix))) {
		return true;
	}

	return PROTECTED_PREFIXES.some((prefix) => basename.startsWith(prefix));
}

function collectCandidatePaths(input, output = []) {
	if (!input || typeof input !== "object") {
		return output;
	}

	for (const [key, value] of Object.entries(input)) {
		if (typeof value === "string") {
			if (
				key === "file_path" ||
				key === "old_file_path" ||
				key === "new_file_path" ||
				key === "path" ||
				key === "directory"
			) {
				output.push(value);
			}
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string") {
					output.push(item);
				} else {
					collectCandidatePaths(item, output);
				}
			}
			continue;
		}

		collectCandidatePaths(value, output);
	}

	return output;
}

function analyzeBashCommand(command) {
	if (!command) {
		return null;
	}

	const protectedPathPatterns = [
		/(^|[\s"'`])\.env($|[\s"'`/\\])/,
		/(^|[\s"'`])\.env\.[^\s"'`/\\]+/,
		/(^|[\s"'`])\.envrc($|[\s"'`/\\])/,
		/(^|[\s"'`])\.claude\/settings\.local\.json($|[\s"'`/\\])/,
	];

	if (protectedPathPatterns.some((pattern) => pattern.test(command))) {
		return "Bash command references a protected env file or local Claude settings.";
	}

	const secretDumpPatterns = [
		/(^|[;&(|]\s*)printenv(\s|$)/,
		/(^|[;&(|]\s*)env(\s*(\||>|>>|$))/,
		/process\.env/,
		/os\.environ/,
	];

	if (secretDumpPatterns.some((pattern) => pattern.test(command))) {
		return "Bash command appears to dump environment variables.";
	}

	return null;
}

export function analyzeHookInput(payload) {
	const toolName = payload?.tool_name;
	const toolInput = payload?.tool_input ?? {};

	if (toolName === "Bash") {
		const reason = analyzeBashCommand(toolInput.command ?? "");
		if (reason) {
			return { allow: false, reason };
		}
	}

	for (const candidatePath of collectCandidatePaths(toolInput)) {
		if (isProtectedPath(candidatePath)) {
			return {
				allow: false,
				reason: `Access to protected env-related path is blocked: ${candidatePath}`,
			};
		}
	}

	return { allow: true };
}

async function readStdin() {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
}

export async function main() {
	const rawInput = await readStdin();
	const payload = rawInput.trim() ? JSON.parse(rawInput) : {};
	const result = analyzeHookInput(payload);

	if (!result.allow) {
		process.stderr.write(`${result.reason}\n`);
		process.exit(2);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		process.stderr.write(
			`protect-env hook failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exit(1);
	});
}
