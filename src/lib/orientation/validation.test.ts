import { describe, expect, it } from "vitest";
import {
	activityUrlSchema,
	meetingUrlSchema,
	orientationIntakeSchema,
	orientationProgressSchema,
} from "./validation";

const intake = {
	parentName: "Test Parent",
	parentEmail: "parent@example.com",
	phone: "2025550101",
	studentFirstName: "Test",
	studentLastInitial: "S",
	gradeLevel: "",
	learningContent: "Fractions",
	initialSignal: "almost",
	guardianConfirmed: true,
};

describe("family orientation validation", () => {
	it.each(["", "K", "8", "12", "mixed", "adult"])(
		"accepts grade-independent intake: %s",
		(gradeLevel) => {
			const result = orientationIntakeSchema.parse({ ...intake, gradeLevel });
			expect(result.gradeLevel).toBe(gradeLevel);
			expect(result.phone).toBe("+12025550101");
		},
	);
	it.each([
		{ parentEmail: "invalid" },
		{ guardianConfirmed: false },
		{ initialSignal: "mastered" },
		{ studentFirstName: " " },
		{ learningContent: "" },
	])("rejects incomplete intake %j", (override) => {
		expect(orientationIntakeSchema.safeParse({ ...intake, ...override }).success).toBe(false);
	});
	it("requires evidence and home reinforcement before publishing progress", () => {
		expect(orientationProgressSchema.safeParse({ reviewed: true }).success).toBe(false);
		expect(
			orientationProgressSchema.safeParse({
				reviewed: true,
				progressNote: "Compared 3 of 4 fractions independently",
				homePractice: "Compare halves and thirds with a sketch",
			}).success,
		).toBe(true);
	});
	it.each(["javascript:alert(1)", "http://example.com", "https://user:password@example.com"])(
		"rejects unsafe activity links %s",
		(url) => expect(activityUrlSchema.safeParse(url).success).toBe(false),
	);
	it.each(["not-a-url", "https://zoom.us.evil.test/j/1", "https://example.com"])(
		"rejects invalid Zoom links without throwing: %s",
		(url) => expect(meetingUrlSchema.safeParse(url).success).toBe(false),
	);
	it("accepts a tutor's Zoom meeting and any HTTPS quiz provider", () => {
		expect(meetingUrlSchema.parse("https://us02web.zoom.us/j/123")).toBeTruthy();
		expect(activityUrlSchema.parse("https://wayground.com/join")).toBeTruthy();
	});
});
