import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.NEON_AUTH_COOKIE_SECRET ?? "dev-secret-change-in-prod";

export const STUDENT_COOKIE = "student_session";

export type StudentToken = {
	sessionId: string;
	rosterId: string;
};

export function signStudentToken(payload: StudentToken): string {
	const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
	return `${data}.${sig}`;
}

export function verifyStudentToken(token: string): StudentToken | null {
	try {
		const dot = token.lastIndexOf(".");
		if (dot === -1) return null;
		const data = token.slice(0, dot);
		const sig = token.slice(dot + 1);
		const expected = createHmac("sha256", SECRET).update(data).digest("base64url");
		// Constant-time comparison to prevent timing attacks
		const sigBuf = Buffer.from(sig);
		const expBuf = Buffer.from(expected);
		if (sigBuf.length !== expBuf.length) return null;
		if (!timingSafeEqual(sigBuf, expBuf)) return null;
		return JSON.parse(Buffer.from(data, "base64url").toString()) as StudentToken;
	} catch {
		return null;
	}
}
