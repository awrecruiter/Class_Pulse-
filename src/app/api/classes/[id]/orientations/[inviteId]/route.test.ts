import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	auth: vi.fn(),
	owns: vi.fn(),
	tx: vi.fn(),
	where: vi.fn(),
	lock: vi.fn(),
	set: vi.fn(),
	remove: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: m.auth } }));
vi.mock("@/lib/orientation/server", () => ({ ownsOrientationClass: m.owns }));
vi.mock("@/lib/rate-limit", () => ({ sessionRateLimiter: { check: () => ({ success: true }) } }));
vi.mock("@/lib/db", () => ({ db: { transaction: m.tx } }));

import { PATCH } from "./route";

const context = {
	params: Promise.resolve({
		id: "11111111-1111-4111-8111-111111111111",
		inviteId: "22222222-2222-4222-8222-222222222222",
	}),
};
const request = () =>
	new NextRequest("https://example.com", {
		method: "PATCH",
		body: JSON.stringify({ action: "confirm-parent", phone: "+12025550101" }),
	});
beforeEach(() => {
	vi.resetAllMocks();
	m.auth.mockResolvedValue({ data: { user: { id: "tutor" } } });
	m.owns.mockResolvedValue(true);
	m.tx.mockImplementation(async (run) =>
		run({
			select: () => ({ from: () => ({ where: m.where }) }),
			delete: () => ({ where: m.remove }),
			update: () => ({ set: m.set }),
		}),
	);
	m.where
		.mockResolvedValueOnce([{ rosterId: "student" }])
		.mockReturnValueOnce({ for: m.lock })
		.mockReturnValue({});
	m.set.mockReturnValue({ where: async () => {} });
});
it("requires an authenticated class owner", async () => {
	m.owns.mockResolvedValue(false);
	expect((await PATCH(request(), context)).status).toBe(404);
	expect(m.tx).not.toHaveBeenCalled();
});
it("rejects confirmation of a number that changed after the tutor loaded it", async () => {
	m.lock.mockResolvedValue([{ id: "contact", phone: "+12025550102" }]);
	expect((await PATCH(request(), context)).status).toBe(409);
	expect(m.set).not.toHaveBeenCalled();
});
it("records who confirmed the exact number and revokes old report tokens", async () => {
	m.lock.mockResolvedValue([{ id: "contact", phone: "+12025550101" }]);
	expect((await PATCH(request(), context)).status).toBe(200);
	expect(m.set).toHaveBeenCalledWith({
		confirmedPhone: "+12025550101",
		phoneConfirmedAt: expect.any(Date),
		phoneConfirmedBy: "tutor",
	});
	expect(m.remove).toHaveBeenCalled();
});
