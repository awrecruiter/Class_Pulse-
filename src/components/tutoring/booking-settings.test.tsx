// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BookingSettings } from "./booking-settings";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});
it("saves only the booking link without overriding classroom or voice settings", async () => {
	const request = vi
		.fn()
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					settings: {
						studentBookingUrl: "https://calendly.com/tutor",
						voiceNavMode: "toast",
						masteryThreshold: 5,
					},
				}),
			),
		)
		.mockResolvedValueOnce(new Response("{}"));
	vi.stubGlobal("fetch", request);
	render(<BookingSettings />);
	await screen.findByDisplayValue("https://calendly.com/tutor");
	fireEvent.click(screen.getByRole("button", { name: "Save booking link" }));
	await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
	expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
		studentBookingUrl: "https://calendly.com/tutor",
	});
});
