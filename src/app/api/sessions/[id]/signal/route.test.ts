import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limiterCheckMock = vi.fn(() => ({ success: true }));
const verifyStudentTokenMock = vi.fn();
const selectLimitMock = vi.fn();
const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
	joinRateLimiter: {
		check: () => limiterCheckMock(),
	},
}));

vi.mock("@/lib/auth/student", () => ({
	STUDENT_COOKIE: "student_session",
	verifyStudentToken: (token: string) => verifyStudentTokenMock(token),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => selectLimitMock(),
				}),
			}),
		}),
		insert: () => ({
			values: (v: unknown) => insertValuesMock(v),
		}),
		update: () => ({
			set: () => ({
				where: () => updateWhereMock(),
			}),
		}),
	},
}));

function makeRequest(body: unknown, opts: { cookie?: string } = {}) {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (opts.cookie !== undefined) {
		headers.cookie = `student_session=${opts.cookie}`;
	}
	return new NextRequest("http://localhost/api/sessions/session-1/signal", {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});
}

const params = Promise.resolve({ id: "session-1" });

describe("POST /api/sessions/[id]/signal", () => {
	beforeEach(() => {
		limiterCheckMock.mockReset();
		verifyStudentTokenMock.mockReset();
		selectLimitMock.mockReset();
		insertValuesMock.mockReset();
		updateWhereMock.mockReset();
		limiterCheckMock.mockReturnValue({ success: true });
		insertValuesMock.mockResolvedValue(undefined);
		updateWhereMock.mockResolvedValue(undefined);
	});

	it("returns 429 when rate limited", async () => {
		limiterCheckMock.mockReturnValue({ success: false });

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ signal: "got-it" }, { cookie: "tok" }), { params });

		expect(response.status).toBe(429);
		expect(verifyStudentTokenMock).not.toHaveBeenCalled();
	});

	it("returns 401 when no student cookie", async () => {
		const { POST } = await import("./route");
		const response = await POST(makeRequest({ signal: "got-it" }), { params });

		expect(response.status).toBe(401);
	});

	it("returns 401 when token is invalid", async () => {
		verifyStudentTokenMock.mockReturnValue(null);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ signal: "got-it" }, { cookie: "bad-token" }), {
			params,
		});

		expect(response.status).toBe(401);
		expect(verifyStudentTokenMock).toHaveBeenCalledWith("bad-token");
	});

	it("returns 403 when sessionId in token doesn't match URL param", async () => {
		verifyStudentTokenMock.mockReturnValue({
			sessionId: "other-session",
			rosterId: "roster-1",
		});

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ signal: "got-it" }, { cookie: "tok" }), { params });

		expect(response.status).toBe(403);
	});

	it("returns 400 when signal value is invalid", async () => {
		verifyStudentTokenMock.mockReturnValue({
			sessionId: "session-1",
			rosterId: "roster-1",
		});

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ signal: "bogus" }, { cookie: "tok" }), { params });

		expect(response.status).toBe(400);
		expect(insertValuesMock).not.toHaveBeenCalled();
		expect(updateWhereMock).not.toHaveBeenCalled();
	});

	it("returns 200 and inserts signal when valid (got-it)", async () => {
		verifyStudentTokenMock.mockReturnValue({
			sessionId: "session-1",
			rosterId: "roster-1",
		});
		selectLimitMock.mockResolvedValue([]);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ signal: "got-it" }, { cookie: "tok" }), { params });

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json).toEqual({ ok: true, signal: "got-it" });
		expect(insertValuesMock).toHaveBeenCalledOnce();
		const inserted = insertValuesMock.mock.calls[0][0] as {
			sessionId: string;
			rosterId: string;
			signal: string;
			lostSince: Date | null;
		};
		expect(inserted.sessionId).toBe("session-1");
		expect(inserted.rosterId).toBe("roster-1");
		expect(inserted.signal).toBe("got-it");
		expect(inserted.lostSince).toBeNull();
	});

	it("accepts 'almost' signal and inserts", async () => {
		verifyStudentTokenMock.mockReturnValue({
			sessionId: "session-1",
			rosterId: "roster-1",
		});
		selectLimitMock.mockResolvedValue([]);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ signal: "almost" }, { cookie: "tok" }), { params });

		expect(response.status).toBe(200);
		expect(insertValuesMock).toHaveBeenCalledOnce();
		expect((insertValuesMock.mock.calls[0][0] as { signal: string }).signal).toBe("almost");
	});

	it("accepts 'lost' signal and sets lostSince", async () => {
		verifyStudentTokenMock.mockReturnValue({
			sessionId: "session-1",
			rosterId: "roster-1",
		});
		selectLimitMock.mockResolvedValue([]);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ signal: "lost" }, { cookie: "tok" }), { params });

		expect(response.status).toBe(200);
		expect(insertValuesMock).toHaveBeenCalledOnce();
		const inserted = insertValuesMock.mock.calls[0][0] as {
			signal: string;
			lostSince: Date | null;
		};
		expect(inserted.signal).toBe("lost");
		expect(inserted.lostSince).toBeInstanceOf(Date);
	});
});
