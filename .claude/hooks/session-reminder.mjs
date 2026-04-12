#!/usr/bin/env node

process.stdout.write(
	[
		"Env protection is active for Claude hooks in this repo.",
		"Do not read, grep, or print local env files like .env, .env.local, .env.* , .envrc, or .claude/settings.local.json.",
		"Use .env.example when you need documented variable names.",
	].join(" "),
);
