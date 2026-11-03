// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuizRoom } from "./quiz-room";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});
it("opens a quiz room only on request and closes through the existing session contract", async () => {
	const request = vi
		.fn()
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ session: { id: "session", joinCode: "ABC234" } })),
		)
		.mockResolvedValueOnce(new Response("{}"));
	vi.stubGlobal("fetch", request);
	render(<QuizRoom classId="space" initialSession={null} />);
	expect(request).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Open quiz room" }));
	await screen.findByText("ABC234");
	expect(request.mock.calls[0][1].method).toBe("POST");
	fireEvent.click(screen.getByRole("button", { name: "Close quiz room" }));
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Open quiz room" })).toBeInTheDocument(),
	);
	expect(request.mock.calls[1][0]).toBe("/api/sessions/session/end");
	expect(request.mock.calls[1][1].method).toBe("PUT");
});
