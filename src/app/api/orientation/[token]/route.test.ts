import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	lookup: vi.fn(),
	where: vi.fn(),
	lock: vi.fn(),
	values: vi.fn(),
	set: vi.fn(),
	transaction: vi.fn(),
	sign: vi.fn(),
	rate: vi.fn(),
}));
vi.mock("@/lib/orientation/server", () => ({ findOrientation: mocks.lookup }));
vi.mock("@/lib/auth/student", () => ({
	STUDENT_COOKIE: "student_session",
	signStudentToken: mocks.sign,
}));
vi.mock("@/lib/rate-limit", () => ({ joinRateLimiter: { check: mocks.rate } }));
vi.mock("@/lib/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: mocks.where }) }),
		transaction: mocks.transaction,
	},
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ token: "a".repeat(48) }) };
const intake = {
	parentName: "Test Parent",
	parentEmail: "parent@example.com",
	phone: "2025550101",
	studentFirstName: "Test",
	studentLastInitial: "S",
	gradeLevel: "8",
	learningContent: "Algebra",
	initialSignal: "almost",
	guardianConfirmed: true,
};
function request(body?: unknown) {
	return new NextRequest(
		`https://example.com/api/orientation/${"a".repeat(48)}`,
		body ? { method: "POST", body: JSON.stringify(body) } : undefined,
	);
}
function row(rosterId: string | null = null) {
	return {
		classroom: { id: "class-1", teacherId: "teacher-1", label: "Tutoring", gradeLevel: "" },
		invite: {
			id: "invite-1",
			classId: "class-1",
			rosterId,
			parentEmail: "private@example.com",
			initialSignal: "lost",
			content: "Algebra",
			quizUrl: "https://example.com/quiz",
			meetingUrl: "https://zoom.us/j/123",
		},
	};
}

describe("private orientation API", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.rate.mockReturnValue({ success: true });
		mocks.lookup.mockResolvedValue(row());
		mocks.transaction.mockImplementation(async (run) =>
			run({
				select: () => ({ from: () => ({ where: () => ({ for: mocks.lock }) }) }),
				insert: () => ({ values: mocks.values }),
				update: () => ({ set: mocks.set }),
			}),
		);
		mocks.sign.mockReturnValue("signed-student-token");
	});
	it("rejects an unavailable or expired invitation", async () => {
		mocks.lookup.mockResolvedValue(null);
		expect((await GET(request(), context)).status).toBe(404);
		expect((await POST(request(intake), context)).status).toBe(404);
		expect(mocks.transaction).not.toHaveBeenCalled();
	});
	it("never returns parent contact details or student identifiers from the public GET", async () => {
		mocks.lookup.mockResolvedValue(row("student-1"));
		mocks.where.mockResolvedValue([{ bookingUrl: "https://calendly.com/tutor" }]);
		const response = await GET(request(), context);
		const data = await response.json();
		expect(data).toEqual({
			classLabel: "Tutoring",
			defaultGrade: "",
			content: "Algebra",
			bookingUrl: "https://calendly.com/tutor",
			quizUrl: "https://example.com/quiz",
			meetingUrl: "https://zoom.us/j/123",
			enrolled: true,
		});
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
	it("validates intake before writing", async () => {
		expect((await POST(request({ ...intake, guardianConfirmed: false }), context)).status).toBe(
			400,
		);
		expect(mocks.transaction).not.toHaveBeenCalled();
	});
	it("creates linked learner and parent records in one transaction", async () => {
		mocks.lock.mockResolvedValue([row().invite]);
		mocks.values.mockReturnValue({ returning: async () => [{ id: "student-1" }] });
		mocks.set.mockReturnValue({ where: async () => undefined });
		expect(
			(
				await POST(
					request({ ...intake, classId: "other-class", rosterId: "other-student" }),
					context,
				)
			).status,
		).toBe(200);
		expect(mocks.values.mock.calls[0][0]).toMatchObject({
			classId: "class-1",
			firstName: "Test",
			firstInitial: "T",
			lastInitial: "S",
		});
		expect(mocks.values.mock.calls[1][0]).toMatchObject({
			classId: "class-1",
			rosterId: "student-1",
			phone: "+12025550101",
		});
		expect(mocks.set).toHaveBeenCalledWith(
			expect.objectContaining({ rosterId: "student-1", gradeLevel: "8", initialSignal: "almost" }),
		);
	});
	it("does not duplicate enrollment or overwrite details on a retry", async () => {
		mocks.lock.mockResolvedValue([row("student-1").invite]);
		expect((await POST(request(intake), context)).status).toBe(200);
		expect(mocks.values).not.toHaveBeenCalled();
		expect(mocks.set).not.toHaveBeenCalled();
	});
	it("does not open a quiz before enrollment", async () => {
		expect((await POST(request({ action: "join" }), context)).status).toBe(409);
		expect(mocks.sign).not.toHaveBeenCalled();
	});
	it("does not start a lecture or issue a session cookie when the tutor has not opened a class", async () => {
		mocks.lookup.mockResolvedValue(row("student-1"));
		mocks.where.mockResolvedValueOnce([{ id: "student-1" }]).mockResolvedValueOnce([]);
		expect((await POST(request({ action: "join" }), context)).status).toBe(409);
		expect(mocks.sign).not.toHaveBeenCalled();
	});
	it("joins the existing session using the invitation's learner and preserves subsequent check-ins", async () => {
		mocks.lookup.mockResolvedValue(row("student-1"));
		mocks.where
			.mockResolvedValueOnce([{ id: "student-1" }])
			.mockResolvedValueOnce([{ id: "session-1" }]);
		mocks.set.mockReturnValue({ where: () => ({ returning: async () => [] }) });
		const response = await POST(request({ action: "join", rosterId: "other-student" }), context);
		expect(response.status).toBe(200);
		expect(mocks.sign).toHaveBeenCalledWith({ sessionId: "session-1", rosterId: "student-1" });
		expect(response.cookies.get("student_session")?.value).toBe("signed-student-token");
		expect(mocks.values).not.toHaveBeenCalled();
	});
});
