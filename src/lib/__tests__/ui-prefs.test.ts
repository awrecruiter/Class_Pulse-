import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	GLOBAL_VOICE_ONLY_MODE_KEY,
	isMicConsumerEnabled,
	readBooleanPreference,
} from "@/lib/ui-prefs";

describe("ui prefs", () => {
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			},
		});
	});

	it("reads boolean preferences with a default fallback", () => {
		localStorage.removeItem("test.pref");
		expect(readBooleanPreference("test.pref", true)).toBe(true);
		localStorage.setItem("test.pref", "false");
		expect(readBooleanPreference("test.pref", true)).toBe(false);
	});

	it("allows all mic consumers when global voice only mode is off", () => {
		localStorage.setItem(GLOBAL_VOICE_ONLY_MODE_KEY, "false");
		expect(isMicConsumerEnabled("globalVoice")).toBe(true);
		expect(isMicConsumerEnabled("lecture")).toBe(true);
		expect(isMicConsumerEnabled("dictation")).toBe(true);
		expect(isMicConsumerEnabled("orb")).toBe(true);
	});

	it("restricts mic access to globalVoice when global voice only mode is on", () => {
		localStorage.setItem(GLOBAL_VOICE_ONLY_MODE_KEY, "true");
		expect(isMicConsumerEnabled("globalVoice")).toBe(true);
		expect(isMicConsumerEnabled("lecture")).toBe(false);
		expect(isMicConsumerEnabled("dictation")).toBe(false);
		expect(isMicConsumerEnabled("orb")).toBe(false);
	});
});
