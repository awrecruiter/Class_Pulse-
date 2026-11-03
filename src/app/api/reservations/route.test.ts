import { PgDialect } from "drizzle-orm/pg-core";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), where: vi.fn(), values: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: m.auth } }));
vi.mock("@/lib/calendly/client", () => ({
	openToken: () => "decrypted",
	readReservations: m.read,
}));
vi.mock("@/lib/rate-limit", () => ({ sessionRateLimiter: { check: () => ({ success: true }) } }));
vi.mock("@/lib/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: m.where }) }),
		insert: () => ({ values: m.values }),
	},
}));

import { GET, POST } from "./route";

const body = {
	learnerName: "Demo",
	subject: "Math",
	topic: "Ratios",
	startsAt: "2026-12-01T10:00:00Z",
	endsAt: "2026-12-01T10:30:00Z",
};
const request = (data: unknown) =>
	new NextRequest("https://example.com/api/reservations", {
		method: "POST",
		body: JSON.stringify(data),
	});
beforeEach(() => {
	vi.clearAllMocks();
	m.auth.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
});
it("requires authentication for reservations", async () => {
	m.auth.mockResolvedValue({ data: null });
	expect((await GET()).status).toBe(401);
	expect((await POST(request(body))).status).toBe(401);
	expect(m.where).not.toHaveBeenCalled();
});
it("scopes schedule reads to the authenticated teacher", async () => {
	m.where.mockReturnValueOnce({ orderBy: async () => [] }).mockResolvedValueOnce([]);
	expect((await GET()).status).toBe(200);
	const query = new PgDialect().sqlToQuery(m.where.mock.calls[0][0]);
	expect(query.params[0]).toBe("teacher-1");
	expect(m.read).not.toHaveBeenCalled();
});
it("does not trust a supplied teacher identity when adding a reservation", async () => {
	expect((await POST(request({ ...body, teacherId: "other" }))).status).toBe(201);
	expect(m.values).toHaveBeenCalledWith(
		expect.objectContaining({ teacherId: "teacher-1", learnerName: "Demo" }),
	);
});
it("rejects backwards reservation times before writing", async () => {
	expect((await POST(request({ ...body, endsAt: "2026-12-01T09:00:00Z" }))).status).toBe(400);
	expect(m.values).not.toHaveBeenCalled();
});
