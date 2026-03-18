import { describe, expect, it } from "vitest";

const WAKE_PHRASES = ["listen up", "hey coach", "ok listen up"] as const;

function phraseBoundaryMatch(utterance: string, phrase: string): boolean {
	return new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(
		utterance,
	);
}

function isWakePhrase(text: string): boolean {
	const lower = text.toLowerCase().trim();
	return WAKE_PHRASES.some((p) => phraseBoundaryMatch(lower, p));
}

describe("wake phrase detection", () => {
	it("matches exact wake phrase", () => {
		expect(isWakePhrase("listen up")).toBe(true);
		expect(isWakePhrase("hey coach")).toBe(true);
		expect(isWakePhrase("ok listen up")).toBe(true);
	});

	it("matches wake phrase with trailing words", () => {
		expect(isWakePhrase("listen up class")).toBe(true);
		// Speech recognition strips punctuation — no comma
		expect(isWakePhrase("listen up give Jordan 10 bucks")).toBe(true);
	});

	it("matches wake phrase with leading words", () => {
		expect(isWakePhrase("ok listen up")).toBe(true);
	});

	it("does NOT match non-wake commands", () => {
		expect(isWakePhrase("give Jordan 10 bucks")).toBe(false);
		expect(isWakePhrase("open iReady")).toBe(false);
		expect(isWakePhrase("go to classes")).toBe(false);
	});

	it("does NOT match partial phrase substrings", () => {
		// "listen" alone should not match "listen up"
		expect(isWakePhrase("listen")).toBe(false);
		// "coach" alone should not match "hey coach"
		expect(isWakePhrase("coach")).toBe(false);
	});

	it("is case insensitive", () => {
		expect(isWakePhrase("LISTEN UP")).toBe(true);
		expect(isWakePhrase("Hey Coach")).toBe(true);
	});
});
