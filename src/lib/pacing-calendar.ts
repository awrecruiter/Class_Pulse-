/**
 * Pacing Calendar — pure compute library (no DB, no React)
 *
 * All functions are deterministic given their inputs. DB data is passed in as
 * plain objects so the layer can be tested without any mocking.
 */

import { YAAG_TOPICS, type YAAGLesson, type YAAGTopic } from "@/data/yaag-2025-2026";

// ─── Domain types ─────────────────────────────────────────────────────────────

export type CascadeMode = "push_forward" | "push_back" | "stack";

/** Raw DB row shapes (only the fields this library needs) */
export type DbPacingOverride = {
	topicNumber: number;
	startDate: string;
	cascadeMode: string;
};

export type DbBlockedDay = {
	date: string;
	reason: string | null;
};

export type DbLessonPlacement = {
	topicNumber: number;
	lessonNumber: string;
	date: string;
};

/** A single lesson placed on a calendar day */
export type PlacedLesson = {
	topicNumber: number;
	topicRoman: string;
	topicTitle: string;
	topicColor: string; // CSS class suffix for color band, e.g. "blue"
	lessonNumber: string;
	lessonTitle: string;
	isExplicit: boolean; // true = from a DB placement row (dragged by teacher)
};

/** One calendar cell */
export type CalendarDay = {
	date: string; // YYYY-MM-DD
	weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Date.getDay()
	isWeekend: boolean;
	isBlocked: boolean;
	blockReason?: string;
	isFastWindow: boolean;
	isToday: boolean;
	lessons: PlacedLesson[];
};

/** Conflict info returned before the teacher commits a drag */
export type ConflictInfo = {
	hasConflict: boolean;
	/** Existing lessons at / after the target range that would be displaced */
	displacedLessons: PlacedLesson[];
	/** How many lessons are being rescheduled (dragged group + displaced) */
	rescheduledCount: number;
};

export type DragResolution = {
	/** New explicit placements to upsert into DB */
	newPlacements: DbLessonPlacement[];
	/** Placement rows to delete (lessons moved away from their old date) */
	deletedPlacements: { topicNumber: number; lessonNumber: string }[];
	rescheduledCount: number;
};

// ─── Topic color palette ─────────────────────────────────────────────────────
// One color token per topic; wraps if more than palette length

const TOPIC_COLORS = [
	"blue",
	"emerald",
	"violet",
	"amber",
	"rose",
	"cyan",
	"orange",
	"teal",
	"fuchsia",
	"lime",
	"sky",
	"red",
	"indigo",
	"yellow",
	"pink",
	"green",
	"purple",
	"slate",
];

export function topicColor(topicNumber: number): string {
	return TOPIC_COLORS[(topicNumber - 1) % TOPIC_COLORS.length] ?? "slate";
}

// ─── Date utilities ───────────────────────────────────────────────────────────

