import { describe, expect, it } from "vitest";

// Copied verbatim from src/components/voice/voice-command-provider.tsx
const MOVE_RE =
	/\b(?:put|move|add|place|assign)\s+(\w+)\s+(?:in(?:to)?|to)\s+(?:the\s+)?(\w+)(?:\s+group)?\b/i;

const SKIP_WORDS = ["a", "an", "the", "his", "her", "my", "their", "this", "that"];

function parseMoveCommand(text: string): { student: string; group: string } | null {
	const m = text.trim().match(MOVE_RE);
	if (!m) return null;
	const rawGroup = m[2];
	if (SKIP_WORDS.includes(rawGroup.toLowerCase()) || rawGroup.length <= 1) return null;
	return { student: m[1], group: rawGroup };
}

describe("move_to_group fast-path regex", () => {
	it("parses 'move Marcus to Dogs'", () => {
		expect(parseMoveCommand("move Marcus to Dogs")).toEqual({ student: "Marcus", group: "Dogs" });
	});
	it("parses 'put Sarah into Eagles'", () => {
		expect(parseMoveCommand("put Sarah into Eagles")).toEqual({
			student: "Sarah",
			group: "Eagles",
		});
	});
	it("parses 'add Jordan in Hawks'", () => {
		expect(parseMoveCommand("add Jordan in Hawks")).toEqual({ student: "Jordan", group: "Hawks" });
	});
	it("parses 'place Nyla to Red group'", () => {
		expect(parseMoveCommand("place Nyla to Red group")).toEqual({ student: "Nyla", group: "Red" });
	});
	it("parses 'assign Marcus to the Blue group'", () => {
		expect(parseMoveCommand("assign Marcus to the Blue group")).toEqual({
			student: "Marcus",
			group: "Blue",
		});
	});
	it("returns null when group word is a skip word", () => {
		expect(parseMoveCommand("move Marcus to his group")).toBeNull();
	});
	it("returns null for non-matching utterance", () => {
		expect(parseMoveCommand("give Marcus 10 bucks")).toBeNull();
	});
	it("is case-insensitive on trigger word", () => {
		expect(parseMoveCommand("MOVE Marcus to Dogs")).toEqual({ student: "Marcus", group: "Dogs" });
	});
});
