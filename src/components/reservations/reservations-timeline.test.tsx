/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReservationsTimeline } from "./reservations-timeline";

afterEach(cleanup);
it("shows the reserved learner, subject and topic on the selected day and keeps booking actions available", () => {
	const start = new Date();
	start.setHours(14, 0, 0, 0);
	const end = new Date(start.getTime() + 45 * 60000);
	const edit = vi.fn();
	const row = {
		id: "booking",
		source: "calendly",
		learnerName: "Sam",
		subject: "Science",
		topic: "Habitats",
		startsAt: start.toISOString(),
		endsAt: end.toISOString(),
		learningSpaceUrl: "/tutoring/space",
	};
	render(<ReservationsTimeline rows={[row]} onEdit={edit} />);
	expect(screen.getByRole("link", { name: "Sam" })).toHaveAttribute("href", "/tutoring/space");
	expect(screen.getByText("Science · Habitats")).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
	expect(edit).toHaveBeenCalledWith(row);
	fireEvent.click(screen.getByRole("button", { name: "Next booking day" }));
	expect(screen.queryByText("Science · Habitats")).not.toBeInTheDocument();
	expect(screen.getByText("No reservations for this day.")).toBeInTheDocument();
});
