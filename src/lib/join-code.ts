import { randomInt } from "node:crypto";

// Exclude visually ambiguous characters: 0, O, I, 1
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
	return Array.from({ length: 6 }, () => CHARS[randomInt(CHARS.length)]).join("");
}