/** Parse YYYY-MM-DD as local midnight (avoids UTC-shift) */
export function parseLocalDate(s: string): Date {
	const [y, m, d] = s.split("-").map(Number);
	return new Date(y ?? 2025, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Advance d by n calendar days, mutating a copy */
function addDays(d: Date, n: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

/** True for Mon–Fri */
function isWeekday(d: Date): boolean {
	const dow = d.getDay();
	return dow !== 0 && dow !== 6;
}

/** Count Mon–Fri days between start (inclusive) and end (inclusive) */
export function countWeekdays(start: Date, end: Date): number {
	let n = 0;
	const d = new Date(start);
	while (d <= end) {
		if (isWeekday(d)) n++;
		d.setDate(d.getDate() + 1);
	}
	return n;
}

/** Advance a date by exactly n weekdays (skipping Sat/Sun) */
export function addWeekdays(from: Date, n: number): Date {
	const d = new Date(from);
	let remaining = Math.abs(n);
	const dir = n >= 0 ? 1 : -1;
	while (remaining > 0) {
		d.setDate(d.getDate() + dir);
		if (isWeekday(d)) remaining--;
	}
	return d;
}

/** Weekday delta between two date strings (positive = b is later) */
function weekdayDelta(a: string, b: string): number {
	const da = parseLocalDate(a);
	const db = parseLocalDate(b);
	if (db >= da) return countWeekdays(da, addDays(db, -1));
	return -countWeekdays(db, addDays(da, -1));
}

// ─── Step 1: Effective topic date ranges ────────────────────────────────────

export type EffectiveTopic = {
	topic: YAAGTopic;
	startDate: string;
	endDate: string;
};

/**
 * Compute the effective start/end for each of the 18 topics, applying
 * teacher overrides. When a topic is overridden, downstream topics cascade
 * (push_forward / push_back) unless cascadeMode="stack" for that override.
 *
 * Overrides are processed in topicNumber order. Each override cascades only
 * forward (to higher-numbered topics); earlier topics are unaffected.
 */
export function computeEffectiveTopicDates(overrides: DbPacingOverride[]): EffectiveTopic[] {
	// Build a map from topicNumber → override
	const overrideMap = new Map(overrides.map((o) => [o.topicNumber, o]));

	// Sort topics by their YAAG number
	const sorted = [...YAAG_TOPICS].sort((a, b) => a.number - b.number);

	// Running weekday shift carried forward through topics
	let cumulativeDelta = 0;

	const result: EffectiveTopic[] = sorted.map((topic) => {
		const override = overrideMap.get(topic.number);

		// Base start = YAAG start shifted by any cumulative cascade
		const baseStart =
			cumulativeDelta === 0
				? topic.startDate
				: formatDate(addWeekdays(parseLocalDate(topic.startDate), cumulativeDelta));

		if (override) {
			const explicitStart = override.startDate;
			// Delta from where this topic would have landed to where teacher put it
			const thisDelta = weekdayDelta(baseStart, explicitStart);

			if (override.cascadeMode !== "stack") {
				// push_forward or push_back: propagate new total shift to later topics
				cumulativeDelta += thisDelta;
			}
			// stack: no cascade — later topics retain their original shifted positions

			// End date = shift the YAAG end date by the same total amount the start moved
			const totalShiftForThisTopic =
				cumulativeDelta - (override.cascadeMode !== "stack" ? 0 : thisDelta);
			const shiftedEnd =
				totalShiftForThisTopic + thisDelta === 0
					? topic.endDate
					: formatDate(
							addWeekdays(parseLocalDate(topic.endDate), totalShiftForThisTopic + thisDelta),
						);

			return { topic, startDate: explicitStart, endDate: shiftedEnd };
		}

		// No explicit override for this topic — apply running delta
		const effectiveStart =
			cumulativeDelta === 0
				? topic.startDate
				: formatDate(addWeekdays(parseLocalDate(topic.startDate), cumulativeDelta));

		const effectiveEnd =
			cumulativeDelta === 0
				? topic.endDate
				: formatDate(addWeekdays(parseLocalDate(topic.endDate), cumulativeDelta));

		return { topic, startDate: effectiveStart, endDate: effectiveEnd };
	});

	return result;
}

// ─── Step 2: Assign lessons to weekdays ─────────────────────────────────────

/**
 * Given the effective topic dates and a set of blocked days, assign each
 * lesson to a weekday (in order), skipping blocked days.
 * Returns a map from "topicNumber|lessonNumber" → computed date string.
 */
export function computeLessonDates(
	effectiveTopics: EffectiveTopic[],
	blockedDays: Set<string>,
): Map<string, string> {
	const result = new Map<string, string>();

	for (const { topic, startDate } of effectiveTopics) {
		if (topic.lessons.length === 0) continue;

		let cursor = parseLocalDate(startDate);

		// Advance past weekends and blocked days for lesson 1 (launch day = startDate itself)
		while (!isWeekday(cursor) || blockedDays.has(formatDate(cursor))) {
			cursor = addDays(cursor, 1);
		}

		for (const lesson of topic.lessons) {
			const key = `${topic.number}|${lesson.number}`;
			result.set(key, formatDate(cursor));

			// Find next instructional day for the next lesson
			cursor = addDays(cursor, 1);
			while (!isWeekday(cursor) || blockedDays.has(formatDate(cursor))) {
				cursor = addDays(cursor, 1);
			}
		}
	}

	return result;
}

// ─── Step 3: Build CalendarDay array ────────────────────────────────────────

const FAST_START = "2026-05-01";
const FAST_END = "2026-05-29";

/**
 * Build an array of CalendarDay objects for [rangeStart, rangeEnd].
 * Includes weekends (isWeekend=true, no lessons) for layout purposes.
 */
export function buildCalendarDays(params: {
	rangeStart: string;
	rangeEnd: string;
	effectiveTopics: EffectiveTopic[];
	blockedDays: DbBlockedDay[];
	explicitPlacements: DbLessonPlacement[];
	today?: string;
}): CalendarDay[] {
	const { rangeStart, rangeEnd, effectiveTopics, blockedDays, explicitPlacements, today } = params;
	const todayStr = today ?? formatDate(new Date());

	const blockedSet = new Set(blockedDays.map((b) => b.date));
	const blockedReasonMap = new Map(blockedDays.map((b) => [b.date, b.reason ?? undefined]));

	// Build computed lesson dates
	const computedDates = computeLessonDates(effectiveTopics, blockedSet);

	// Build explicit placement lookup: "topicNumber|lessonNumber" → date
	const explicitMap = new Map(
		explicitPlacements.map((p) => [`${p.topicNumber}|${p.lessonNumber}`, p.date]),
	);

	// Build a lookup: date → PlacedLesson[]
	const dayLessons = new Map<string, PlacedLesson[]>();

	// Helper to get or create day lesson array
	const forDay = (d: string): PlacedLesson[] => {
		if (!dayLessons.has(d)) dayLessons.set(d, []);
		return dayLessons.get(d) ?? [];
	};

	// Build a lesson-by-key lookup for titles
	const lessonMeta = new Map<string, { lesson: YAAGLesson; topic: YAAGTopic }>();
	for (const { topic } of effectiveTopics) {
		for (const lesson of topic.lessons) {
			lessonMeta.set(`${topic.number}|${lesson.number}`, { lesson, topic });
		}
	}

	// Place all lessons
	for (const [key, computedDate] of computedDates) {
		const explicit = explicitMap.get(key);
		const targetDate = explicit ?? computedDate;
		const meta = lessonMeta.get(key);
		if (!meta) continue;

		forDay(targetDate).push({
			topicNumber: meta.topic.number,
			topicRoman: meta.topic.roman,
			topicTitle: meta.topic.title,
			topicColor: topicColor(meta.topic.number),
			lessonNumber: meta.lesson.number,
			lessonTitle: meta.lesson.title,
			isExplicit: !!explicit,
		});
	}

	// Generate all days in range
	const days: CalendarDay[] = [];
	let cursor = parseLocalDate(rangeStart);
	const end = parseLocalDate(rangeEnd);

	while (cursor <= end) {
		const dateStr = formatDate(cursor);
		const dow = cursor.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
		const weekend = dow === 0 || dow === 6;

		days.push({
			date: dateStr,
			weekday: dow,
			isWeekend: weekend,
			isBlocked: !weekend && blockedSet.has(dateStr),
			blockReason: blockedReasonMap.get(dateStr),
			isFastWindow: dateStr >= FAST_START && dateStr <= FAST_END,
			isToday: dateStr === todayStr,
			lessons: weekend ? [] : (dayLessons.get(dateStr) ?? []),
		});

		cursor = addDays(cursor, 1);
	}

	return days;
}

// ─── Step 4: Drag conflict detection ────────────────────────────────────────

export type LessonRef = { topicNumber: number; lessonNumber: string };

/**
 * Detect conflicts when dragging `dragging` lessons to start at `targetDate`.
 * A conflict is any lesson already on a day that the dragged group would occupy.
 */
export function detectDragConflicts(params: {
	dragging: LessonRef[];
	targetDate: string;
	calendarDays: CalendarDay[];
	blockedDays: Set<string>;
}): ConflictInfo {
	const { dragging, targetDate, calendarDays, blockedDays } = params;

	// Find the weekday slots needed for the dragged lessons (skip blocked days)
	const slots = computeTargetSlots(targetDate, dragging.length, blockedDays);

	// Build a set of dragging keys
	const draggingKeys = new Set(dragging.map((l) => `${l.topicNumber}|${l.lessonNumber}`));

	// Find existing lessons in those slots that are NOT part of the drag group
	const displaced: PlacedLesson[] = [];
	const dayMap = new Map(calendarDays.map((d) => [d.date, d]));

	for (const slot of slots) {
		const day = dayMap.get(slot);
		if (!day) continue;
		for (const lesson of day.lessons) {
			const key = `${lesson.topicNumber}|${lesson.lessonNumber}`;
			if (!draggingKeys.has(key)) displaced.push(lesson);
		}
	}

	return {
		hasConflict: displaced.length > 0,
		displacedLessons: displaced,
		rescheduledCount: dragging.length + displaced.length,
	};
}

/** Compute the ordered list of weekday dates starting at targetDate, skipping blocked days */
function computeTargetSlots(startDate: string, count: number, blockedDays: Set<string>): string[] {
	const slots: string[] = [];
	let cursor = parseLocalDate(startDate);
	while (slots.length < count) {
		const d = formatDate(cursor);
		if (isWeekday(cursor) && !blockedDays.has(d)) slots.push(d);
		cursor = addDays(cursor, 1);
	}
	return slots;
}

// ─── Step 5: Resolve drag operation ─────────────────────────────────────────

/**
 * Apply a drag operation to produce new DB placement rows.
 *
 * - stack: dragged lessons are added to the target days; displaced lessons stay put
 * - push_forward: dragged lessons placed first; displaced lessons follow immediately after
 * - push_back: displaced lessons keep their positions; dragged lessons placed starting
 *   after the last displaced lesson's slot
 */
export function resolveDrag(params: {
	dragging: LessonRef[];
	targetDate: string;
	cascadeMode: CascadeMode;
	calendarDays: CalendarDay[];
	blockedDays: Set<string>;
	allLessons: Map<string, { topicNumber: number; lessonNumber: string }>;
}): DragResolution {
	const { dragging, targetDate, cascadeMode, calendarDays, blockedDays } = params;

	const conflicts = detectDragConflicts({ dragging, targetDate, calendarDays, blockedDays });

	const deletedPlacements = dragging.map((l) => ({
		topicNumber: l.topicNumber,
		lessonNumber: l.lessonNumber,
	}));

	if (cascadeMode === "stack" || !conflicts.hasConflict) {
		// Place dragged lessons at target slots; leave displaced lessons alone
		const slots = computeTargetSlots(targetDate, dragging.length, blockedDays);
		const newPlacements: DbLessonPlacement[] = dragging.map((lesson, i) => ({
			topicNumber: lesson.topicNumber,
			lessonNumber: lesson.lessonNumber,
			date: slots[i] ?? targetDate,
		}));
		return { newPlacements, deletedPlacements, rescheduledCount: dragging.length };
	}

	if (cascadeMode === "push_forward") {
		// Dragged lessons take the target slots; displaced lessons get pushed to after
		const slots = computeTargetSlots(targetDate, dragging.length, blockedDays);
		const afterTarget = slots[slots.length - 1];
		const displacedSlotStart = afterTarget
			? formatDate(addDays(parseLocalDate(afterTarget), 1))
			: targetDate;
		const displacedSlots = computeTargetSlots(
			displacedSlotStart,
			conflicts.displacedLessons.length,
			blockedDays,
		);

		const dragPlacements: DbLessonPlacement[] = dragging.map((lesson, i) => ({
			topicNumber: lesson.topicNumber,
			lessonNumber: lesson.lessonNumber,
			date: slots[i] ?? targetDate,
		}));

		const displacedPlacements: DbLessonPlacement[] = conflicts.displacedLessons.map(
			(lesson, i) => ({
				topicNumber: lesson.topicNumber,
				lessonNumber: lesson.lessonNumber,
				date: displacedSlots[i] ?? displacedSlotStart,
			}),
		);

		return {
			newPlacements: [...dragPlacements, ...displacedPlacements],
			deletedPlacements,
			rescheduledCount: conflicts.rescheduledCount,
		};
	}

	// push_back: displaced lessons keep their spots; dragged lessons go after
	const displacedDates = new Set(
		conflicts.displacedLessons.map((l) => {
			const day = calendarDays.find((d) =>
				d.lessons.some(
					(dl) => dl.topicNumber === l.topicNumber && dl.lessonNumber === l.lessonNumber,
				),
			);
			return day?.date ?? "";
		}),
	);

	// Find last date occupied by displaced lessons
	const sortedDisplaced = [...displacedDates].filter(Boolean).sort();
	const lastDisplacedDate = sortedDisplaced[sortedDisplaced.length - 1];
	const pushBackStart = lastDisplacedDate
		? formatDate(addDays(parseLocalDate(lastDisplacedDate), 1))
		: targetDate;

	const slots = computeTargetSlots(pushBackStart, dragging.length, blockedDays);
	const newPlacements: DbLessonPlacement[] = dragging.map((lesson, i) => ({
		topicNumber: lesson.topicNumber,
		lessonNumber: lesson.lessonNumber,
		date: slots[i] ?? pushBackStart,
	}));

	return {
		newPlacements,
		deletedPlacements,
		rescheduledCount: conflicts.rescheduledCount,
	};
}
