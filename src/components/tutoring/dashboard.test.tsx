// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TutoringDashboard } from "./dashboard";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});
it.each(["distance", "homeschool"] as const)(
	"creates a %s space through an explicit mode choice",
	async (mode) => {
		const request = vi
			.fn()
			.mockImplementation(
				async (_url, options) =>
					new Response(
						JSON.stringify(
							options?.method === "POST" ? { class: { id: "space" } } : { classes: [] },
						),
					),
			);
		vi.stubGlobal("fetch", request);
		render(<TutoringDashboard mode={mode} />);
		await screen.findByText("Your next learner starts here.");
		expect(request.mock.calls[0][0]).toBe(`/api/classes?mode=${mode}`);
		fireEvent.click(screen.getByRole("button", { name: "New learning space" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Learning space name" }), {
			target: { value: "Learning together" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create learning space" }));
		await waitFor(() =>
			expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(true),
		);
		const options = request.mock.calls.find(([, options]) => options?.method === "POST")?.[1];
		expect(JSON.parse(options?.body ?? "{}")).toMatchObject({
			workspaceMode: mode,
			label: "Learning together",
			gradeLevel: "",
		});
	},
);
