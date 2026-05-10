import { describe, expect, it } from "vitest";
import { YAAG_TOPICS } from "@/data/yaag-2025-2026";
import {
	addWeekdays,
	buildCalendarDays,
	computeEffectiveTopicDates,
	countWeekdays,
	detectDragConflicts,
	formatDate,
	parseLocalDate,
	resolveDrag,
} from "@/lib/pacing-calendar";

// ─── Utilities ────────────────────────────────────────────────────────────────

describe("parseLocalDate / formatDate round-trip", () => {
	it("parses and formats without UTC shift", () => {
		const dates = ["2026-01-01", "2026-05-15", "2025-12-31", "2026-09-07"];
		for (const d of dates) {
			expect(formatDate(parseLocalDate(d))).toBe(d);
		}
	});
});

describe("countWeekdays", () => {
	it("counts Mon–Fri in a simple week", () => {
		// 2026-05-04 (Mon) → 2026-05-08 (Fri) = 5
		expect(countWeekdays(parseLocalDate("2026-05-04"), parseLocalDate("2026-05-08"))).toBe(5);
	});

	it("ignores Sat and Sun", () => {
		// 2026-05-02 (Sat) → 2026-05-03 (Sun) = 0
		expect(countWeekdays(parseLocalDate("2026-05-02"), parseLocalDate("2026-05-03"))).toBe(0);
	});

	it("counts across a weekend", () => {
		// 2026-05-07 (Thu) → 2026-05-12 (Tue) = Thu Fri Mon Tue = 4
		expect(countWeekdays(parseLocalDate("2026-05-07"), parseLocalDate("2026-05-12"))).toBe(4);
	});

	it("returns 1 for a single weekday", () => {
		expect(countWeekdays(parseLocalDate("2026-05-04"), parseLocalDate("2026-05-04"))).toBe(1);
	});
});

describe("addWeekdays", () => {
	it("advances exactly N weekdays forward", () => {
		// 2026-05-04 (Mon) + 0 = stays on Mon
		expect(formatDate(addWeekdays(parseLocalDate("2026-05-04"), 0))).toBe("2026-05-04");
	});

	it("skips the weekend going forward", () => {
		// 2026-05-08 (Fri) + 1 weekday = 2026-05-11 (Mon)
		expect(formatDate(addWeekdays(parseLocalDate("2026-05-08"), 1))).toBe("2026-05-11");
	});

	it("skips the weekend going forward by 2", () => {
		// 2026-05-08 (Fri) + 2 weekdays = 2026-05-12 (Tue)
		expect(formatDate(addWeekdays(parseLocalDate("2026-05-08"), 2))).toBe("2026-05-12");
	});

	it("advances 5 weekdays = exactly one full week", () => {
		const start = parseLocalDate("2026-05-04"); // Monday
		const result = formatDate(addWeekdays(start, 5));
		expect(result).toBe("2026-05-11"); // next Monday
	});

	it("goes backward by 1 weekday across a weekend", () => {
		// 2026-05-11 (Mon) - 1 = 2026-05-08 (Fri)
		expect(formatDate(addWeekdays(parseLocalDate("2026-05-11"), -1))).toBe("2026-05-08");
	});
});

// ─── computeEffectiveTopicDates ────────────────────────────────────────────────

