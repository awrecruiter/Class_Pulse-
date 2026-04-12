/* @vitest-environment jsdom */

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClassesPage from "./page";

const pushMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
	toast: {
		success: (...args: unknown[]) => toastSuccess(...args),
		error: (...args: unknown[]) => toastError(...args),
	},
}));

describe("ClassesPage voice events", () => {
	beforeEach(() => {
		pushMock.mockReset();
		toastSuccess.mockReset();
		toastError.mockReset();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				const method = init?.method ?? "GET";
				if (url === "/api/classes" && method === "GET") {
					return new Response(
						JSON.stringify({
							classes: [
								{
									id: "class-123",
									label: "Period 3 Math",
									periodTime: "",
									gradeLevel: "5",
									subject: "Math",
									isArchived: false,
									studentCount: 0,
									createdAt: "2026-03-18T00:00:00.000Z",
								},
							],
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				if (url === "/api/classes" && method === "POST") {
					return new Response(JSON.stringify({ class: { id: "class-999" } }), {
						status: 201,
						headers: { "Content-Type": "application/json" },
					});
				}
				throw new Error(`Unexpected fetch: ${method} ${url}`);
			}),
		);
	});

	it("opens a matching class from a voice event", async () => {
		render(<ClassesPage />);
		await screen.findByText("Period 3 Math");

		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("voice-open_class", { detail: { className: "period 3 math" } }),
			);
		});

		await waitFor(() => {
			expect(pushMock).toHaveBeenCalledWith("/classes/class-123");
		});
	});

	it("creates a class from a voice event", async () => {
		render(<ClassesPage />);
		await screen.findByText("Period 3 Math");

		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("voice-create_class", { detail: { label: "Period 4 Math" } }),
			);
		});

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				"/api/classes",
				expect.objectContaining({ method: "POST" }),
			);
			expect(toastSuccess).toHaveBeenCalled();
		});
	});
});
