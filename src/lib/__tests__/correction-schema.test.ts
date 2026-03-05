import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirror the schemas from the correction-requests route
const postSchema = z.object({
	context: z.string().max(200).default(""),
});

const patchSchema = z.object({
	requestId: z.string().uuid(),
});

describe("correction-requests POST schema", () => {
	it("accepts an empty string context", () => {
		const result = postSchema.safeParse({ context: "" });
		expect(result.success).toBe(true);
		expect(result.data?.context).toBe("");
	});

	it("accepts omitted context (defaults to empty string)", () => {
		const result = postSchema.safeParse({});
		expect(result.success).toBe(true);
		expect(result.data?.context).toBe("");
	});

	it("accepts a short context string", () => {
		const result = postSchema.safeParse({ context: "I don't understand fractions" });
		expect(result.success).toBe(true);
	});

	it("rejects context longer than 200 characters", () => {
		const long = "a".repeat(201);
		const result = postSchema.safeParse({ context: long });
		expect(result.success).toBe(false);
	});

	it("accepts context exactly 200 characters", () => {
		const exact = "a".repeat(200);
		const result = postSchema.safeParse({ context: exact });
		expect(result.success).toBe(true);
	});
});

describe("correction-requests PATCH schema", () => {
	it("accepts a valid UUID requestId", () => {
		const result = patchSchema.safeParse({ requestId: "123e4567-e89b-12d3-a456-426614174000" });
		expect(result.success).toBe(true);
	});

	it("rejects a non-UUID requestId", () => {
		const result = patchSchema.safeParse({ requestId: "not-a-uuid" });
		expect(result.success).toBe(false);
	});

	it("rejects a missing requestId", () => {
		const result = patchSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("rejects an empty string requestId", () => {
		const result = patchSchema.safeParse({ requestId: "" });
		expect(result.success).toBe(false);
	});
});
