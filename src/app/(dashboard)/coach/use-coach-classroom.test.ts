/* @vitest-environment jsdom */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCoachClassroom } from "./use-coach-classroom";

const options = {
	queue: [],
	confirm: vi.fn(),
	setActiveClassId: vi.fn(),
	setRightOpen: vi.fn(),
	setGroupsOpen: vi.fn(),
	setParentCommsPreselect: vi.fn(),
};
describe("teaching desk workspace isolation", () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		vi.clearAllMocks();
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});
	function mockFetch() {
		const fetcher = vi.fn(async (input: string) => {
			if (input.startsWith("/api/classes?mode=") || input === "/api/classes")
				return Response.json({ classes: [{ id: "space", label: "Learner", isArchived: false }] });
			if (input === "/api/classes/space")
				return Response.json({ activeSession: { id: "live-room", joinCode: "ABC123" } });
			if (input.endsWith("roster-overview")) return Response.json({ students: [] });
			return Response.json({ groups: [] });
		});
		vi.stubGlobal("fetch", fetcher);
		return fetcher;
	}
	it("loads distance spaces and restores their active room without ending it or altering classroom storage", async () => {
		localStorage.setItem("activeClassId", "original-class");
		localStorage.setItem("board-class-id", "original-board");
		sessionStorage.setItem("activeSessionId", "original-room");
		const fetcher = mockFetch();
		const { result } = renderHook(() =>
			useCoachClassroom({ ...options, workspaceMode: "distance" }),
		);
		await waitFor(() => expect(result.current.activeSessionId).toBe("live-room"));
		expect(fetcher).toHaveBeenCalledWith("/api/classes?mode=distance");
		expect(fetcher.mock.calls.some(([url]) => url.endsWith("/end"))).toBe(false);
		expect(localStorage.getItem("activeClassId")).toBe("original-class");
		expect(localStorage.getItem("board-class-id")).toBe("original-board");
		expect(sessionStorage.getItem("activeSessionId")).toBe("original-room");
		expect(sessionStorage.getItem("pulse:distance:activeSessionId")).toBe("live-room");
	});
	it("keeps original classroom session cleanup when a DB session was not started in this tab", async () => {
		const fetcher = mockFetch();
		const { result } = renderHook(() => useCoachClassroom(options));
		await waitFor(() =>
			expect(fetcher).toHaveBeenCalledWith("/api/sessions/live-room/end", { method: "PUT" }),
		);
		expect(fetcher).toHaveBeenCalledWith("/api/classes");
		expect(result.current.activeSessionId).toBeUndefined();
	});
	it("preserves an original classroom session that matches this tab", async () => {
		sessionStorage.setItem("activeSessionId", "live-room");
		const fetcher = mockFetch();
		const { result } = renderHook(() => useCoachClassroom(options));
		await waitFor(() => expect(result.current.activeJoinCode).toBe("ABC123"));
		expect(fetcher.mock.calls.some(([url]) => url.endsWith("/end"))).toBe(false);
	});
});
