import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create };
	},
}));

import { getScaffold } from "./coach";
import { generateCheckQuestions } from "./questions";

describe("AI learner context", () => {
	beforeEach(() => create.mockReset());
	it.each(["", "8", "adult"])("uses the tutor's level %s in coaching", async (gradeLevel) => {
		create.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						studentInterpretation: "Student thinks…",
						script: "Try this",
						missingConcept: { code: "", description: "Equivalent expressions", grade: 8 },
						visual: "",
						microIntervention: "",
						guidingQuestions: [],
						below: { script: "Simplify" },
					}),
				},
			],
		});
		await getScaffold({
			gradeLevel,
			lessonTranscript: "Equivalent expressions",
			studentQuery: "Why distribute?",
		});
		const request = create.mock.calls[0][0];
		expect(request.messages[0].content).toContain(
			`Learner grade/level: ${gradeLevel || "Unspecified"}`,
		);
		expect(request.system).not.toContain("expert 5th-grade");
	});
	it("does not assign a fifth-grade standard to a generic practice activity", async () => {
		create.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						questions: [
							{
								question: "Compare",
								options: ["1", "2", "3", "4"],
								correctIndex: 0,
								explanation: "Compare values",
							},
						],
					}),
				},
			],
		});
		const result = await generateCheckQuestions("fraction-bar");
		const prompt = create.mock.calls[0][0].messages[0].content;
		expect(prompt).toContain("No grade or curriculum standard specified");
		expect(prompt).not.toContain("MA.5.");
		expect(result.standardDescription).toBeUndefined();
	});
	it("preserves an explicitly selected curriculum standard", async () => {
		create.mockResolvedValue({
			content: [{ type: "text", text: '{"questions":[{"question":"Compare"}]}' }],
		});
		await generateCheckQuestions("fraction-bar", "MA.5.FR.1.1");
		expect(create.mock.calls[0][0].messages[0].content).toContain("MA.5.FR.1.1 (Grade 5)");
	});
});
