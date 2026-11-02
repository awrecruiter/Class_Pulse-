// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaveformMeter } from "./waveform-meter";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("measured waveform", () => {
	it("does not request a mic when the lecture is inactive", () => {
		const getUserMedia = vi.fn();
		vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
		const onAmplitude = vi.fn();
		render(<WaveformMeter active={false} onAmplitude={onAmplitude} />);
		expect(getUserMedia).not.toHaveBeenCalled();
		expect(onAmplitude).toHaveBeenCalledWith(0);
	});
	it("never broadcasts fabricated audio when microphone access fails", async () => {
		vi.stubGlobal("navigator", {
			mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error("Denied")) },
		});
		let frame: FrameRequestCallback = () => {};
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frame = callback;
			return 1;
		});
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			scale: vi.fn(),
			clearRect: vi.fn(),
			createLinearGradient: () => ({ addColorStop: vi.fn() }),
			beginPath: vi.fn(),
			roundRect: vi.fn(),
			fill: vi.fn(),
		} as unknown as CanvasRenderingContext2D);
		const onAmplitude = vi.fn();
		await act(async () => {
			render(<WaveformMeter active onAmplitude={onAmplitude} />);
		});
		act(() => frame(100));
		expect(onAmplitude).toHaveBeenCalledWith(0);
		expect(onAmplitude.mock.calls.every(([level]) => level === 0)).toBe(true);
	});
});