describe("computeEffectiveTopicDates", () => {
	it("returns 18 topics with no overrides", () => {
		const result = computeEffectiveTopicDates([]);
		expect(result).toHaveLength(18);
	});

	it("preserves YAAG base dates when no overrides", () => {
		const result = computeEffectiveTopicDates([]);
		const topic1 = YAAG_TOPICS.find((t) => t.number === 1);
		if (!topic1) throw new Error("topic1 not found");
		const eff1 = result.find((e) => e.topic.number === 1);
		if (!eff1) throw new Error("eff1 not found");
		expect(eff1.startDate).toBe(topic1.startDate);
		expect(eff1.endDate).toBe(topic1.endDate);
	});

	it("applies an override to the specified topic", () => {
		const topic2 = YAAG_TOPICS.find((t) => t.number === 2);
		if (!topic2) throw new Error("topic2 not found");
		// Push topic 2 start 5 weekdays later than its YAAG start
		const newStart = formatDate(addWeekdays(parseLocalDate(topic2.startDate), 5));
		const result = computeEffectiveTopicDates([
			{ topicNumber: 2, startDate: newStart, cascadeMode: "stack" },
		]);
		const eff2 = result.find((e) => e.topic.number === 2);
		if (!eff2) throw new Error("eff2 not found");
		expect(eff2.startDate).toBe(newStart);
	});

	it("cascades push_forward to later topics", () => {
		const topic1 = YAAG_TOPICS.find((t) => t.number === 1);
		if (!topic1) throw new Error("topic1 not found");
		const topic2 = YAAG_TOPICS.find((t) => t.number === 2);
		if (!topic2) throw new Error("topic2 not found");
		// Push topic 1 start 5 weekdays later
		const newStart = formatDate(addWeekdays(parseLocalDate(topic1.startDate), 5));
		const result = computeEffectiveTopicDates([
			{ topicNumber: 1, startDate: newStart, cascadeMode: "push_forward" },
		]);
		const eff1 = result.find((e) => e.topic.number === 1);
		if (!eff1) throw new Error("eff1 not found");
		const eff2 = result.find((e) => e.topic.number === 2);
		if (!eff2) throw new Error("eff2 not found");
		expect(eff1.startDate).toBe(newStart);
		// Topic 2 should have shifted forward by the same 5 weekdays
		const expectedTopic2Start = formatDate(addWeekdays(parseLocalDate(topic2.startDate), 5));
		expect(eff2.startDate).toBe(expectedTopic2Start);
	});

	it("does NOT cascade when cascadeMode=stack", () => {
		const topic1 = YAAG_TOPICS.find((t) => t.number === 1);
		if (!topic1) throw new Error("topic1 not found");
		const topic2 = YAAG_TOPICS.find((t) => t.number === 2);
		if (!topic2) throw new Error("topic2 not found");
		const newStart = formatDate(addWeekdays(parseLocalDate(topic1.startDate), 5));
		const result = computeEffectiveTopicDates([
			{ topicNumber: 1, startDate: newStart, cascadeMode: "stack" },
		]);
		const eff2 = result.find((e) => e.topic.number === 2);
		if (!eff2) throw new Error("eff2 not found");
		// Topic 2 must remain at its YAAG base date (no cascade)
		expect(eff2.startDate).toBe(topic2.startDate);
	});
});

// ─── buildCalendarDays ────────────────────────────────────────────────────────

