// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrientationFlow } from "./orientation-flow";

const fetchMock = vi.fn();
const view = {
	classLabel: "Tutoring",
	defaultGrade: "",
	schoolOptions: ["Test Academy"],
	content: "",
	bookingUrl: "https://calendly.com/tutor/session",
	quizUrl: "https://wayground.com/join",
	meetingUrl: "",
	enrolled: false,
};
beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("family orientation flow", () => {
	it("connects parent intake, learner content, existing check-in choices, booking, Zoom and quiz", async () => {
		let enrolled = false;
		fetchMock.mockImplementation(async (_url, options) => {
			if (options?.method === "POST") {
				enrolled = true;
				return new Response('{"ok":true}');
			}
			return new Response(JSON.stringify({ ...view, enrolled }));
		});
		render(<OrientationFlow token={"a".repeat(48)} />);
		await screen.findByLabelText("Parent / guardian name");
		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
		expect(screen.queryByRole("list", { name: "Orientation steps" })).not.toBeInTheDocument();
		fireEvent.change(screen.getByLabelText("Parent / guardian name"), {
			target: { value: "Test Parent" },
		});
		fireEvent.change(screen.getByLabelText("Parent email"), {
			target: { value: "parent@example.com" },
		});
		fireEvent.change(screen.getByLabelText("Parent phone (US)"), {
			target: { value: "2025550101" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		fireEvent.change(screen.getByLabelText("Student first name"), { target: { value: "Test" } });
		fireEvent.change(screen.getByLabelText("Student last initial"), { target: { value: "S" } });
		fireEvent.change(screen.getByLabelText("School"), { target: { value: "Test Academy" } });
		expect(screen.getByLabelText(/Grade \/ level/)).toHaveValue("");
		fireEvent.change(screen.getByLabelText(/Grade \/ level/), { target: { value: "8" } });
		fireEvent.change(screen.getByLabelText("What would you like to learn or practice?"), {
			target: { value: "Algebra" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		fireEvent.click(screen.getByRole("radio", { name: /Almost/ }));
		fireEvent.click(screen.getByRole("button", { name: "Save & book time" }));
		await screen.findByText("Your orientation is saved. Choose a time with your tutor.");
		const post = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
		expect(JSON.parse(post?.[1].body)).toMatchObject({
			schoolName: "Test Academy",
			gradeLevel: "8",
			initialSignal: "almost",
			parentName: "Test Parent",
			learningContent: "Algebra",
		});
		fireEvent.click(screen.getByRole("button", { name: "Book time with your tutor" }));
		expect(screen.getByTitle("Tutor booking calendar")).toHaveAttribute("src", view.bookingUrl);
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		fireEvent.click(screen.getByRole("button", { name: "Continue to session details" }));
		expect(screen.getByText(/Use the Zoom link in your booking confirmation/)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByRole("link", { name: /Open assigned quiz/ })).toHaveAttribute(
			"href",
			view.quizUrl,
		);
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByText(/Your tutor will review the quiz/)).toBeInTheDocument();
	});
	it("shows a missing booking configuration instead of a fake calendar", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ ...view, enrolled: true, bookingUrl: "" })),
		);
		render(<OrientationFlow token={"b".repeat(48)} />);
		await screen.findByText(/Your tutor has not added a booking link/);
		expect(
			screen.queryByRole("button", { name: "Book time with your tutor" }),
		).not.toBeInTheDocument();
	});
	it("returns to parent progress from the quiz without collecting data again", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...view, enrolled: true })));
		render(<OrientationFlow token={"c".repeat(48)} resumeProgress />);
		await waitFor(() =>
			expect(screen.getByText(/Your tutor will review the quiz/)).toBeInTheDocument(),
		);
		expect(screen.queryByLabelText("Parent email")).not.toBeInTheDocument();
	});
});
