import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

// Mirrors CreateSessionSchema from /api/classes/[id]/di-sessions/route.ts
const CreateSessionSchema = z.object({
	label: z.string().min(1).max(100).default("DI Activity"),
	groups: z
		.array(
			z.object({
				name: z.string().min(1).max(30),
				color: z.string().min(1).max(20),
				memberRosterIds: z.array(z.string()),
			}),
		)
		.min(2)
		.max(6),
});

const validGroup = { name: "Red", color: "red", memberRosterIds: [] };

describe("DI session CreateSessionSchema", () => {
	it("accepts a valid session with 2 groups", () => {
		const result = CreateSessionSchema.safeParse({
			label: "Fractions Review",
			groups: [validGroup, { name: "Blue", color: "blue", memberRosterIds: [] }],
		});
		expect(result.success).toBe(true);
	});

	it("accepts a session with 6 groups (max)", () => {
		const groups = ["red", "blue", "green", "yellow", "orange", "purple"].map((c) => ({
			name: c,
			color: c,
			memberRosterIds: [],
		}));
		const result = CreateSessionSchema.safeParse({ label: "Big DI", groups });
		expect(result.success).toBe(true);
	});

	it("rejects fewer than 2 groups", () => {
		const result = CreateSessionSchema.safeParse({ groups: [validGroup] });
		expect(result.success).toBe(false);
	});

	it("rejects more than 6 groups", () => {
		const groups = Array.from({ length: 7 }, (_, i) => ({
			name: `Group ${i}`,
			color: "red",
			memberRosterIds: [],
		}));
		const result = CreateSessionSchema.safeParse({ label: "Too many", groups });
		expect(result.success).toBe(false);
	});

	it("rejects empty label", () => {
		const result = CreateSessionSchema.safeParse({
			label: "",
			groups: [validGroup, validGroup],
		});
		expect(result.success).toBe(false);
	});

	it("rejects label longer than 100 chars", () => {
		const result = CreateSessionSchema.safeParse({
			label: "a".repeat(101),
			groups: [validGroup, validGroup],
		});
		expect(result.success).toBe(false);
	});

	it("rejects group name longer than 30 chars", () => {
		const result = CreateSessionSchema.safeParse({
			label: "Test",
			groups: [{ name: "a".repeat(31), color: "red", memberRosterIds: [] }, validGroup],
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty group name", () => {
		const result = CreateSessionSchema.safeParse({
			label: "Test",
			groups: [{ name: "", color: "red", memberRosterIds: [] }, validGroup],
		});
		expect(result.success).toBe(false);
	});

	it("defaults label to 'DI Activity' when omitted", () => {
		const result = CreateSessionSchema.safeParse({
			groups: [validGroup, validGroup],
		});
		expect(result.success).toBe(true);
		expect(result.data?.label).toBe("DI Activity");
	});

	it("accepts groups with member roster IDs", () => {
		const result = CreateSessionSchema.safeParse({
			label: "Math Relay",
			groups: [
				{
					name: "Red",
					color: "red",
					memberRosterIds: ["uuid-1", "uuid-2"],
				},
				{
					name: "Blue",
					color: "blue",
					memberRosterIds: ["uuid-3"],
				},
			],
		});
		expect(result.success).toBe(true);
	});
});
