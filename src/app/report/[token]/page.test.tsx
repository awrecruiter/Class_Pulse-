import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: [] as unknown[][] }));
vi.mock("@/lib/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => {
					const result = Promise.resolve(mocks.rows.shift() ?? []);
					return Object.assign(result, { orderBy: () => ({ limit: () => result }) });
				},
			}),
		}),
	},
}));

import ReportPage from "./page";

describe("orientation parent progress", () => {
	beforeEach(() => {
		mocks.rows = [
			[
				{
					id: "token",
					flagId: "flag",
					expiresAt: new Date(Date.now() + 100000),
					viewedAt: new Date(),
				},
			],
			[
				{
					tier: "watch",
					standardCode: "GENERAL_PROGRESS",
					sessionCount: 0,
					classId: "class",
					rosterId: "student",
					detectedAt: new Date(),
				},
			],
			[],
			[{ firstInitial: "T", lastInitial: "S", studentId: "123" }],
			[{ label: "Mixed tutoring", gradeLevel: "5", subject: "Math" }],
			[],
			[],
		];
	});
	it("shows reviewed evidence and uses the learner's grade rather than the class default", async () => {
		mocks.rows.push([
			{
				gradeLevel: "8",
				content: "Algebra",
				progressNote: "Solved two equations independently",
				homePractice: "Explain an equation with a drawing",
				reviewedAt: new Date(),
			},
		]);
		const html = renderToStaticMarkup(
			await ReportPage({ params: Promise.resolve({ token: "test" }) }),
		);
		expect(html).toContain("Solved two equations independently");
		expect(html).toContain("Explain an equation with a drawing");
		expect(html).toContain("Algebra%20level%208");
		expect(html).not.toContain("level%205");
		expect(html).toContain("Not checked");
		expect(html).not.toContain("Flagged");
	});
	it("keeps draft evidence private and preserves a deliberately unspecified learner grade", async () => {
		mocks.rows.push([
			{
				gradeLevel: "",
				content: "Algebra",
				progressNote: "Private draft",
				homePractice: "Draft task",
				reviewedAt: null,
			},
		]);
		const html = renderToStaticMarkup(
			await ReportPage({ params: Promise.resolve({ token: "test" }) }),
		);
		expect(html).not.toContain("Private draft");
		expect(html).not.toContain("Draft task");
		expect(html).not.toContain("level%205");
	});
});
