import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetSessionMock = vi.fn();
const limiterCheckMock = vi.fn(() => ({ success: true }));
const surfaceEnabledMock = vi.fn();
const dbMock = {};

vi.mock("@/lib/auth/server", () => ({
	auth: {
		getSession: () => authGetSessionMock(),
	},
}));

vi.mock("@/lib/db", () => ({
	db: dbMock,
}));

vi.mock("@/lib/rate-limit", () => ({
	sessionRateLimiter: {
		check: () => limiterCheckMock(),
	},
}));

vi.mock("@/lib/subscription/gates", () => ({
	isSurfaceEnabledForUser: () => surfaceEnabledMock(),
}));

describe("/api/coach/academic-guidance", () => {
	beforeEach(() => {
		authGetSessionMock.mockReset();
		limiterCheckMock.mockReset();
		surfaceEnabledMock.mockReset();
		limiterCheckMock.mockReturnValue({ success: true });
	});

	it("returns 403 when instructional coach is disabled", async () => {
		authGetSessionMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
		surfaceEnabledMock.mockResolvedValue(false);

		const { POST } = await import("./route");
		const response = await POST(
			new NextRequest("http://localhost/api/coach/academic-guidance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
		);

		expect(response.status).toBe(403);
	});
});
