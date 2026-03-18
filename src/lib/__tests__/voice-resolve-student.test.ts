import { describe, expect, it } from "vitest";

// ── Levenshtein — copied verbatim from src/components/voice/voice-command-provider.tsx ──

function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
		Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
	);
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] =
				a[i - 1] === b[j - 1]
					? (dp[i - 1][j - 1] ?? 0)
					: 1 + Math.min(dp[i - 1]?.[j] ?? n, dp[i]?.[j - 1] ?? m, dp[i - 1]?.[j - 1] ?? n);
		}
	}
	return dp[m]?.[n] ?? Math.max(m, n);
}

// ── resolveStudent matching logic — replicates algorithm from voice-command-provider.tsx ──

type StudentEntry = {
	firstName?: string | null;
	firstInitial: string;
	lastInitial: string;
	displayName: string;
	rosterId: string;
};

function resolveStudentSync(needle: string, students: StudentEntry[]): StudentEntry | undefined {
	const lowerNeedle = needle.toLowerCase();
	const exact =
		students.find((s) => s.firstName?.toLowerCase() === lowerNeedle) ??
		students.find((s) => s.displayName.toLowerCase() === lowerNeedle) ??
		students.find((s) => s.displayName.toLowerCase().includes(lowerNeedle)) ??
		students.find((s) => lowerNeedle.includes(s.displayName.toLowerCase())) ??
		students.find((s) => s.firstName?.toLowerCase().startsWith(lowerNeedle)) ??
		students.find((s) => lowerNeedle.startsWith(s.firstName?.toLowerCase() ?? " ")) ??
		students.find(
			(s) =>
				s.firstInitial.toLowerCase() === lowerNeedle[0] &&
				s.lastInitial.toLowerCase() === (lowerNeedle.split(" ").at(-1)?.[0] ?? lowerNeedle[0]),
		);
	if (exact) return exact;

	let bestStudent: StudentEntry | null = null;
	let bestDist = Infinity;
	for (const s of students) {
		const candidate = (s.firstName ?? s.displayName).toLowerCase();
		const dist = levenshtein(lowerNeedle, candidate);
		const threshold = Math.max(2, Math.floor(Math.max(lowerNeedle.length, candidate.length) * 0.4));
		if (dist <= threshold && dist < bestDist) {
			bestDist = dist;
			bestStudent = s;
		}
	}
	return bestStudent ?? undefined;
}

const ROSTER: StudentEntry[] = [
	{
		firstName: "Xiomara",
		firstInitial: "X",
		lastInitial: "R",
		displayName: "X.R.",
		rosterId: "r1",
	},
	{ firstName: "Jailyn", firstInitial: "J", lastInitial: "M", displayName: "J.M.", rosterId: "r2" },
	{ firstName: "Marcus", firstInitial: "M", lastInitial: "T", displayName: "M.T.", rosterId: "r3" },
	{ firstName: "Sarah", firstInitial: "S", lastInitial: "K", displayName: "S.K.", rosterId: "r4" },
	{ firstName: "Nailah", firstInitial: "N", lastInitial: "B", displayName: "N.B.", rosterId: "r5" },
];

describe("levenshtein distance", () => {
	it("returns 0 for identical strings", () => {
		expect(levenshtein("marcus", "marcus")).toBe(0);
	});
	it("returns 1 for single char substitution", () => {
		expect(levenshtein("cat", "bat")).toBe(1);
	});
	it("returns 1 for single char insertion", () => {
		expect(levenshtein("cat", "cats")).toBe(1);
	});
	it("returns 1 for single char deletion", () => {
		expect(levenshtein("cats", "cat")).toBe(1);
	});
	it("handles empty string vs non-empty", () => {
		expect(levenshtein("", "abc")).toBe(3);
		expect(levenshtein("abc", "")).toBe(3);
	});
	it("'shomara' vs 'xiomara' (ethnic name pair) ≤ 2", () => {
		expect(levenshtein("shomara", "xiomara")).toBeLessThanOrEqual(2);
	});
	it("'jaylen' vs 'jailyn' within 40% threshold", () => {
		expect(levenshtein("jaylen", "jailyn")).toBeLessThanOrEqual(2);
	});
});

describe("resolveStudent — exact matching", () => {
	it("matches by exact firstName", () => {
		expect(resolveStudentSync("Marcus", ROSTER)?.rosterId).toBe("r3");
	});
	it("matches by partial firstName prefix", () => {
		expect(resolveStudentSync("Mar", ROSTER)?.rosterId).toBe("r3");
	});
	it("returns undefined for completely unknown name", () => {
		expect(resolveStudentSync("Zzzyx", ROSTER)).toBeUndefined();
	});
});

describe("resolveStudent — ethnic name fuzzy matching", () => {
	it("matches 'Shomara' to roster 'Xiomara'", () => {
		expect(resolveStudentSync("Shomara", ROSTER)?.rosterId).toBe("r1");
	});
	it("matches 'Jaylen' to roster 'Jailyn'", () => {
		expect(resolveStudentSync("Jaylen", ROSTER)?.rosterId).toBe("r2");
	});
	it("'Nyla' vs 'Nailah' distance exceeds 40% threshold — returns undefined", () => {
		// levenshtein("nyla","nailah")=3, threshold=max(2,floor(6*0.4))=2 → no match
		expect(resolveStudentSync("Nyla", ROSTER)).toBeUndefined();
	});
	it("matches typo 'Marcas' to 'Marcus'", () => {
		expect(resolveStudentSync("Marcas", ROSTER)?.rosterId).toBe("r3");
	});
});
