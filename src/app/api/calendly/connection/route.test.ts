import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), where: vi.fn(), values: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: m.auth } }));
vi.mock("@/lib/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: m.where }) }),
		insert: () => ({ values: m.values }),
	},
}));
vi.mock("@/lib/calendly/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/calendly/client")>()),
	calendlyGet: m.get,
	sealToken: () => "encrypted-only",
}));
vi.mock("@/lib/rate-limit", () => ({ sessionRateLimiter: { check: () => ({ success: true }) } }));

import { GET, PUT } from "./route";

beforeEach(() => {
	vi.clearAllMocks();
	m.auth.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
});
it("never exposes credentials through connection status", async () => {
	m.where.mockResolvedValue([{ accountName: "Test Tutor" }]);
	const response = await GET();
	expect(await response.json()).toEqual({ connected: true, accountName: "Test Tutor" });
});
it("requires authentication before accepting a token", async () => {
	m.auth.mockResolvedValue({ data: null });
	expect(
		(await PUT(new NextRequest("https://example.com", { method: "PUT", body: "{}" }))).status,
	).toBe(401);
	expect(m.get).not.toHaveBeenCalled();
});
it("validates the account and stores only encrypted credentials under the authenticated teacher", async () => {
	m.get.mockResolvedValue({
		resource: { uri: "https://api.calendly.com/users/account-1", name: "Test Tutor" },
	});
	m.values.mockReturnValue({ onConflictDoUpdate: async () => {} });
	const response = await PUT(
		new NextRequest("https://example.com", {
			method: "PUT",
			body: JSON.stringify({ token: "a-private-token-with-read-permissions", userId: "other" }),
		}),
	);
	expect(response.status).toBe(200);
	expect(m.values).toHaveBeenCalledWith({
		userId: "teacher-1",
		tokenEncrypted: "encrypted-only",
		userUri: "https://api.calendly.com/users/account-1",
		accountName: "Test Tutor",
	});
	expect(await response.text()).not.toContain("encrypted-only");
});
