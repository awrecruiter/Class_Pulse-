// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StudentBooking } from "./student-booking";

afterEach(cleanup);

describe("student booking", () => {
	it.each(["", "https://example.com/book", "javascript:alert(1)"])(
		"hides booking for missing or invalid configuration: %s",
		(bookingUrl) => {
			const { container } = render(<StudentBooking bookingUrl={bookingUrl} />);
			expect(container).toBeEmptyDOMElement();
		},
	);

	it("loads the configured calendar only on request and lets students return to their quiz", () => {
		const url = "https://calendly.com/tutor/math";
		render(<StudentBooking bookingUrl={url} />);
		expect(screen.queryByTitle("Tutor booking calendar")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Book time with your tutor" }));
		expect(screen.getByTitle("Tutor booking calendar")).toHaveAttribute("src", url);
		expect(screen.getByTitle("Tutor booking calendar")).toHaveAttribute(
			"referrerpolicy",
			"no-referrer",
		);
		expect(screen.getByRole("link", { name: "Open Calendly in a new tab" })).toHaveAttribute(
			"href",
			url,
		);
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(screen.queryByTitle("Tutor booking calendar")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Book time with your tutor" })).toBeInTheDocument();
	});
});
