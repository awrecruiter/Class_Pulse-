/* @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceQueueProvider } from "@/contexts/voice-queue";
import { ParentCommsPanel } from "./parent-comms-panel";

const micStartMock = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
	toast: {
		error: (...args: unknown[]) => toastError(...args),
		success: vi.fn(),
	},
}));

vi.mock("@/hooks/use-mic-manager", () => ({
	useMicSlot: () => ({
		isActive: false,
		start: micStartMock,
		stop: vi.fn(),
	}),
}));

vi.mock("@/lib/chime", () => ({
	playQueueChime: vi.fn(),
}));

describe("ParentCommsPanel voice actions", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		localStorage.clear();
		micStartMock.mockReset();
		toastError.mockReset();
		fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? "GET";
			if (url === "/api/classes/class-123/parent-contacts" && method === "GET") {
				return new Response(JSON.stringify({ contacts: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (url.startsWith("/api/classes/class-123/parent-message?rosterId=") && method === "GET") {
				return new Response(JSON.stringify({ messages: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (url === "/api/classes/class-123/parent-message" && method === "POST") {
				return new Response(JSON.stringify({ smsSent: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			throw new Error(`Unexpected fetch: ${method} ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
	});

	it("prefills the draft from a voice draft event", async () => {
		render(
			<VoiceQueueProvider>
				<ParentCommsPanel
					classId="class-123"
					students={[
						{
							rosterId: "roster-1",
							displayName: "Marcus",
							firstInitial: "M",
							lastInitial: "J",
						},
					]}
				/>
			</VoiceQueueProvider>,
		);

		await screen.findByText("MJ");

		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("voice-draft_parent_message", {
					detail: { studentName: "Marcus", messageText: "Please call me back." },
				}),
			);
		});

		await waitFor(() => {
			expect(screen.getByDisplayValue("Please call me back.")).toBeInTheDocument();
		});
	});

	it("sends a parent message from a voice send event", async () => {
		render(
			<VoiceQueueProvider>
				<ParentCommsPanel
					classId="class-123"
					students={[
						{
							rosterId: "roster-1",
							displayName: "Marcus",
							firstInitial: "M",
							lastInitial: "J",
						},
					]}
				/>
			</VoiceQueueProvider>,
		);

		await screen.findByText("MJ");

		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("voice-send_parent_message", {
					detail: { studentName: "Marcus", messageText: "Marcus had a strong day today." },
				}),
			);
		});

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith("/api/classes/class-123/parent-message", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rosterId: "roster-1",
					body: "Marcus had a strong day today.",
					triggeredBy: "manual",
				}),
			});
		});
	});

	it("blocks dictation when global voice only mode is enabled", async () => {
		localStorage.setItem("voice.globalVoiceOnlyMode", "true");

		render(
			<VoiceQueueProvider>
				<ParentCommsPanel
					classId="class-123"
					students={[
						{
							rosterId: "roster-1",
							displayName: "Marcus",
							firstInitial: "M",
							lastInitial: "J",
						},
					]}
				/>
			</VoiceQueueProvider>,
		);

		await screen.findByText("MJ");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "MJ" }));
		});
		const dictateButton = screen.getByTitle("Dictate message");
		await waitFor(() => {
			expect(dictateButton).not.toBeDisabled();
		});
		await act(async () => {
			fireEvent.click(dictateButton);
		});

		expect(micStartMock).not.toHaveBeenCalled();
		expect(toastError).toHaveBeenCalledWith(
			"Global voice only mode is on — turn it off to dictate a message",
		);
	});
});
