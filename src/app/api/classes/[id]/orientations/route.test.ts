import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), owns: vi.fn(), values: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: mocks.session } }));
vi.mock("@/lib/orientation/server", () => ({ ownsOrientationClass: mocks.owns }));
vi.mock("@/lib/rate-limit", () => ({ sessionRateLimiter: { check: () => ({ success: true }) } }));
vi.mock("@/lib/db", () => ({ db: { insert: () => ({ values: mocks.values }) } }));

import { GET, POST } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id }) };
function request(body: unknown = {}) {
	return new NextRequest(`https://example.com/api/classes/${id}/orientations`, {
		method: "POST",
		body: JSON.stringify(body),
	});
}
describe("tutor orientation ownership", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.session.mockResolvedValue({ data: { user: { id: "tutor-1" } } });
		mocks.owns.mockResolvedValue(true);
		mocks.values.mockReturnValue({ returning: async () => [{ id: "invite-1" }] });
	});
	it("requires teacher authentication for listing and creating private invites", async () => {
		mocks.session.mockResolvedValue({ data: null });
		expect((await GET(request(), context)).status).toBe(401);
		expect((await POST(request(), context)).status).toBe(401);
	});
	it("rejects a different teacher's class", async () => {
		mocks.owns.mockResolvedValue(false);
		expect((await POST(request(), context)).status).toBe(404);
		expect(mocks.values).not.toHaveBeenCalled();
	});
	it("creates a fresh expiring token scoped to the authorized class", async () => {
		expect(
			(
				await POST(
					request({ classId: "other-class", quizUrl: "https://wayground.com/join" }),
					context,
				)
			).status,
		).toBe(201);
		const saved = mocks.values.mock.calls[0][0];
		expect(saved.classId).toBe(id);
		expect(saved.token).toMatch(/^[a-f0-9]{48}$/);
		expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
	});
});
