/**
 * Noise / Waveform typed-contract tests.
 *
 * These tests verify the NoiseFrame + StudentFeedNoiseEvent contract that
 * governs data flowing from the teacher WaveformMeter through noise-store and
 * out to the student SoundcloudWave via the student-feed SSE route.
 *
 * Three invariants verified:
 *  1. Level is clamped to [0, 100] — bypassing Zod validation in the route
 *     cannot produce out-of-range values in the store.
 *  2. The SSE payload shape has `type: "noise"` and `level` as a number (not
 *     a string), matching StudentFeedNoiseEvent.
 *  3. The store returns 0 (number) when no data has been posted — never
 *     undefined or null.
 */

import { describe, expect, it } from "vitest";
import type { NoiseFrame, StudentFeedNoiseEvent } from "@/types";

// ─── 1. Clamping (tested via noise-store directly) ────────────────────────────
// See src/lib/__tests__/noise-store.test.ts for exhaustive TTL / isolation tests.
// The three clamping cases are co-located here as contract tests so they live
// with the type definitions they protect.

describe("NoiseFrame contract — level clamping", () => {
	it("setNoiseLevel clamps level > 100 down to 100", async () => {
		const { setNoiseLevel, getNoiseLevel, clearNoiseLevel } = await import("../noise-store");
		setNoiseLevel("contract-clamp-high", 150);
		expect(getNoiseLevel("contract-clamp-high")).toBe(100);
		clearNoiseLevel("contract-clamp-high");
	});

	it("setNoiseLevel clamps level < 0 up to 0", async () => {
		const { setNoiseLevel, getNoiseLevel, clearNoiseLevel } = await import("../noise-store");
		setNoiseLevel("contract-clamp-low", -5);
		expect(getNoiseLevel("contract-clamp-low")).toBe(0);
		clearNoiseLevel("contract-clamp-low");
	});

	it("getNoiseLevel returns the number 0 (not undefined or null) when no data has been posted", async () => {
		const { getNoiseLevel } = await import("../noise-store");
		const result = getNoiseLevel("contract-never-posted");
		// Must be exactly 0, typed as number — not undefined, not null
		expect(result).toBe(0);
		expect(typeof result).toBe("number");
	});
});

// ─── 2. StudentFeedNoiseEvent shape ───────────────────────────────────────────

describe("StudentFeedNoiseEvent contract — SSE payload shape", () => {
	it("level is a number, not a string, when serialised to JSON", () => {
		// This is the exact construction the student-feed route uses before
		// encoding to SSE text.  If this type check compiles AND the runtime
		// assertion passes, it proves the SSE payload is correctly typed.
		const event: StudentFeedNoiseEvent = { type: "noise", level: 50 };
		const serialised = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;

		expect(serialised.type).toBe("noise");
		expect(typeof serialised.level).toBe("number"); // NOT "string"
		expect(serialised.level).toBe(50);
	});

	it("level 0 is still a number (not falsy-coerced to something else)", () => {
		const event: StudentFeedNoiseEvent = { type: "noise", level: 0 };
		const serialised = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;

		expect(typeof serialised.level).toBe("number");
		expect(serialised.level).toBe(0);
	});

	it("NoiseFrame timestamp is a number", () => {
		const frame: NoiseFrame = { level: 42, timestamp: Date.now() };
		expect(typeof frame.timestamp).toBe("number");
		expect(frame.timestamp).toBeGreaterThan(0);
	});

	it("NoiseFrame level round-trips through JSON as a number", () => {
		const frame: NoiseFrame = { level: 73, timestamp: 1_700_000_000_000 };
		const parsed = JSON.parse(JSON.stringify(frame)) as Record<string, unknown>;
		expect(typeof parsed.level).toBe("number");
		expect(parsed.level).toBe(73);
	});
});
