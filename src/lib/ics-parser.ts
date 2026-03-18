export type ProposedBlock = {
	title: string;
	startTime: string; // HH:MM
	endTime: string; // HH:MM
	dayOfWeek: number | null;
	color: string;
};

const BYDAY_MAP: Record<string, number> = {
	SU: 0,
	MO: 1,
	TU: 2,
	WE: 3,
	TH: 4,
	FR: 5,
	SA: 6,
};

function parseHHMM(dtStr: string): string | null {
	// Strip TZID prefix: "TZID=America/New_York:20260317T083000" → "20260317T083000"
	const clean = dtStr.includes(":") ? dtStr.split(":").slice(-1)[0] : dtStr;

	// Skip date-only values (no T)
	if (!clean.includes("T")) return null;

	const timePart = clean.split("T")[1];
	if (!timePart || timePart.length < 4) return null;

	const hh = timePart.slice(0, 2);
	const mm = timePart.slice(2, 4);

	const hour = parseInt(hh, 10);
	const minute = parseInt(mm, 10);
	if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

	// If UTC (ends with Z), convert to local time via Date
	if (timePart.endsWith("Z") || clean.endsWith("Z")) {
		// Reconstruct full ISO date
		const datePart = clean.replace("Z", "").split("T")[0];
		if (!datePart || datePart.length < 8) return null;
		const year = datePart.slice(0, 4);
		const mon = datePart.slice(4, 6);
		const day = datePart.slice(6, 8);
		const d = new Date(`${year}-${mon}-${day}T${hh}:${mm}:00Z`);
		if (Number.isNaN(d.getTime())) return null;
		return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	}

	return `${hh}:${mm}`;
}

function parseDayOfWeek(dtStr: string): number | null {
	const clean = dtStr.includes(":") ? dtStr.split(":").slice(-1)[0] : dtStr;
	if (!clean.includes("T")) return null;

	if (clean.endsWith("Z")) {
		const datePart = clean.replace("Z", "").split("T")[0];
		if (!datePart || datePart.length < 8) return null;
		const year = datePart.slice(0, 4);
		const mon = datePart.slice(4, 6);
		const day = datePart.slice(6, 8);
		const timePart = clean.split("T")[1].replace("Z", "");
		const hh = timePart.slice(0, 2);
		const mm = timePart.slice(2, 4);
		const d = new Date(`${year}-${mon}-${day}T${hh}:${mm}:00Z`);
		if (Number.isNaN(d.getTime())) return null;
		return d.getDay();
	}

	const datePart = clean.split("T")[0];
	if (!datePart || datePart.length < 8) return null;
	const year = datePart.slice(0, 4);
	const mon = datePart.slice(4, 6);
	const day = datePart.slice(6, 8);
	const d = new Date(`${year}-${mon}-${day}`);
	if (Number.isNaN(d.getTime())) return null;
	return d.getDay();
}

/**
 * Parse a raw .ics string into proposed schedule blocks.
 * Handles VEVENT components only.
 */
export function parseIcs(content: string): ProposedBlock[] {
	const blocks: ProposedBlock[] = [];

	// Split into VEVENT sections
	const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
	let match = veventRegex.exec(content);

	while (match !== null) {
		const vevent = match[1];

		// Extract property values (handle line folding: lines starting with space/tab continue previous)
		const unfolded = vevent.replace(/\r?\n[ \t]/g, "");
		const lines = unfolded.split(/\r?\n/);

		let summary = "";
		let dtstart = "";
		let dtend = "";
		let rrule = "";

		for (const line of lines) {
			const colonIdx = line.indexOf(":");
			if (colonIdx === -1) continue;
			const key = line.slice(0, colonIdx).toUpperCase();
			const value = line.slice(colonIdx + 1).trim();

			if (key === "SUMMARY") {
				summary = value;
			} else if (key.startsWith("DTSTART")) {
				// key may be "DTSTART" or "DTSTART;TZID=..." or "DTSTART;VALUE=DATE"
				if (key.includes("VALUE=DATE")) {
					// all-day — skip
					dtstart = "";
				} else {
					// Pass the full original line's value (strip TZID part if present via key)
					dtstart = key.includes("TZID") ? `${key}:${value}` : value;
				}
			} else if (key.startsWith("DTEND")) {
				if (!key.includes("VALUE=DATE")) {
					dtend = key.includes("TZID") ? `${key}:${value}` : value;
				}
			} else if (key === "RRULE") {
				rrule = value;
			}
		}

		if (!summary || !dtstart || !dtend) continue;

		const startTime = parseHHMM(dtstart);
		const endTime = parseHHMM(dtend);
		if (!startTime || !endTime) continue;

		// Check RRULE for BYDAY
		const bydayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
		if (bydayMatch) {
			const days = bydayMatch[1].split(",");
			for (const dayCode of days) {
				const dow = BYDAY_MAP[dayCode.trim()];
				if (dow !== undefined) {
					blocks.push({
						title: summary,
						startTime,
						endTime,
						dayOfWeek: dow,
						color: "blue",
					});
				}
			}
		} else {
			// Non-recurring: use day from DTSTART
			const dow = parseDayOfWeek(dtstart);
			blocks.push({
				title: summary,
				startTime,
				endTime,
				dayOfWeek: dow,
				color: "blue",
			});
		}
		match = veventRegex.exec(content);
	}

	return blocks;
}
