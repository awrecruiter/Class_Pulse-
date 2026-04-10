#!/usr/bin/env node

process.stdout.write(
	[
		"Env protection is active for Codex workflows in this repo.",
		"Do not read, grep, or print local env files like .env, .env.local, .env.*, .envrc, or .codex/config.local.toml.",
		"Use .env.example when you need documented variable names.",
	].join(" "),
);
