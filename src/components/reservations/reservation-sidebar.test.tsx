// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReservationSidebar } from "./reservation-sidebar";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});
it("shows learner, subject and topic, and clearly labels demo reservations", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					connected: false,
					reservations: [
						{
							id: "demo",
							source: "demo",
							learnerName: "Demo learner",
							subject: "Math",
							topic: "Ratios",
							startsAt: "2026-12-01T10:00:00Z",
							endsAt: "2026-12-01T10:30:00Z",
						},
					],
				}),
			),
		),
	);
	render(<ReservationSidebar />);
	await screen.findByText("Demo learner");
	expect(screen.getByText("Math")).toBeInTheDocument();
	expect(screen.getByText("Ratios")).toBeInTheDocument();
	expect(screen.getByText("Demo reservation")).toBeInTheDocument();
	expect(screen.getByRole("link", { name: "Connect Calendly" })).toBeInTheDocument();
});

it("does not claim an empty schedule when Calendly denied reservation access", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(
			Response.json({
				connected: true,
				reservations: [],
				error: "Your Calendly token is missing scheduled_events:read permission.",
			}),
		),
	);
	render(<ReservationSidebar />);
	await screen.findByText(/missing scheduled_events:read/);
	expect(screen.getByText("Reservation status is unavailable.")).toBeInTheDocument();
	expect(screen.queryByText("No upcoming reservations to display.")).not.toBeInTheDocument();
	expect(screen.getByRole("link", { name: "Update Calendly connection" })).toHaveAttribute(
		"href",
		"/tutoring/settings#calendly-connection",
	);
});
