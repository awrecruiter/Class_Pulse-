import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ values: vi.fn(), where: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
	auth: { getSession: async () => ({ data: { user: { id: "tutor" } } }) },
}));
vi.mock("@/lib/rate-limit", () => ({ sessionRateLimiter: { check: () => ({ success: true }) } }));
vi.mock("@/lib/db", () => ({
	db: {
		insert: () => ({ values: mocks.values }),
		select: () => ({ from: () => ({ where: mocks.where }) }),
	},
}));

import { PgDialect } from "drizzle-orm/pg-core";
import { GET, POST } from "./route";

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

describe("workspace separation", () => {
	it.each([undefined, "classroom", "distance", "homeschool"])(
		"filters the authenticated teacher's workspace: %s",
		async (mode) => {
			mocks.where.mockReset().mockResolvedValue([]);
			const response = await GET(
				new NextRequest(`https://example.com/api/classes${mode ? `?mode=${mode}` : ""}`),
			);
			expect(response.status).toBe(200);
			const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
			expect(query.params).toEqual(["tutor", mode ?? "classroom"]);
		},
	);
	it.each(["distance", "homeschool"])(
		"requires explicit opt-in when creating a %s space",
		async (workspaceMode) => {
			mocks.values.mockReset().mockReturnValue({ returning: async () => [{}] });
			const response = await POST(
				new NextRequest("https://example.com/api/classes", {
					method: "POST",
					body: JSON.stringify({ label: "New space", workspaceMode }),
				}),
			);
			expect(response.status).toBe(201);
			expect(mocks.values).toHaveBeenCalledWith(
				expect.objectContaining({ workspaceMode, teacherId: "tutor" }),
			);
		},
	);
	it("defaults existing creation callers to classroom", async () => {
		mocks.values.mockReset().mockReturnValue({ returning: async () => [{}] });
		await POST(
			new NextRequest("https://example.com/api/classes", {
				method: "POST",
				body: JSON.stringify({ label: "Original classroom" }),
			}),
		);
		expect(mocks.values).toHaveBeenCalledWith(
			expect.objectContaining({ workspaceMode: "classroom" }),
		);
	});
});
