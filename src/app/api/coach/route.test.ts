import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getScaffoldMock = vi.fn();
const authGetSessionMock = vi.fn();
const limiterCheckMock = vi.fn(() => ({ success: true }));
const surfaceEnabledMock = vi.fn();

vi.mock("@/lib/ai/coach", () => ({
	getScaffold: (request: unknown) => getScaffoldMock(request),
}));

vi.mock("@/lib/auth/server", () => ({
	auth: {
		getSession: () => authGetSessionMock(),
	},
}));

vi.mock("@/lib/rate-limit", () => ({
	coachRateLimiter: {
		check: () => limiterCheckMock(),
	},
}));

vi.mock("@/lib/subscription/gates", () => ({
	isSurfaceEnabledForUser: () => surfaceEnabledMock(),
}));

describe("/api/coach", () => {
	beforeEach(() => {
		getScaffoldMock.mockReset();
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
			new NextRequest("http://localhost/api/coach", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
		);

		expect(response.status).toBe(403);
		expect(getScaffoldMock).not.toHaveBeenCalled();
	});
});

it.each(["", "K", "8", "12", "mixed", "adult"])(
	"passes learner level %s without substituting fifth grade",
	async (gradeLevel) => {
		authGetSessionMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
		surfaceEnabledMock.mockResolvedValue(true);
		limiterCheckMock.mockReturnValue({ success: true });
		getScaffoldMock.mockResolvedValue({});
		const { POST } = await import("./route");
		const response = await POST(
			new NextRequest("http://localhost/api/coach", {
				method: "POST",
				body: JSON.stringify({
					lessonTranscript: "Algebra",
					studentQuery: "Why?",
					gradeLevel,
					scaffoldGrade: 12,
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(getScaffoldMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ gradeLevel, scaffoldGrade: 12 }),
		);
	},
);
