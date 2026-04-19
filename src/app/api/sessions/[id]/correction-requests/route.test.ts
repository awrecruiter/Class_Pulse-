import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetSessionMock = vi.fn();
const verifyStudentTokenMock = vi.fn();
const correctionLimiterCheckMock = vi.fn(() => ({ success: true }));
const sessionLimiterCheckMock = vi.fn(() => ({ success: true }));

const insertReturningMock = vi.fn();
const selectWhereMock = vi.fn();
const selectJoinWhereMock = vi.fn();
const updateWhereMock = vi.fn(async () => undefined);

vi.mock("@/lib/auth/server", () => ({
	auth: {
		getSession: () => authGetSessionMock(),
	},
}));

vi.mock("@/lib/auth/student", () => ({
	STUDENT_COOKIE: "student_session",
	verifyStudentToken: (token: string) => verifyStudentTokenMock(token),
}));

vi.mock("@/lib/rate-limit", () => ({
	correctionRateLimiter: {
		check: () => correctionLimiterCheckMock(),
	},
	sessionRateLimiter: {
		check: () => sessionLimiterCheckMock(),
	},
}));

vi.mock("@/lib/db", () => ({
	db: {
		insert: () => ({
			values: () => ({
				returning: () => insertReturningMock(),
			}),
		}),
		select: (shape: unknown) => ({
			from: () => ({
				where: () => selectWhereMock(shape),
				innerJoin: () => ({
					where: () => selectJoinWhereMock(shape),
				}),
			}),
		}),
		update: () => ({
			set: () => ({
				where: () => updateWhereMock(),
			}),
		}),
	},
}));

function studentRequest(body: unknown): NextRequest {
	return new NextRequest("http://localhost/api/sessions/session-1/correction-requests", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			cookie: "student_session=fake-token",
		},
		body: JSON.stringify(body),
	});
}

