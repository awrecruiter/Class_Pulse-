import { describe, expect, it } from "vitest";
import { z } from "zod";

// ── Schemas — copied verbatim from src/app/api/schedule/bulk/route.ts ──

const blockSchema = z.object({
	title: z.string().min(1).max(200),
	color: z.string().default("blue"),
	startTime: z.string().regex(/^\d{2}:\d{2}$/),
	endTime: z.string().regex(/^\d{2}:\d{2}$/),
	dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
	specificDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	sortOrder: z.number().int().optional(),
});

const bodySchema = z.object({
	blocks: z.array(blockSchema).min(1).max(200),
});

describe("blockSchema validation", () => {
	const validBlock = {
		title: "Math Block",
		startTime: "08:30",
		endTime: "09:30",
	};

	it("accepts a minimal valid block", () => {
		expect(blockSchema.safeParse(validBlock).success).toBe(true);
	});

	it("defaults color to 'blue'", () => {
		const result = blockSchema.safeParse(validBlock);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.color).toBe("blue");
		}
	});

	it("accepts a full block with all optional fields", () => {
		const result = blockSchema.safeParse({
			...validBlock,
			color: "green",
			dayOfWeek: 3,
			specificDate: "2026-03-17",
			sortOrder: 5,
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty title", () => {
		expect(blockSchema.safeParse({ ...validBlock, title: "" }).success).toBe(false);
	});

	it("rejects title longer than 200 chars", () => {
		expect(blockSchema.safeParse({ ...validBlock, title: "a".repeat(201) }).success).toBe(false);
	});

	it("rejects startTime without correct format", () => {
		expect(blockSchema.safeParse({ ...validBlock, startTime: "8:30" }).success).toBe(false);
		expect(blockSchema.safeParse({ ...validBlock, startTime: "08:30:00" }).success).toBe(false);
		expect(blockSchema.safeParse({ ...validBlock, startTime: "0830" }).success).toBe(false);
	});

	it("accepts valid HH:MM times", () => {
		expect(blockSchema.safeParse({ ...validBlock, startTime: "00:00" }).success).toBe(true);
		expect(blockSchema.safeParse({ ...validBlock, startTime: "23:59" }).success).toBe(true);
	});

	it("rejects dayOfWeek less than 0", () => {
		expect(blockSchema.safeParse({ ...validBlock, dayOfWeek: -1 }).success).toBe(false);
	});

	it("rejects dayOfWeek greater than 6", () => {
		expect(blockSchema.safeParse({ ...validBlock, dayOfWeek: 7 }).success).toBe(false);
	});

	it("accepts dayOfWeek boundary values 0 and 6", () => {
		expect(blockSchema.safeParse({ ...validBlock, dayOfWeek: 0 }).success).toBe(true);
		expect(blockSchema.safeParse({ ...validBlock, dayOfWeek: 6 }).success).toBe(true);
	});

	it("accepts null dayOfWeek", () => {
		expect(blockSchema.safeParse({ ...validBlock, dayOfWeek: null }).success).toBe(true);
	});

	it("rejects specificDate not in YYYY-MM-DD format", () => {
		expect(blockSchema.safeParse({ ...validBlock, specificDate: "2026/03/17" }).success).toBe(
			false,
		);
		expect(blockSchema.safeParse({ ...validBlock, specificDate: "03-17-2026" }).success).toBe(
			false,
		);
	});

	it("accepts valid specificDate", () => {
		expect(blockSchema.safeParse({ ...validBlock, specificDate: "2026-03-17" }).success).toBe(true);
	});

	it("rejects non-integer sortOrder", () => {
		expect(blockSchema.safeParse({ ...validBlock, sortOrder: 1.5 }).success).toBe(false);
	});
});

describe("bodySchema validation", () => {
	const validBlock = { title: "Math", startTime: "08:30", endTime: "09:30" };

	it("accepts array with one block", () => {
		expect(bodySchema.safeParse({ blocks: [validBlock] }).success).toBe(true);
	});

	it("rejects empty blocks array", () => {
		expect(bodySchema.safeParse({ blocks: [] }).success).toBe(false);
	});

	it("rejects blocks array with more than 200 items", () => {
		const tooMany = Array.from({ length: 201 }, () => validBlock);
		expect(bodySchema.safeParse({ blocks: tooMany }).success).toBe(false);
	});

	it("accepts exactly 200 blocks", () => {
		const maxBlocks = Array.from({ length: 200 }, () => validBlock);
		expect(bodySchema.safeParse({ blocks: maxBlocks }).success).toBe(true);
	});

	it("rejects missing blocks field", () => {
		expect(bodySchema.safeParse({}).success).toBe(false);
	});
});
