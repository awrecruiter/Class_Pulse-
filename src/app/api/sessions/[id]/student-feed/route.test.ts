import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyStudentTokenMock = vi.fn();
const getNoiseLevelMock = vi.fn((_sessionId: string) => 0);
const selectWhereMock = vi.fn();

vi.mock("@/lib/auth/student", () => ({
	STUDENT_COOKIE: "student_session",
	verifyStudentToken: (token: string) => verifyStudentTokenMock(token),
}));

vi.mock("@/lib/noise-store", () => ({
	getNoiseLevel: (sessionId: string) => getNoiseLevelMock(sessionId),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => selectWhereMock(),
				orderBy: () => ({
					limit: () => selectWhereMock(),
				}),
			}),
		}),
	},
}));

function makeRequest(options: { withCookie?: boolean } = {}): NextRequest {
	const headers: Record<string, string> = {};
	if (options.withCookie !== false) {
		headers.cookie = "student_session=fake-token";
	}
	return new NextRequest("http://localhost/api/sessions/session-1/student-feed", {
		method: "GET",
		headers,
	});
}

describe("/api/sessions/[id]/student-feed", () => {
	const params = Promise.resolve({ id: "session-1" });

	beforeEach(() => {
		verifyStudentTokenMock.mockReset();
		getNoiseLevelMock.mockReset();
		selectWhereMock.mockReset();
		getNoiseLevelMock.mockReturnValue(0);
	});

	it("returns 401 when no STUDENT_COOKIE header", async () => {
		const { GET } = await import("./route");
		const res = await GET(makeRequest({ withCookie: false }), { params });

		expect(res.status).toBe(401);
	});

	it("returns 401 when token is invalid", async () => {
		verifyStudentTokenMock.mockReturnValue(null);

		const { GET } = await import("./route");
		const res = await GET(makeRequest(), { params });

		expect(res.status).toBe(401);
	});

	it("returns 403 when token sessionId doesn't match URL param", async () => {
		verifyStudentTokenMock.mockReturnValue({
			sessionId: "other-session",
			rosterId: "roster-1",
		});

		const { GET } = await import("./route");
		const res = await GET(makeRequest(), { params });

		expect(res.status).toBe(403);
	});

	it("returns 404 when session not found in DB", async () => {
		verifyStudentTokenMock.mockReturnValue({
			sessionId: "session-1",
			rosterId: "roster-1",
		});
		selectWhereMock.mockResolvedValueOnce([]);

		const { GET } = await import("./route");
		const res = await GET(makeRequest(), { params });

		expect(res.status).toBe(404);
	});

	it("returns a streaming Response with SSE headers when valid", async () => {
		verifyStudentTokenMock.mockReturnValue({
			sessionId: "session-1",
			rosterId: "roster-1",
		});
		// First select: session lookup (truthy)
		selectWhereMock.mockResolvedValueOnce([{ id: "session-1" }]);
		// Subsequent select (inside sendLatestPush) returns no pushes
		selectWhereMock.mockResolvedValue([]);

		const { GET } = await import("./route");
		const res = await GET(makeRequest(), { params });

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");
		expect(res.headers.get("Cache-Control")).toBe("no-cache");
		expect(res.body).toBeInstanceOf(ReadableStream);

		await res.body?.cancel();
	});
});
