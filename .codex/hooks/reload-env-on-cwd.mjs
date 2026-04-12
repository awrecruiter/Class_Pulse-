#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function toShellAssignment([key, value]) {
	const escapedValue = String(value ?? "").replaceAll("'", "'\"'\"'");
	return `export ${key}='${escapedValue}'`;
}

export function shouldReloadDirenv(cwd, envFile) {
	if (!cwd || !envFile) {
		return false;
	}

	return fs.existsSync(path.join(cwd, ".envrc"));
}

export function buildDirenvExports(jsonText) {
	const parsed = JSON.parse(jsonText);

	return Object.entries(parsed)
		.filter(([key]) => !key.startsWith("DIRENV_"))
		.map(toShellAssignment)
		.join("\n");
}

export async function main() {
	const cwd = process.cwd();
	const envFile = process.env.CODEX_ENV_FILE;

	if (!shouldReloadDirenv(cwd, envFile)) {
		return;
	}

	let direnvJson;
	try {
		direnvJson = execFileSync("direnv", ["export", "json"], {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return;
	}

	const exportsText = buildDirenvExports(direnvJson);
	if (!exportsText) {
		return;
	}

	fs.appendFileSync(envFile, `${exportsText}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		process.stderr.write(
			`reload-env-on-cwd hook failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exit(1);
	});
}
