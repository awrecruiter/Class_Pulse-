import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

// ── PatchGroupSchema — copied verbatim from
//    src/app/api/classes/[id]/di-sessions/[diSessionId]/groups/[groupId]/route.ts ──

const PatchGroupSchema = z.object({
	delta: z.number().int(),
});

// ── Group points clamping — mirrors logic in route PATCH handler ──
function applyDelta(currentPoints: number, delta: number): number {
	return Math.max(0, currentPoints + delta);
}

describe("PatchGroupSchema validation", () => {
	it("accepts a positive integer delta", () => {
		expect(PatchGroupSchema.safeParse({ delta: 1 }).success).toBe(true);
	});
	it("accepts a negative integer delta", () => {
		expect(PatchGroupSchema.safeParse({ delta: -1 }).success).toBe(true);
	});
	it("accepts delta of zero", () => {
		expect(PatchGroupSchema.safeParse({ delta: 0 }).success).toBe(true);
	});
	it("rejects float delta", () => {
		expect(PatchGroupSchema.safeParse({ delta: 0.5 }).success).toBe(false);
	});
	it("rejects missing delta", () => {
		expect(PatchGroupSchema.safeParse({}).success).toBe(false);
	});
	it("rejects string delta", () => {
		expect(PatchGroupSchema.safeParse({ delta: "1" }).success).toBe(false);
	});
});

describe("group points clamping", () => {
	it("adds positive delta to current points", () => {
		expect(applyDelta(5, 2)).toBe(7);
	});
	it("subtracts negative delta from current points", () => {
		expect(applyDelta(5, -2)).toBe(3);
	});
	it("clamps at zero — never goes negative", () => {
		expect(applyDelta(2, -5)).toBe(0);
	});
	it("stays at zero when already zero and delta is negative", () => {
		expect(applyDelta(0, -3)).toBe(0);
	});
	it("adds to zero correctly", () => {
		expect(applyDelta(0, 10)).toBe(10);
	});
	it("large positive delta works", () => {
		expect(applyDelta(100, 50)).toBe(150);
	});
});
