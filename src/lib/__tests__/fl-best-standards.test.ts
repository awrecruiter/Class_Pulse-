import { describe, expect, it } from "vitest";
import { FL_BEST_STANDARDS, type Strand } from "../../data/fl-best-standards";

const VALID_STRANDS: Strand[] = ["NSO", "FR", "AR", "M", "GR", "DP"];
const VALID_GRADES = new Set([3, 4, 5]);
const allCodes = new Set(FL_BEST_STANDARDS.map((b) => b.code));

describe("FL_BEST_STANDARDS data integrity", () => {
	it("contains exactly 100 benchmarks", () => {
		expect(FL_BEST_STANDARDS).toHaveLength(100);
	});

	it("every benchmark has a non-empty code", () => {
		for (const b of FL_BEST_STANDARDS) {
			expect(b.code.length, `empty code found`).toBeGreaterThan(0);
		}
	});

	it("all codes are unique", () => {
		expect(allCodes.size).toBe(FL_BEST_STANDARDS.length);
	});

	it("all codes follow MA.<grade>.<strand>.<number>.<sub> format", () => {
		const CODE_RE = /^MA\.[345]\.[A-Z]+\.\d+\.\d+$/;
		for (const b of FL_BEST_STANDARDS) {
			expect(CODE_RE.test(b.code), `malformed code: ${b.code}`).toBe(true);
		}
	});

	it("all grades are 3, 4, or 5", () => {
		for (const b of FL_BEST_STANDARDS) {
			expect(VALID_GRADES.has(b.grade), `invalid grade ${b.grade} in ${b.code}`).toBe(true);
		}
	});

	it("all strands are valid", () => {
		for (const b of FL_BEST_STANDARDS) {
			expect(VALID_STRANDS.includes(b.strand), `invalid strand ${b.strand} in ${b.code}`).toBe(
				true,
			);
		}
	});

	it("all descriptions are non-empty strings", () => {
		for (const b of FL_BEST_STANDARDS) {
			expect(typeof b.description).toBe("string");
			expect(b.description.length, `empty description in ${b.code}`).toBeGreaterThan(0);
		}
	});

	it("all prerequisite codes refer to existing benchmarks", () => {
		for (const b of FL_BEST_STANDARDS) {
			for (const prereq of b.prerequisites) {
				expect(allCodes.has(prereq), `${b.code} has unknown prereq: ${prereq}`).toBe(true);
			}
		}
	});

	it("prerequisites are always for a lower or equal grade level", () => {
		const codeToGrade = new Map(FL_BEST_STANDARDS.map((b) => [b.code, b.grade]));
		for (const b of FL_BEST_STANDARDS) {
			for (const prereq of b.prerequisites) {
				const prereqGrade = codeToGrade.get(prereq) ?? -1;
				expect(
					prereqGrade <= b.grade,
					`${b.code} (grade ${b.grade}) prereq ${prereq} is grade ${prereqGrade}`,
				).toBe(true);
			}
		}
	});

	it("covers all three target grades", () => {
		const grades = new Set(FL_BEST_STANDARDS.map((b) => b.grade));
		expect(grades.has(3)).toBe(true);
		expect(grades.has(4)).toBe(true);
		expect(grades.has(5)).toBe(true);
	});

	it("covers all six strands", () => {
		const strands = new Set(FL_BEST_STANDARDS.map((b) => b.strand));
		for (const s of VALID_STRANDS) {
			expect(strands.has(s), `missing strand ${s}`).toBe(true);
		}
	});
});
