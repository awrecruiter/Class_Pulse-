import { describe, expect, it } from "vitest";
import { resolveReminderDate } from "../date-resolver";

const TODAY = new Date(2026, 2, 18); // Wednesday, 2026-03-18

describe("resolveReminderDate", () => {
	describe('"today" and "tomorrow"', () => {
		it('resolves "today"', () => {
			expect(resolveReminderDate("today", TODAY)).toBe("2026-03-18");
		});
		it('resolves "tomorrow"', () => {
			expect(resolveReminderDate("tomorrow", TODAY)).toBe("2026-03-19");
		});
	});

	describe("bare day names", () => {
		it('"Friday" → nearest future Friday (2 days ahead)', () => {
			expect(resolveReminderDate("Friday", TODAY)).toBe("2026-03-20");
		});
		it('"Monday" → next Monday (5 days ahead)', () => {
			expect(resolveReminderDate("Monday", TODAY)).toBe("2026-03-23");
		});
		it('"Wednesday" on Wednesday → next week (7 days)', () => {
			expect(resolveReminderDate("Wednesday", TODAY)).toBe("2026-03-25");
		});
		it('abbreviated "fri"', () => {
			expect(resolveReminderDate("fri", TODAY)).toBe("2026-03-20");
		});
	});

	describe('"next [day]"', () => {
		it('"next Friday" skips nearest Friday', () => {
			expect(resolveReminderDate("next Friday", TODAY)).toBe("2026-03-27");
		});
		it('"next Monday" from Wednesday', () => {
			expect(resolveReminderDate("next Monday", TODAY)).toBe("2026-03-23");
		});
		it('"next Wednesday" from Wednesday skips current week', () => {
			expect(resolveReminderDate("next Wednesday", TODAY)).toBe("2026-03-25");
		});
	});

	describe("month + day", () => {
		it('"March 25th" → 2026-03-25', () => {
			expect(resolveReminderDate("March 25th", TODAY)).toBe("2026-03-25");
		});
		it('"March 3rd" (already passed) → 2027-03-03', () => {
			expect(resolveReminderDate("March 3rd", TODAY)).toBe("2027-03-03");
		});
		it('"April 3rd" → 2026-04-03', () => {
			expect(resolveReminderDate("April 3rd", TODAY)).toBe("2026-04-03");
		});
		it('"April 3" (no ordinal) → 2026-04-03', () => {
			expect(resolveReminderDate("April 3", TODAY)).toBe("2026-04-03");
		});
		it('abbreviated "Mar 25th" → 2026-03-25', () => {
			expect(resolveReminderDate("Mar 25th", TODAY)).toBe("2026-03-25");
		});
	});

	describe("ISO passthrough", () => {
		it("passes through YYYY-MM-DD unchanged", () => {
			expect(resolveReminderDate("2026-04-15", TODAY)).toBe("2026-04-15");
		});
	});

	describe("invalid input", () => {
		it("returns null for unrecognized phrase", () => {
			expect(resolveReminderDate("sometime soon", TODAY)).toBeNull();
		});
		it("returns null for empty string", () => {
			expect(resolveReminderDate("", TODAY)).toBeNull();
		});
	});
});
