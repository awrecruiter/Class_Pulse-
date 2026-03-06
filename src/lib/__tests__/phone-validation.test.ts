import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

// Mirrors PHONE_RE and contactSchema from /api/classes/[id]/parent-contacts/route.ts
const PHONE_RE = /^\+1\d{10}$/;

const phoneSchema = z
	.string()
	.refine((v) => PHONE_RE.test(v), "Invalid US phone number — enter 10 digits");

describe("PHONE_RE validation", () => {
	it("accepts a valid US number in E.164 format", () => {
		expect(PHONE_RE.test("+12125551234")).toBe(true);
	});

	it("accepts another valid US number", () => {
		expect(PHONE_RE.test("+13055559876")).toBe(true);
	});

	it("rejects number without +1 country code", () => {
		expect(PHONE_RE.test("2125551234")).toBe(false);
	});

	it("rejects number with +1 but only 9 digits", () => {
		expect(PHONE_RE.test("+1212555123")).toBe(false);
	});

	it("rejects number with +1 but 11 digits", () => {
		expect(PHONE_RE.test("+121255512345")).toBe(false);
	});

	it("rejects international number (not +1)", () => {
		expect(PHONE_RE.test("+442071838750")).toBe(false);
	});

	it("rejects empty string", () => {
		expect(PHONE_RE.test("")).toBe(false);
	});

	it("rejects number with letters", () => {
		expect(PHONE_RE.test("+1212555ABCD")).toBe(false);
	});

	it("rejects number with spaces", () => {
		expect(PHONE_RE.test("+1 212 555 1234")).toBe(false);
	});

	it("rejects number with dashes", () => {
		expect(PHONE_RE.test("+1-212-555-1234")).toBe(false);
	});
});

describe("contactSchema phone field", () => {
	it("accepts valid E.164 number", () => {
		const result = phoneSchema.safeParse("+12125551234");
		expect(result.success).toBe(true);
	});

	it("rejects invalid number with correct error message", () => {
		const result = phoneSchema.safeParse("5551234");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Invalid US phone number — enter 10 digits");
		}
	});
});
