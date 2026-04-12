#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

const PROTECTED_BASENAMES = new Set([".env", ".env.local", ".envrc"]);
const PROTECTED_SUFFIXES = ["/.codex/config.local.toml", ".codex/config.local.toml"];
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

function analyzeCommand(command) {
	if (!command) {
		return null;
	}

	const protectedPathPatterns = [
		/(^|[\s"'`])\.env($|[\s"'`/\\])/,
		/(^|[\s"'`])\.env\.[^\s"'`/\\]+/,
		/(^|[\s"'`])\.envrc($|[\s"'`/\\])/,
		/(^|[\s"'`])\.codex\/config\.local\.toml($|[\s"'`/\\])/,
	];

	if (protectedPathPatterns.some((pattern) => pattern.test(command))) {
		return "Command references a protected env file or local Codex config.";
	}

	const secretDumpPatterns = [
		/(^|[;&(|]\s*)printenv(\s|$)/,
		/(^|[;&(|]\s*)env(\s*(\||>|>>|$))/,
		/process\.env/,
		/os\.environ/,
	];

	if (secretDumpPatterns.some((pattern) => pattern.test(command))) {
		return "Command appears to dump environment variables.";
	}

	return null;
}

export function analyzeInvocation(input) {
	const command = input?.command ?? input?.cmd ?? "";
	const paths = [input?.file_path, input?.path, input?.new_file_path, input?.old_file_path].filter(
		Boolean,
	);

	for (const candidatePath of paths) {
		if (isProtectedPath(candidatePath)) {
			return {
				allow: false,
				reason: `Access to protected env-related path is blocked: ${candidatePath}`,
			};
		}
	}

	const reason = analyzeCommand(command);
	if (reason) {
		return { allow: false, reason };
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
	const result = analyzeInvocation(payload);

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
