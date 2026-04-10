#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isProtectedPath } from "./protect-env.mjs";

function collectPaths(input, output = []) {
	if (!input || typeof input !== "object") {
		return output;
	}

	for (const [key, value] of Object.entries(input)) {
		if (
			typeof value === "string" &&
			(key === "file_path" || key === "old_file_path" || key === "new_file_path" || key === "path")
		) {
			output.push(value);
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string") {
					output.push(item);
				} else {
					collectPaths(item, output);
				}
			}
			continue;
		}

		collectPaths(value, output);
	}

	return output;
}

export function buildToolEventRecord(payload, status) {
	const toolInput = payload?.tool_input ?? payload ?? {};
	const candidatePaths = collectPaths(toolInput);

	return {
		timestamp: new Date().toISOString(),
		status,
		tool_name: payload?.tool_name ?? payload?.tool ?? "unknown",
		protected_path_touched: candidatePaths.some((candidatePath) => isProtectedPath(candidatePath)),
		paths: candidatePaths,
	};
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
	const status = process.argv[2] ?? "unknown";
	const rawInput = await readStdin();
	const payload = rawInput.trim() ? JSON.parse(rawInput) : {};
	const record = buildToolEventRecord(payload, status);
	const logDir = path.join(process.cwd(), ".codex", "logs");
	const logPath = path.join(logDir, "tool-events.log");

	fs.mkdirSync(logDir, { recursive: true });
	fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		process.stderr.write(
			`log-tool-event hook failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exit(1);
	});
}
