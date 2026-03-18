import { describe, expect, it } from "vitest";

// ── resolveGroup matching logic — replicates algorithm from voice-command-provider.tsx ──

type GroupEntry = { id: string; name: string };

function resolveGroupSync(name: string, groups: GroupEntry[]): GroupEntry | undefined {
	const needle = name
		.toLowerCase()
		.replace(/\s+group$/i, "")
		.replace(/s$/, ""); // strip " group" suffix and trailing s
	return (groups ?? []).find((g) => {
		const hay = g.name.toLowerCase().replace(/s$/, "");
		return hay === needle || g.name.toLowerCase() === name.toLowerCase();
	}) as GroupEntry | undefined;
}

const GROUPS: GroupEntry[] = [
	{ id: "g1", name: "Dogs" },
	{ id: "g2", name: "Eagles" },
	{ id: "g3", name: "Hawks" },
	{ id: "g4", name: "Red" },
	{ id: "g5", name: "Blue" },
];

describe("resolveGroup — exact matching", () => {
	it("matches by exact group name", () => {
		expect(resolveGroupSync("Dogs", GROUPS)?.id).toBe("g1");
	});
	it("is case-insensitive", () => {
		expect(resolveGroupSync("dogs", GROUPS)?.id).toBe("g1");
		expect(resolveGroupSync("EAGLES", GROUPS)?.id).toBe("g2");
	});
	it("strips trailing ' group' suffix", () => {
		expect(resolveGroupSync("Dogs group", GROUPS)?.id).toBe("g1");
	});
	it("strips trailing 's' for plurals", () => {
		// "Dogs" → strips trailing s → "dog"; "Dogs" in roster → strips s → "dog"
		// So "Dog" should match "Dogs"
		expect(resolveGroupSync("Dog", GROUPS)?.id).toBe("g1");
	});
	it("strips both ' group' suffix and trailing s", () => {
		expect(resolveGroupSync("Eagles group", GROUPS)?.id).toBe("g2");
	});
	it("matches 'Red group' to 'Red'", () => {
		expect(resolveGroupSync("Red group", GROUPS)?.id).toBe("g4");
	});
	it("matches 'the Blue group' correctly — only if suffix stripped", () => {
		// "the Blue group" → after strip " group" → "the Blue" → needle = "the blue"
		// hay for Blue = "blue" — doesn't match "the blue", so returns undefined
		expect(resolveGroupSync("the Blue group", GROUPS)).toBeUndefined();
	});
	it("returns undefined for unknown group", () => {
		expect(resolveGroupSync("Sharks", GROUPS)).toBeUndefined();
	});
	it("returns undefined for empty string", () => {
		expect(resolveGroupSync("", GROUPS)).toBeUndefined();
	});
});
