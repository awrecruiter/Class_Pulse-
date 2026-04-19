import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetSessionMock = vi.fn();
const limiterCheckMock = vi.fn(() => ({ success: true }));
const setNoiseLevelMock = vi.fn();
const selectWhereMock = vi.fn();
const insertValuesMock = vi.fn();

vi.mock("@/lib/auth/server", () => ({
	auth: {
		getSession: () => authGetSessionMock(),
	},
}));

vi.mock("@/lib/rate-limit", () => ({
	ambientScanLimiter: {
		check: () => limiterCheckMock(),
	},
}));

vi.mock("@/lib/noise-store", () => ({
	setNoiseLevel: (...args: unknown[]) => setNoiseLevelMock(...args),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => selectWhereMock(),
			}),
		}),
		insert: () => ({
			values: (v: unknown) => insertValuesMock(v),
		}),
	},
}));

function makeRequest(body: unknown) {
	return new NextRequest("http://localhost/api/sessions/session-1/noise", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

const params = Promise.resolve({ id: "session-1" });

describe("POST /api/sessions/[id]/noise", () => {
	beforeEach(() => {
		authGetSessionMock.mockReset();
		limiterCheckMock.mockReset();
		setNoiseLevelMock.mockReset();
		selectWhereMock.mockReset();
		insertValuesMock.mockReset();
		limiterCheckMock.mockReturnValue({ success: true });
		insertValuesMock.mockResolvedValue(undefined);
	});

	it("returns 429 when rate limiter fails", async () => {
		limiterCheckMock.mockReturnValue({ success: false });

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ level: 30 }), { params });

		expect(response.status).toBe(429);
		expect(authGetSessionMock).not.toHaveBeenCalled();
	});

	it("returns 401 when not authenticated", async () => {
		authGetSessionMock.mockResolvedValue({ data: null });

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ level: 30 }), { params });

		expect(response.status).toBe(401);
	});

	it("returns 404 when session not found", async () => {
		authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
		selectWhereMock.mockResolvedValue([]);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ level: 30 }), { params });

		expect(response.status).toBe(404);
		expect(setNoiseLevelMock).not.toHaveBeenCalled();
	});

	it("returns 404 when session is owned by a different teacher", async () => {
		authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
		selectWhereMock.mockResolvedValue([{ teacherId: "teacher-2" }]);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ level: 30 }), { params });

		expect(response.status).toBe(404);
		expect(setNoiseLevelMock).not.toHaveBeenCalled();
	});

	it("returns 400 when level is out of range", async () => {
		authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
		selectWhereMock.mockResolvedValue([{ teacherId: "teacher-1" }]);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ level: 150 }), { params });

		expect(response.status).toBe(400);
		expect(setNoiseLevelMock).not.toHaveBeenCalled();
	});

	it("returns 200 and calls setNoiseLevel when level is valid", async () => {
		authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
		selectWhereMock.mockResolvedValue([{ teacherId: "teacher-1" }]);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ level: 40 }), { params });

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json).toEqual({ ok: true, level: 40 });
		expect(setNoiseLevelMock).toHaveBeenCalledWith("session-1", 40);
		expect(insertValuesMock).not.toHaveBeenCalled();
	});

	it("inserts ambientAlert when level >= 75", async () => {
		authGetSessionMock.mockResolvedValue({ data: { user: { id: "teacher-1" } } });
		selectWhereMock.mockResolvedValue([{ teacherId: "teacher-1" }]);

		const { POST } = await import("./route");
		const response = await POST(makeRequest({ level: 85 }), { params });

		expect(response.status).toBe(200);
		expect(setNoiseLevelMock).toHaveBeenCalledWith("session-1", 85);
		expect(insertValuesMock).toHaveBeenCalledOnce();
		const inserted = insertValuesMock.mock.calls[0][0] as {
			sessionId: string;
			alertType: string;
			severity: string;
			details: string;
		};
		expect(inserted.sessionId).toBe("session-1");
		expect(inserted.alertType).toBe("noise");
		expect(inserted.severity).toBe("high");
		expect(inserted.details).toContain("85");
	});
});
