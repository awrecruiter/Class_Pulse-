#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

export function buildAuditRecord(payload) {
	return {
		timestamp: new Date().toISOString(),
		source: payload?.source ?? "unknown",
		file_path: payload?.file_path ?? "unknown",
	};
}

export async function main() {
	const rawInput = await readStdin();
	const payload = rawInput.trim() ? JSON.parse(rawInput) : {};
	const record = buildAuditRecord(payload);
	const logDir = path.join(process.cwd(), ".claude", "logs");
	const logPath = path.join(logDir, "config-change.log");

	fs.mkdirSync(logDir, { recursive: true });
	fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		process.stderr.write(
			`audit-config-change hook failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exit(1);
	});
}
