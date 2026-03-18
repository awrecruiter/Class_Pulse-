const DAY_NAMES: Record<string, number> = {
	sunday: 0,
	sun: 0,
	monday: 1,
	mon: 1,
	tuesday: 2,
	tue: 2,
	wednesday: 3,
	wed: 3,
	thursday: 4,
	thu: 4,
	friday: 5,
	fri: 5,
	saturday: 6,
	sat: 6,
};

const MONTH_NAMES: Record<string, number> = {
	january: 0,
	jan: 0,
	february: 1,
	feb: 1,
	march: 2,
	mar: 2,
	april: 3,
	apr: 3,
	may: 4,
	june: 5,
	jun: 5,
	july: 6,
	jul: 6,
	august: 7,
	aug: 7,
	september: 8,
	sep: 8,
	sept: 8,
	october: 9,
	oct: 9,
	november: 10,
	nov: 10,
	december: 11,
	dec: 11,
};

function toYMD(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export function resolveReminderDate(phrase: string, today: Date): string | null {
	const lower = phrase.toLowerCase().trim();

	if (/^today$/.test(lower)) return toYMD(today);

	if (/^tomorrow$/.test(lower)) {
		const d = new Date(today);
		d.setDate(d.getDate() + 1);
		return toYMD(d);
	}

	// "next [day]" — the occurrence in next calendar week (Sun–Sat)
	const nextMatch = lower.match(
		/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)$/,
	);
	if (nextMatch) {
		const targetDow = DAY_NAMES[nextMatch[1]] ?? 0;
		const todayDow = today.getDay();
		// Start of next week's Sunday = today + (7 - todayDow) days
		const daysToNextSunday = 7 - todayDow;
		const d = new Date(today);
		d.setDate(d.getDate() + daysToNextSunday + targetDow);
		return toYMD(d);
	}

	// Bare day name — nearest FUTURE occurrence; same-day → 7 days out
	const dayMatch = lower.match(
		/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)$/,
	);
	if (dayMatch) {
		const targetDow = DAY_NAMES[dayMatch[1]] ?? 0;
		const todayDow = today.getDay();
		const d = new Date(today);
		const delta = (targetDow - todayDow + 7) % 7 || 7; // 0 → 7 (next week same day)
		d.setDate(d.getDate() + delta);
		return toYMD(d);
	}

	// "March 25th", "March 25", "April 3rd" — current or next year
	const monthDayMatch = lower.match(
		/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?$/,
	);
	if (monthDayMatch) {
		const month = MONTH_NAMES[monthDayMatch[1]];
		const day = parseInt(monthDayMatch[2], 10);
		if (month === undefined || day < 1 || day > 31) return null;
		const candidate = new Date(today.getFullYear(), month, day);
		if (candidate < today) candidate.setFullYear(today.getFullYear() + 1);
		return toYMD(candidate);
	}

	// "the 25th", "the 3rd" — nearest future occurrence of that day of month
	const ordinalMatch = lower.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)$/);
	if (ordinalMatch) {
		const targetDay = parseInt(ordinalMatch[1], 10);
		if (targetDay < 1 || targetDay > 31) return null;
		const candidate = new Date(today.getFullYear(), today.getMonth(), targetDay);
		if (candidate <= today) candidate.setMonth(candidate.getMonth() + 1);
		return toYMD(candidate);
	}

	// Already YYYY-MM-DD (passed from voice agent)
	if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;

	return null;
}
