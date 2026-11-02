import { describe, expect, it } from "vitest";
import { studentBookingUrlSchema } from "../student-booking";

describe("student booking URL", () => {
	it.each([
		"",
		"https://calendly.com/tutor",
		"https://www.calendly.com/tutor/session?month=2026-11",
	])("accepts disabled booking or Calendly scheduling links: %s", (url) => {
		expect(studentBookingUrlSchema.safeParse(url).success).toBe(true);
	});
	it("trims configuration and supports clearing it", () => {
		expect(studentBookingUrlSchema.parse("  ")).toBe("");
		expect(studentBookingUrlSchema.parse(" https://calendly.com/tutor ")).toBe(
			"https://calendly.com/tutor",
		);
	});
	it.each([
		"https://calendly.com/",
		"http://calendly.com/tutor",
		"https://calendly.com.evil.test/tutor",
		"https://evil.test/calendly.com/tutor",
		"https://user:pass@calendly.com/tutor",
		"https://calendly.com:8080/tutor",
		"javascript:alert(1)",
		"not-a-url",
	])("rejects unsafe or non-scheduling links: %s", (url) => {
		expect(studentBookingUrlSchema.safeParse(url).success).toBe(false);
	});
});