describe("buildCalendarDays", () => {
	const effectiveTopics = computeEffectiveTopicDates([]);

	it("includes all days in the range including weekends", () => {
		const days = buildCalendarDays({
			rangeStart: "2026-05-04",
			rangeEnd: "2026-05-10",
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [],
		});
		expect(days).toHaveLength(7);
		expect(days[0]?.date).toBe("2026-05-04");
		expect(days[6]?.date).toBe("2026-05-10");
	});

	it("marks weekends correctly", () => {
		const days = buildCalendarDays({
			rangeStart: "2026-05-04",
			rangeEnd: "2026-05-10",
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [],
		});
		// May 2026: Mon=4, Tue=5, Wed=6, Thu=7, Fri=8, Sat=9, Sun=10
		expect(days.find((d) => d.date === "2026-05-09")?.isWeekend).toBe(true);
		expect(days.find((d) => d.date === "2026-05-10")?.isWeekend).toBe(true);
		expect(days.find((d) => d.date === "2026-05-04")?.isWeekend).toBe(false);
	});

	it("marks today correctly", () => {
		const days = buildCalendarDays({
			rangeStart: "2026-05-04",
			rangeEnd: "2026-05-10",
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [],
			today: "2026-05-06",
		});
		expect(days.find((d) => d.date === "2026-05-06")?.isToday).toBe(true);
		expect(days.find((d) => d.date === "2026-05-04")?.isToday).toBe(false);
	});

	it("marks a blocked weekday as isBlocked", () => {
		const days = buildCalendarDays({
			rangeStart: "2026-05-04",
			rangeEnd: "2026-05-08",
			effectiveTopics,
			blockedDays: [{ date: "2026-05-06", reason: "PD day" }],
			explicitPlacements: [],
		});
		const blocked = days.find((d) => d.date === "2026-05-06");
		if (!blocked) throw new Error("blocked day not found");
		expect(blocked.isBlocked).toBe(true);
		expect(blocked.blockReason).toBe("PD day");
	});

	it("weekends have no lessons even when the range has lessons", () => {
		const days = buildCalendarDays({
			rangeStart: "2026-05-09",
			rangeEnd: "2026-05-10",
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [],
		});
		for (const d of days) {
			expect(d.lessons).toHaveLength(0);
		}
	});

	it("places at least one lesson on a weekday within a topic range", () => {
		// Find the first topic's start week and check lessons appear
		const topic1 = YAAG_TOPICS.find((t) => t.number === 1);
		if (!topic1) throw new Error("topic1 not found");
		const rangeStart = topic1.startDate;
		const rangeEnd = formatDate(addWeekdays(parseLocalDate(rangeStart), 4)); // ~1 week
		const days = buildCalendarDays({
			rangeStart,
			rangeEnd,
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [],
		});
		const withLessons = days.filter((d) => d.lessons.length > 0);
		expect(withLessons.length).toBeGreaterThan(0);
	});

	it("explicit placement overrides computed date for that lesson", () => {
		const topic1 = YAAG_TOPICS.find((t) => t.number === 1);
		if (!topic1) throw new Error("topic1 not found");
		const firstLesson = topic1.lessons[0];
		if (!firstLesson) throw new Error("no lessons in topic1");
		// Force lesson 1.1 onto a specific date
		const overrideDate = "2026-06-01";
		const days = buildCalendarDays({
			rangeStart: overrideDate,
			rangeEnd: overrideDate,
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [
				{
					topicNumber: topic1.number,
					lessonNumber: firstLesson.number,
					date: overrideDate,
				},
			],
		});
		const day = days.find((d) => d.date === overrideDate);
		if (!day) throw new Error("day not found");
		const found = day.lessons.find(
			(l) => l.topicNumber === topic1.number && l.lessonNumber === firstLesson.number,
		);
		expect(found).toBeDefined();
		expect(found?.isExplicit).toBe(true);
	});

	it("blocked days get no lessons", () => {
		const topic1 = YAAG_TOPICS.find((t) => t.number === 1);
		if (!topic1) throw new Error("topic1 not found");
		const startDate = topic1.startDate;
		const days = buildCalendarDays({
			rangeStart: startDate,
			rangeEnd: startDate,
			effectiveTopics,
			blockedDays: [{ date: startDate, reason: null }],
			explicitPlacements: [],
		});
		const day = days.find((d) => d.date === startDate);
		if (!day) throw new Error("day not found");
		// Blocked day should have no lessons and isBlocked=true
		expect(day.isBlocked).toBe(true);
		expect(day.lessons).toHaveLength(0);
	});
});

// ─── detectDragConflicts ──────────────────────────────────────────────────────

describe("detectDragConflicts", () => {
	const effectiveTopics = computeEffectiveTopicDates([]);
	const _topic1 = YAAG_TOPICS.find((t) => t.number === 1) ?? YAAG_TOPICS[0];
	const topic1 = _topic1;
	const lesson1 = topic1.lessons[0] ?? { number: "1.1", title: "" };
	const lesson2 = topic1.lessons[1] ?? { number: "1.2", title: "" };

	it("returns no conflict when target is empty", () => {
		const emptyDays = buildCalendarDays({
			rangeStart: "2026-10-01",
			rangeEnd: "2026-10-07",
			effectiveTopics: computeEffectiveTopicDates([]),
			blockedDays: [],
			explicitPlacements: [],
		});
		const result = detectDragConflicts({
			dragging: [{ topicNumber: topic1.number, lessonNumber: lesson1.number }],
			targetDate: "2026-10-01",
			calendarDays: emptyDays,
			blockedDays: new Set(),
		});
		// If no lessons are placed on Oct 1 in the default schedule, no conflict
		const targetDay = emptyDays.find((d) => d.date === "2026-10-01");
		const hasLessonsOnTarget = (targetDay?.lessons.length ?? 0) > 0;
		if (!hasLessonsOnTarget) {
			expect(result.hasConflict).toBe(false);
		}
	});

	it("detects a conflict when target day has other lessons", () => {
		// Build a calendar with lesson2 explicitly on the target date
		const targetDate = "2026-09-01"; // a Tuesday — well outside normal topic 1 range
		const calDays = buildCalendarDays({
			rangeStart: targetDate,
			rangeEnd: targetDate,
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [
				{ topicNumber: topic1.number, lessonNumber: lesson2.number, date: targetDate },
			],
		});
		const result = detectDragConflicts({
			dragging: [{ topicNumber: topic1.number, lessonNumber: lesson1.number }],
			targetDate,
			calendarDays: calDays,
			blockedDays: new Set(),
		});
		expect(result.hasConflict).toBe(true);
		expect(result.displacedLessons.some((l) => l.lessonNumber === lesson2.number)).toBe(true);
	});
});

