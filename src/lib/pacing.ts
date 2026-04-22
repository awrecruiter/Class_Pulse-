import { FAST_WINDOW, YAAG_TOPICS, type YAAGLesson, type YAAGTopic } from "@/data/yaag-2025-2026";

export type TodayPacing = {
	topic: YAAGTopic;
	/** Best-guess current lesson based on date (null for review/G6-prep topics) */
	currentLesson: YAAGLesson | null;
	/** Pre-filled homework suggestion for the assignment input */
	homeworkSuggestion: string | null;
	/** Days remaining in this topic (instructional days, approximate) */
	daysLeft: number;
	/** Is today inside the FAST testing window */
	isFastWindow: boolean;
};

function dateStr(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date {
	// Parse as local date to avoid UTC offset shifting the day
	const [y, m, day] = s.split("-").map(Number);
	return new Date(y, (m ?? 1) - 1, day ?? 1);
}

/** Count weekdays (Mon–Fri) between two dates inclusive */
function weekdaysBetween(start: Date, end: Date): number {
	let count = 0;
	const d = new Date(start);
	while (d <= end) {
		const dow = d.getDay();
		if (dow !== 0 && dow !== 6) count++;
		d.setDate(d.getDate() + 1);
	}
	return count;
}

export function getTodayPacing(date?: Date, topicOverride?: number | null): TodayPacing | null {
	const today = date ?? new Date();
	const todayStr = dateStr(today);

	const topic =
		topicOverride != null
			? (YAAG_TOPICS.find((t) => t.number === topicOverride) ?? null)
			: (YAAG_TOPICS.find((t) => t.startDate <= todayStr && t.endDate >= todayStr) ?? null);

	if (!topic) return null;

	// Check FAST window
	const isFastWindow = FAST_WINDOW.start <= todayStr && FAST_WINDOW.end >= todayStr;

	// Approximate days left in topic
	const topicEnd = parseDate(topic.endDate);
	const daysLeft = Math.max(0, weekdaysBetween(today, topicEnd));

	// Find current lesson
	let currentLesson: YAAGLesson | null = null;
	let homeworkSuggestion: string | null = null;

	if (topic.isReview || topic.isG6Prep || topic.lessons.length === 0) {
		currentLesson = null;
		homeworkSuggestion = topic.isReview
			? "FAST Spiral Review — iReady Individual Learning Path"
			: null;
	} else {
		// First check exact lesson date match (only Topic XIV has these)
		const exactMatch = topic.lessons.find((l) => l.lessonDate === todayStr);
		if (exactMatch) {
			currentLesson = exactMatch;
			homeworkSuggestion = exactMatch.homeworkRef ?? null;
		} else {
			// Estimate by how far we are through the topic date range
			const topicStart = parseDate(topic.startDate);
			const elapsed = weekdaysBetween(topicStart, today);
			// lessons run on days 2+ (day 1 is launch); cap to available lessons
			const lessonIdx = Math.max(0, Math.min(elapsed - 1, topic.lessons.length - 1));
			currentLesson = topic.lessons[lessonIdx] ?? topic.lessons[topic.lessons.length - 1] ?? null;
			if (currentLesson?.homeworkRef) {
				homeworkSuggestion = currentLesson.homeworkRef;
			} else if (currentLesson?.number) {
				homeworkSuggestion = `Lesson ${currentLesson.number} Practice`;
			}
		}
	}

	return { topic, currentLesson, homeworkSuggestion, daysLeft, isFastWindow };
}

/** Returns the topic covering a given date string YYYY-MM-DD, or null */
export function getTopicForDate(dateString: string): YAAGTopic | null {
	return YAAG_TOPICS.find((t) => t.startDate <= dateString && t.endDate >= dateString) ?? null;
}