function teacherRequest(method: "GET" | "PATCH", body?: unknown): NextRequest {
	return new NextRequest("http://localhost/api/sessions/session-1/correction-requests", {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

describe("/api/sessions/[id]/correction-requests", () => {
	const params = Promise.resolve({ id: "session-1" });

	beforeEach(() => {
		authGetSessionMock.mockReset();
		verifyStudentTokenMock.mockReset();
		correctionLimiterCheckMock.mockReset();
		sessionLimiterCheckMock.mockReset();
		insertReturningMock.mockReset();
		selectWhereMock.mockReset();
		selectJoinWhereMock.mockReset();
		updateWhereMock.mockReset();

		correctionLimiterCheckMock.mockReturnValue({ success: true });
		sessionLimiterCheckMock.mockReturnValue({ success: true });
	});

	describe("POST (student submits)", () => {
		it("returns 429 when correctionRateLimiter fails", async () => {
			correctionLimiterCheckMock.mockReturnValue({ success: false });

			const { POST } = await import("./route");
			const res = await POST(studentRequest({ context: "" }), { params });

			expect(res.status).toBe(429);
		});

		it("returns 401 when no student session cookie", async () => {
			const { POST } = await import("./route");
			const req = new NextRequest("http://localhost/api/sessions/session-1/correction-requests", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ context: "" }),
			});

			const res = await POST(req, { params });

			expect(res.status).toBe(401);
		});

		it("returns 401 when student token is invalid", async () => {
			verifyStudentTokenMock.mockReturnValue(null);

			const { POST } = await import("./route");
			const res = await POST(studentRequest({ context: "" }), { params });

			expect(res.status).toBe(401);
		});

		it("returns 403 when student's sessionId doesn't match URL param", async () => {
			verifyStudentTokenMock.mockReturnValue({
				sessionId: "other-session",
				rosterId: "roster-1",
			});

			const { POST } = await import("./route");
			const res = await POST(studentRequest({ context: "" }), { params });

			expect(res.status).toBe(403);
		});

		it("returns 400 when context exceeds 200 chars", async () => {
			verifyStudentTokenMock.mockReturnValue({
				sessionId: "session-1",
				rosterId: "roster-1",
			});

			const { POST } = await import("./route");
			const longContext = "a".repeat(201);
			const res = await POST(studentRequest({ context: longContext }), { params });

			expect(res.status).toBe(400);
		});

		it("returns 200 with requestId when valid submission", async () => {
			verifyStudentTokenMock.mockReturnValue({
				sessionId: "session-1",
				rosterId: "roster-1",
			});
			insertReturningMock.mockResolvedValue([{ id: "req-123" }]);

			const { POST } = await import("./route");
			const res = await POST(studentRequest({ context: "stuck on step 2" }), { params });

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toEqual({ ok: true, requestId: "req-123" });
		});
	});

	describe("GET (teacher polls)", () => {
		it("returns 429 when sessionRateLimiter fails", async () => {
			sessionLimiterCheckMock.mockReturnValue({ success: false });

			const { GET } = await import("./route");
			const res = await GET(teacherRequest("GET"), { params });

			expect(res.status).toBe(429);
		});

		it("returns 401 when not authenticated as teacher", async () => {
			authGetSessionMock.mockResolvedValue({ data: null });

			const { GET } = await import("./route");
			const res = await GET(teacherRequest("GET"), { params });

			expect(res.status).toBe(401);
		});

		it("returns 404 when session not found or not owned by teacher", async () => {
			authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
			selectWhereMock.mockResolvedValueOnce([]);

			const { GET } = await import("./route");
			const res = await GET(teacherRequest("GET"), { params });

			expect(res.status).toBe(404);
		});

		it("returns 200 with empty requests array when none pending", async () => {
			authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
			selectWhereMock.mockResolvedValueOnce([{ teacherId: "teacher-1" }]);
			selectJoinWhereMock.mockResolvedValueOnce([]);

			const { GET } = await import("./route");
			const res = await GET(teacherRequest("GET"), { params });

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toEqual({ requests: [] });
		});

		it("returns 200 with pending requests list", async () => {
			authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
			selectWhereMock.mockResolvedValueOnce([{ teacherId: "teacher-1" }]);
			const pending = [
				{
					id: "req-1",
					rosterId: "roster-1",
					context: "stuck",
					status: "pending",
					createdAt: new Date("2026-04-19T10:00:00Z"),
					firstInitial: "J",
					lastInitial: "M",
				},
			];
			selectJoinWhereMock.mockResolvedValueOnce(pending);

			const { GET } = await import("./route");
			const res = await GET(teacherRequest("GET"), { params });

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.requests).toHaveLength(1);
			expect(body.requests[0].id).toBe("req-1");
			expect(body.requests[0].firstInitial).toBe("J");
		});
	});

	describe("PATCH (teacher acknowledges)", () => {
		it("returns 401 when not authenticated", async () => {
			authGetSessionMock.mockResolvedValue({ data: null });

			const { PATCH } = await import("./route");
			const res = await PATCH(
				teacherRequest("PATCH", { requestId: "11111111-1111-4111-8111-111111111111" }),
				{ params },
			);

			expect(res.status).toBe(401);
		});

		it("returns 400 when requestId is not a valid UUID", async () => {
			authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
			selectWhereMock.mockResolvedValueOnce([{ teacherId: "teacher-1" }]);

			const { PATCH } = await import("./route");
			const res = await PATCH(teacherRequest("PATCH", { requestId: "not-a-uuid" }), {
				params,
			});

			expect(res.status).toBe(400);
		});

		it("returns 200 when valid acknowledgement", async () => {
			authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
			selectWhereMock.mockResolvedValueOnce([{ teacherId: "teacher-1" }]);

			const { PATCH } = await import("./route");
			const res = await PATCH(
				teacherRequest("PATCH", { requestId: "11111111-1111-4111-8111-111111111111" }),
				{ params },
			);

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).toEqual({ ok: true });
			expect(updateWhereMock).toHaveBeenCalled();
		});
	});
});
