/* @vitest-environment jsdom */

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceQueueProvider } from "@/contexts/voice-queue";
import CoachPage from "./page";

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
	},
}));

vi.mock("@/components/coach/ambient-hud", () => ({
	AmbientHud: () => <div data-testid="ambient-hud" />,
}));
vi.mock("@/components/coach/comprehension-panel", () => ({
	ComprehensionPanel: () => <div data-testid="comprehension-panel" />,
}));
vi.mock("@/components/coach/di-panel", () => ({
	DiPanel: () => <div data-testid="di-panel" />,
}));
vi.mock("@/components/coach/groups-sidebar-panel", () => ({
	GroupsSidebarPanel: () => <div data-testid="groups-sidebar-panel" />,
}));
vi.mock("@/components/coach/lecture-visualizer", () => ({
	LectureVisualizer: () => <div data-testid="lecture-visualizer" />,
}));
vi.mock("@/components/coach/parent-comms-panel", () => ({
	ParentCommsPanel: () => <div data-testid="parent-comms-panel" />,
}));
vi.mock("@/components/coach/remediation-flow", () => ({
	RemediationFlow: () => <div data-testid="remediation-flow" />,
}));
vi.mock("@/components/coach/standard-picker", () => ({
	StandardPicker: () => <div data-testid="standard-picker" />,
}));
vi.mock("@/components/coach/waveform-meter", () => ({
	WaveformMeter: () => <div data-testid="waveform-meter" />,
}));
vi.mock("@/components/schedule/schedule-sidebar-panel", () => ({
	ScheduleSidebarPanel: () => <div data-testid="schedule-sidebar-panel" />,
}));

vi.mock("@/hooks/use-lecture-transcript", () => ({
	useLectureTranscript: () => ({
		transcript: "",
		isListening: false,
		wordCount: 0,
		isSupported: true,
		startListening: vi.fn(),
		stopListening: vi.fn(),
		clearTranscript: vi.fn(),
	}),
}));

vi.mock("@/hooks/use-mic-analyser", () => ({
	useMicAnalyser: () => Array.from({ length: 12 }, () => 0),
}));

vi.mock("@/hooks/use-mic-manager", () => ({
	useMicSlot: () => ({
		isActive: false,
		start: vi.fn(),
		stop: vi.fn(),
	}),
}));

vi.mock("@/lib/chime", () => ({
	playActivationChime: vi.fn(),
}));

function renderCoachPage() {
	return render(
		<VoiceQueueProvider>
			<CoachPage />
		</VoiceQueueProvider>,
	);
}

describe("CoachPage voice session events", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				const method = init?.method ?? "GET";

				if (url === "/api/classes" && method === "GET") {
					return new Response(
						JSON.stringify({
							classes: [{ id: "class-123", label: "Math", gradeLevel: "5", isArchived: false }],
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}

				if (url === "/api/classes/class-123" && method === "GET") {
					return new Response(JSON.stringify({ activeSession: null }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (url === "/api/classes/class-123/roster-overview" && method === "GET") {
					return new Response(JSON.stringify({ students: [] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (url === "/api/classes/class-123/groups" && method === "GET") {
					return new Response(JSON.stringify({ groups: [] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (url === "/api/sessions" && method === "POST") {
					return new Response(JSON.stringify({ session: { id: "session-456" } }), {
						status: 201,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (url === "/api/sessions/session-456/end" && method === "PUT") {
					return new Response(JSON.stringify({ session: { id: "session-456", status: "ended" } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (url === "/api/teacher-settings" && method === "GET") {
					return new Response(JSON.stringify({ settings: {} }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (url === "/api/schedule?day=4&date=2026-03-18" && method === "GET") {
					return new Response(JSON.stringify({ blocks: [] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				throw new Error(`Unexpected fetch: ${method} ${url}`);
			}),
		);
	});

	it("starts and ends the active class session from voice events", async () => {
		renderCoachPage();

		await screen.findByText("No active session");
		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/classes/class-123");
		});

		await act(async () => {
			window.dispatchEvent(new Event("voice-start_session"));
		});

		await screen.findByText("Session live");

		await act(async () => {
			window.dispatchEvent(new Event("voice-end_session"));
		});

		await screen.findByText("No active session");

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				"/api/sessions",
				expect.objectContaining({ method: "POST" }),
			);
			expect(fetch).toHaveBeenCalledWith("/api/sessions/session-456/end", { method: "PUT" });
		});
	});
});
