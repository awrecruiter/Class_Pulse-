// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
vi.mock("@/components/coach/manipulatives/student", () => ({ StudentManipulative: () => null }));
vi.mock("@/components/coach/manipulatives/student/correction-request", () => ({
	CorrectionRequest: () => null,
}));
vi.mock("@/components/coach/manipulatives/student/student-store", () => ({
	StudentStore: () => null,
}));

import { StudentSession } from "./student-session";

let feed: { onmessage?: (event: { data: string }) => void };
const props = {
	sessionId: "session-1",
	displayName: "A.B.",
	classLabel: "Tutoring",
	isActive: true,
	studentId: "123",
	initialSignal: null,
	ramBalance: 0,
	groupBalance: null,
	groupName: null,
	joinCode: "ABC123",
	todayAssignment: null,
	currencyName: "RAM Bucks",
	currencyEmoji: "🐏",
	studentBookingUrl: "https://calendly.com/tutor/math",
};

beforeEach(() => {
	vi.stubGlobal(
		"EventSource",
		class {
			onmessage?: (event: { data: string }) => void;
			constructor() {
				feed = this;
			}
			close() {}
		},
	);
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("booking in the quiz portal", () => {
	it("preserves an answered quiz when booking opens and closes", () => {
		render(<StudentSession {...props} />);
		act(() =>
			feed.onmessage?.({
				data: JSON.stringify({
					type: "question-push",
					pushId: "q-1",
					question: {
						stem: "What is 1 + 1?",
						choices: ["A. 2", "B. 3"],
						answer: "A",
						questionType: "mc",
						standardCode: null,
					},
				}),
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "A. 2" }));
		expect(screen.getByRole("button", { name: /A\. 2/ })).toBeDisabled();
		fireEvent.click(screen.getByRole("button", { name: "Book time with your tutor" }));
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(screen.getByText("What is 1 + 1?")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /A\. 2/ })).toBeDisabled();
	});

	it("keeps booking available after the live session ends", () => {
		render(<StudentSession {...props} />);
		act(() => feed.onmessage?.({ data: JSON.stringify({ type: "session-ended" }) }));
		expect(screen.getByText("Class is over!")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Book time with your tutor" }));
		expect(screen.getByTitle("Tutor booking calendar")).toHaveAttribute(
			"src",
			props.studentBookingUrl,
		);
	});

	it("leaves booking hidden for tutors who have not enabled it", () => {
		render(<StudentSession {...props} studentBookingUrl="" />);
		expect(
			screen.queryByRole("button", { name: "Book time with your tutor" }),
		).not.toBeInTheDocument();
	});
});

describe("lecture audio status", () => {
	it("does not call an open session a live lecture", () => {
		render(<StudentSession {...props} />);
		expect(screen.getByText("Waiting for tutor audio")).toBeInTheDocument();
		expect(screen.queryByText("Teacher is live")).not.toBeInTheDocument();
	});
	it("returns to idle on silence and after a disconnected audio feed", () => {
		vi.useFakeTimers();
		render(<StudentSession {...props} />);
		const noise = (level: number) =>
			act(() => feed.onmessage?.({ data: JSON.stringify({ type: "noise", level }) }));
		noise(40);
		expect(screen.getByText("Receiving tutor audio")).toBeInTheDocument();
		noise(0);
		expect(screen.getByText("Waiting for tutor audio")).toBeInTheDocument();
		noise(30);
		act(() => vi.advanceTimersByTime(2001));
		expect(screen.getByText("Waiting for tutor audio")).toBeInTheDocument();
	});
});
