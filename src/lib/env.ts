export function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

export function readBooleanEnv(name: string): boolean {
	return process.env[name] === "true";
}
