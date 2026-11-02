import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ values: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
	auth: { getSession: async () => ({ data: { user: { id: "tutor" } } }) },
}));
vi.mock("@/lib/rate-limit", () => ({ sessionRateLimiter: { check: () => ({ success: true }) } }));
vi.mock("@/lib/db", () => ({ db: { insert: () => ({ values: mocks.values }) } }));

import { POST } from "./route";

describe("grade-agnostic classes", () => {
	beforeEach(() => {
		mocks.values.mockReset().mockReturnValue({ returning: async () => [{ id: "class-1" }] });
	});
	it.each([undefined, "", "K", "1", "5", "8", "12", "mixed", "adult"])(
		"preserves an explicit level or leaves it unspecified: %s",
		async (gradeLevel) => {
			const response = await POST(
				new NextRequest("http://localhost/api/classes", {
					method: "POST",
					body: JSON.stringify({ label: "Tutoring", gradeLevel }),
				}),
			);
			expect(response.status).toBe(201);
			expect(mocks.values).toHaveBeenCalledWith(
				expect.objectContaining({ gradeLevel: gradeLevel ?? "", teacherId: "tutor" }),
			);
		},
	);
});
