/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalVoiceCommands } from "./use-global-voice-commands";

const startMock = vi.fn();
const stopMock = vi.fn();
const getVoiceProfileMock = vi.fn();
const getUserMediaMock = vi.fn();

vi.mock("@/hooks/use-mic-manager", () => ({
	useMicSlot: () => ({
		isActive: false,
		start: startMock,
		stop: stopMock,
	}),
}));

vi.mock("@/hooks/use-board-voice", () => ({
	matchBoardCommand: () => null,
}));

vi.mock("@/lib/voice-profile", () => ({
	detectPitch: vi.fn(() => null),
	getVoiceProfile: () => getVoiceProfileMock(),
	pitchMatchesProfile: vi.fn(() => true),
}));

describe("useGlobalVoiceCommands", () => {
	beforeEach(() => {
		localStorage.clear();
		startMock.mockReset();
		stopMock.mockReset();
		getVoiceProfileMock.mockReset();
		getUserMediaMock.mockReset();
		vi.stubGlobal("navigator", {
			mediaDevices: {
				getUserMedia: getUserMediaMock,
			},
		});
	});

	it("does not open a parallel audio stream when voice lock is not active", async () => {
		getVoiceProfileMock.mockReturnValue(null);

		renderHook(() =>
			useGlobalVoiceCommands({
				enabled: true,
			}),
		);

		await waitFor(() => {
			expect(startMock).toHaveBeenCalled();
		});
		expect(getUserMediaMock).not.toHaveBeenCalled();
	});

	it("opens a parallel audio stream only when voice lock is enabled with an enrolled profile", async () => {
		getVoiceProfileMock.mockReturnValue({
			meanPitch: 180,
			toleranceHz: 30,
			sampleCount: 20,
			enrolledAt: Date.now(),
		});
		getUserMediaMock.mockResolvedValue({
			getTracks: () => [{ stop: vi.fn() }],
		});
		vi.stubGlobal(
			"AudioContext",
			class {
				createMediaStreamSource() {
					return { connect: vi.fn() };
				}
				createAnalyser() {
					return { fftSize: 0 };
				}
				close() {
					return Promise.resolve();
				}
			},
		);

		renderHook(() =>
			useGlobalVoiceCommands({
				enabled: true,
			}),
		);

		await waitFor(() => {
			expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true, video: false });
		});
	});
});
