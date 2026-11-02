import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	session: vi.fn(),
	values: vi.fn(),
	conflict: vi.fn(),
	rate: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: mocks.session } }));
vi.mock("@/lib/rate-limit", () => ({ sessionRateLimiter: { check: mocks.rate } }));
vi.mock("@/lib/db", () => ({ db: { insert: () => ({ values: mocks.values }) } }));

import { PUT } from "./route";

function request(body: unknown) {
	return new NextRequest("http://localhost/api/teacher-settings", {
		method: "PUT",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

describe("booking setting updates", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.rate.mockReturnValue({ success: true });
		mocks.session.mockResolvedValue({ data: { user: { id: "tutor-1" } } });
		mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.conflict });
		mocks.conflict.mockReturnValue({ returning: async () => [{}] });
	});
	it("requires authentication", async () => {
		mocks.session.mockResolvedValue({ data: null });
		expect((await PUT(request({ studentBookingUrl: "" }))).status).toBe(401);
		expect(mocks.values).not.toHaveBeenCalled();
	});
	it("rejects unsupported URLs before writing", async () => {
		expect((await PUT(request({ studentBookingUrl: "https://other.test/calendar" }))).status).toBe(
			400,
		);
		expect(mocks.values).not.toHaveBeenCalled();
	});
	it.each(["https://calendly.com/tutor/math", ""])(
		"saves or clears booking for the authenticated tutor only: %s",
		async (studentBookingUrl) => {
			expect((await PUT(request({ studentBookingUrl, userId: "other-tutor" }))).status).toBe(200);
			expect(mocks.values).toHaveBeenCalledWith({ userId: "tutor-1", studentBookingUrl });
			expect(mocks.conflict.mock.calls[0][0].set).toEqual({
				studentBookingUrl,
				updatedAt: expect.any(Date),
			});
		},
	);
	it("does not clear booking or change other preferences when omitted", async () => {
		const settings = {
			masteryThreshold: 5,
			voiceNavMode: "toast",
			voiceAppOpenMode: "confirm",
			scheduleDocOpenMode: "new-tab",
		};
		expect((await PUT(request(settings))).status).toBe(200);
		expect(mocks.conflict.mock.calls[0][0].set).toEqual({
			...settings,
			updatedAt: expect.any(Date),
		});
	});
});
