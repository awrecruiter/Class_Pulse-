import { describe, expect, it } from "vitest";
import { generateJoinCode } from "../join-code";

const VALID_CHARS = new Set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
const AMBIGUOUS = new Set(["0", "O", "I", "1"]);

describe("generateJoinCode", () => {
	it("produces a 6-character string", () => {
		const code = generateJoinCode();
		expect(code).toHaveLength(6);
	});

	it("contains only characters from the allowed set", () => {
		for (let i = 0; i < 100; i++) {
			const code = generateJoinCode();
			for (const ch of code) {
				expect(VALID_CHARS.has(ch), `unexpected char '${ch}' in '${code}'`).toBe(true);
			}
		}
	});

	it("never contains visually ambiguous characters (0, O, I, 1)", () => {
		for (let i = 0; i < 100; i++) {
			const code = generateJoinCode();
			for (const ch of code) {
				expect(AMBIGUOUS.has(ch), `ambiguous char '${ch}' in '${code}'`).toBe(false);
			}
		}
	});

	it("generates different codes across multiple calls", () => {
		const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
		// With 32^6 = 1B+ possibilities, 20 calls should always be unique
		expect(codes.size).toBe(20);
	});

	it("returns only uppercase letters and digits", () => {
		for (let i = 0; i < 50; i++) {
			const code = generateJoinCode();
			expect(code).toMatch(/^[A-Z2-9]+$/);
		}
	});
});
