import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("noise-store", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useRealTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("getNoiseLevel returns 0 for unknown sessionId", async () => {
		const { getNoiseLevel } = await import("../noise-store");
		expect(getNoiseLevel("unknown-session")).toBe(0);
	});

	it("setNoiseLevel then getNoiseLevel returns the stored level", async () => {
		const { setNoiseLevel, getNoiseLevel } = await import("../noise-store");
		setNoiseLevel("session-1", 42);
		expect(getNoiseLevel("session-1")).toBe(42);
	});

	it("getNoiseLevel returns 0 after TTL expires", async () => {
		const baseTime = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(baseTime);

		const { setNoiseLevel, getNoiseLevel } = await import("../noise-store");
		setNoiseLevel("session-ttl", 55);
		expect(getNoiseLevel("session-ttl")).toBe(55);

		// Advance 31 seconds past the 30s TTL
		vi.setSystemTime(baseTime + 31_000);
		expect(getNoiseLevel("session-ttl")).toBe(0);
	});

	it("clearNoiseLevel removes the entry so subsequent getNoiseLevel returns 0", async () => {
		const { setNoiseLevel, getNoiseLevel, clearNoiseLevel } = await import("../noise-store");
		setNoiseLevel("session-clear", 77);
		expect(getNoiseLevel("session-clear")).toBe(77);
		clearNoiseLevel("session-clear");
		expect(getNoiseLevel("session-clear")).toBe(0);
	});

	it("two sessions are independent", async () => {
		const { setNoiseLevel, getNoiseLevel, clearNoiseLevel } = await import("../noise-store");
		setNoiseLevel("session-a", 30);
		setNoiseLevel("session-b", 80);

		clearNoiseLevel("session-a");

		expect(getNoiseLevel("session-a")).toBe(0);
		expect(getNoiseLevel("session-b")).toBe(80);
	});

	// ── NoiseFrame contract: clamping ──────────────────────────────────────────

	it("setNoiseLevel clamps level > 100 to 100", async () => {
		const { setNoiseLevel, getNoiseLevel } = await import("../noise-store");
		setNoiseLevel("session-clamp-high", 150);
		expect(getNoiseLevel("session-clamp-high")).toBe(100);
	});

	it("setNoiseLevel clamps level < 0 to 0", async () => {
		const { setNoiseLevel, getNoiseLevel } = await import("../noise-store");
		setNoiseLevel("session-clamp-low", -5);
		expect(getNoiseLevel("session-clamp-low")).toBe(0);
	});

	it("getNoiseLevel returns 0 (not undefined or null) when no data has been posted", async () => {
		const { getNoiseLevel } = await import("../noise-store");
		const result = getNoiseLevel("session-never-posted");
		expect(result).toBe(0);
		expect(typeof result).toBe("number");
	});
});