// ─── resolveDrag ──────────────────────────────────────────────────────────────

describe("resolveDrag", () => {
	const _topic1 = YAAG_TOPICS.find((t) => t.number === 1) ?? YAAG_TOPICS[0];
	const topic1 = _topic1;
	const lesson1 = topic1.lessons[0] ?? { number: "1.1", title: "" };
	const lesson2 = topic1.lessons[1] ?? { number: "1.2", title: "" };
	const effectiveTopics = computeEffectiveTopicDates([]);

	it("stack mode: places dragged lesson at target, does not move displaced", () => {
		const targetDate = "2026-09-01";
		const calDays = buildCalendarDays({
			rangeStart: targetDate,
			rangeEnd: targetDate,
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [
				{ topicNumber: topic1.number, lessonNumber: lesson2.number, date: targetDate },
			],
		});
		const result = resolveDrag({
			dragging: [{ topicNumber: topic1.number, lessonNumber: lesson1.number }],
			targetDate,
			cascadeMode: "stack",
			calendarDays: calDays,
			blockedDays: new Set(),
			allLessons: new Map(),
		});
		const placed = result.newPlacements.find((p) => p.lessonNumber === lesson1.number);
		expect(placed?.date).toBe(targetDate);
		// lesson2 should NOT appear in newPlacements (stack keeps it in place)
		const movedLesson2 = result.newPlacements.find((p) => p.lessonNumber === lesson2.number);
		expect(movedLesson2).toBeUndefined();
	});

	it("push_forward: displaced lesson follows the dragged lesson", () => {
		const targetDate = "2026-09-01"; // Monday
		const calDays = buildCalendarDays({
			rangeStart: targetDate,
			rangeEnd: targetDate,
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [
				{ topicNumber: topic1.number, lessonNumber: lesson2.number, date: targetDate },
			],
		});
		const result = resolveDrag({
			dragging: [{ topicNumber: topic1.number, lessonNumber: lesson1.number }],
			targetDate,
			cascadeMode: "push_forward",
			calendarDays: calDays,
			blockedDays: new Set(),
			allLessons: new Map(),
		});
		const placed1 = result.newPlacements.find((p) => p.lessonNumber === lesson1.number);
		const placed2 = result.newPlacements.find((p) => p.lessonNumber === lesson2.number);
		expect(placed1?.date).toBe(targetDate);
		// displaced lesson2 must land AFTER targetDate
		expect(placed2).toBeDefined();
		if (placed2) expect(placed2.date > targetDate).toBe(true);
	});

	it("always includes dragged lessons in deletedPlacements", () => {
		const targetDate = "2026-09-03"; // Wednesday, no conflict
		const calDays = buildCalendarDays({
			rangeStart: targetDate,
			rangeEnd: targetDate,
			effectiveTopics,
			blockedDays: [],
			explicitPlacements: [],
		});
		const result = resolveDrag({
			dragging: [{ topicNumber: topic1.number, lessonNumber: lesson1.number }],
			targetDate,
			cascadeMode: "push_forward",
			calendarDays: calDays,
			blockedDays: new Set(),
			allLessons: new Map(),
		});
		const deleted = result.deletedPlacements.find((p) => p.lessonNumber === lesson1.number);
		expect(deleted).toBeDefined();
	});

	it("skips blocked days when computing slots", () => {
		const targetDate = "2026-09-01"; // Monday — blocked
		const blockedSet = new Set(["2026-09-01"]);
		const calDays = buildCalendarDays({
			rangeStart: "2026-09-01",
			rangeEnd: "2026-09-05",
			effectiveTopics,
			blockedDays: [{ date: "2026-09-01", reason: null }],
			explicitPlacements: [],
		});
		const result = resolveDrag({
			dragging: [{ topicNumber: topic1.number, lessonNumber: lesson1.number }],
			targetDate,
			cascadeMode: "stack",
			calendarDays: calDays,
			blockedDays: blockedSet,
			allLessons: new Map(),
		});
		const placed = result.newPlacements.find((p) => p.lessonNumber === lesson1.number);
		// Should NOT land on the blocked day
		expect(placed?.date).not.toBe("2026-09-01");
	});
});
