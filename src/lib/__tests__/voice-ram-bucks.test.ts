import { describe, expect, it } from "vitest";
import { z } from "zod";

// ── awardSchema — copied verbatim from src/app/api/classes/[id]/ram-bucks/route.ts ──

const awardSchema = z.object({
	rosterId: z.string().uuid(),
	amount: z.number().int().min(-10000).max(10000),
	type: z.enum([
		"academic-correct",
		"academic-mastery",
		"academic-iready",
		"behavior-positive",
		"behavior-fine",
		"purchase",
		"manual-award",
		"manual-deduct",
		"reset",
	]),
	reason: z.string().max(200).default(""),
	sessionId: z.string().uuid().optional(),
});

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("awardSchema validation", () => {
	it("accepts a valid award payload", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: 5,
			type: "behavior-positive",
		});
		expect(result.success).toBe(true);
	});

	it("defaults reason to empty string", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: 1,
			type: "academic-correct",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.reason).toBe("");
		}
	});

	it("accepts optional sessionId when provided", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: 2,
			type: "manual-award",
			sessionId: VALID_UUID,
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid rosterId (not UUID)", () => {
		const result = awardSchema.safeParse({
			rosterId: "not-a-uuid",
			amount: 1,
			type: "behavior-positive",
		});
		expect(result.success).toBe(false);
	});

	it("rejects amount above max (10000)", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: 10001,
			type: "manual-award",
		});
		expect(result.success).toBe(false);
	});

	it("rejects amount below min (-10000)", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: -10001,
			type: "manual-deduct",
		});
		expect(result.success).toBe(false);
	});

	it("accepts boundary amount -10000", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: -10000,
			type: "manual-deduct",
		});
		expect(result.success).toBe(true);
	});

	it("accepts boundary amount 10000", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: 10000,
			type: "manual-award",
		});
		expect(result.success).toBe(true);
	});

	it("rejects non-integer amount", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: 1.5,
			type: "behavior-positive",
		});
		expect(result.success).toBe(false);
	});

	it("rejects unknown type", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: 1,
			type: "unknown-type",
		});
		expect(result.success).toBe(false);
	});

	it("accepts all valid types", () => {
		const types = [
			"academic-correct",
			"academic-mastery",
			"academic-iready",
			"behavior-positive",
			"behavior-fine",
			"purchase",
			"manual-award",
			"manual-deduct",
			"reset",
		] as const;
		for (const type of types) {
			const result = awardSchema.safeParse({ rosterId: VALID_UUID, amount: 0, type });
			expect(result.success, `type "${type}" should be valid`).toBe(true);
		}
	});

	it("rejects reason longer than 200 chars", () => {
		const result = awardSchema.safeParse({
			rosterId: VALID_UUID,
			amount: 1,
			type: "manual-award",
			reason: "a".repeat(201),
		});
		expect(result.success).toBe(false);
	});
});
