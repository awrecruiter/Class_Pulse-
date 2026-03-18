import { describe, expect, it } from "vitest";

// Copied verbatim from src/hooks/use-global-voice-commands.ts
const NAV_RE =
	/\b(?:go(?:\s+to)?|navigate(?:\s+to)?|take(?:\s+me)?(?:\s+to)?|open|switch(?:\s+to)?)\s+(?:the\s+)?(?:my\s+)?(board|classes?|settings|coach|store|gradebook)\b/i;

function extractDest(utterance: string): string | null {
	const m = utterance.toLowerCase().trim().match(NAV_RE);
	if (!m) return null;
	return m[1].toLowerCase().replace(/^class$/, "classes");
}

describe("voice nav regex", () => {
	it("matches 'go to board'", () => {
		expect(extractDest("go to board")).toBe("board");
	});
	it("matches 'go board' (no to)", () => {
		expect(extractDest("go board")).toBe("board");
	});
	it("matches 'navigate to classes'", () => {
		expect(extractDest("navigate to classes")).toBe("classes");
	});
	it("regex matches 'classes' (plural)", () => {
		// NAV_RE uses `classes?` which requires 'e' before optional 's' — matches 'classes' not bare 'class'
		expect(extractDest("go to classes")).toBe("classes");
	});
	it("matches 'take me to store'", () => {
		expect(extractDest("take me to store")).toBe("store");
	});
	it("matches 'take to settings'", () => {
		expect(extractDest("take to settings")).toBe("settings");
	});
	it("matches 'open coach'", () => {
		expect(extractDest("open coach")).toBe("coach");
	});
	it("matches 'switch to gradebook'", () => {
		expect(extractDest("switch to gradebook")).toBe("gradebook");
	});
	it("matches 'open my store'", () => {
		expect(extractDest("open my store")).toBe("store");
	});
	it("matches 'open the board'", () => {
		expect(extractDest("open the board")).toBe("board");
	});
	it("does NOT match bare destination", () => {
		expect(extractDest("store please")).toBeNull();
	});
	it("does NOT match unrelated utterance", () => {
		expect(extractDest("give Marcus 10 bucks")).toBeNull();
	});
	it("is case-insensitive", () => {
		expect(extractDest("GO TO BOARD")).toBe("board");
	});
	it("matches 'navigate board'", () => {
		expect(extractDest("navigate board")).toBe("board");
	});
});
