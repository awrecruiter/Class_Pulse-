vi.mock("@/lib/orientation/parent-confirmation", () => ({
	canShareParentReport: async () => true,
}));

import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ where: vi.fn(), values: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
	auth: { getSession: async () => ({ data: { user: { id: "tutor" } } }) },
}));
vi.mock("@/lib/rate-limit", () => ({ sessionRateLimiter: { check: () => ({ success: true }) } }));
vi.mock("@/lib/db", () => ({
	db: {
		select: () => ({
			from: () => ({ where: mocks.where, innerJoin: () => ({ where: mocks.where }) }),
		}),
		insert: () => ({ values: mocks.values }),
	},
}));

import { POST } from "./route";

it("shares general progress without fabricating a fifth-grade intervention or evidence count", async () => {
	mocks.where
		.mockResolvedValueOnce([{ id: "class" }])
		.mockResolvedValueOnce([{ id: "student" }])
		.mockReturnValueOnce({ limit: async () => [] })
		.mockReturnValueOnce({ limit: async () => [] });
	mocks.values.mockReturnValue({ returning: async () => [{ id: "flag" }] });
	const response = await POST(
		new NextRequest("http://localhost/api/report/token", {
			method: "POST",
			body: JSON.stringify({ classId: "class", rosterId: "student" }),
		}),
	);
	expect(response.status).toBe(200);
	expect(mocks.values.mock.calls[0][0]).toMatchObject({
		standardCode: "GENERAL_PROGRESS",
		sessionCount: 0,
	});
});
