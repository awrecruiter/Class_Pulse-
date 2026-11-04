/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
	clearSessionFromStorage,
	clearStaleSessionStorage,
	writeSessionToStorage,
} from "./use-session-lifecycle";

describe("session storage scope", () => {
	beforeEach(() => sessionStorage.clear());
	it("preserves legacy classroom keys while tutoring lifecycle changes only its own keys", () => {
		writeSessionToStorage("classroom-room");
		writeSessionToStorage("tutor-room", "distance");
		writeSessionToStorage("home-room", "homeschool");
		clearSessionFromStorage("distance");
		expect(sessionStorage.getItem("activeSessionId")).toBe("classroom-room");
		expect(sessionStorage.getItem("pulse:distance:activeSessionId")).toBeNull();
		expect(sessionStorage.getItem("pulse:homeschool:activeSessionId")).toBe("home-room");
	});
	it("day-gates only the requested workspace", () => {
		writeSessionToStorage("original");
		writeSessionToStorage("stale", "distance");
		sessionStorage.setItem("pulse:distance:activeSessionDate", "2000-01-01");
		clearStaleSessionStorage("distance");
		expect(sessionStorage.getItem("activeSessionId")).toBe("original");
		expect(sessionStorage.getItem("pulse:distance:activeSessionId")).toBeNull();
	});
});
