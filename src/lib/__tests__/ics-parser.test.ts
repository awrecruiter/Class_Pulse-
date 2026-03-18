import { describe, expect, it } from "vitest";
import { parseIcs } from "@/lib/ics-parser";

// ── ICS helpers ──────────────────────────────────────────────────────────────

function makeVevent(lines: string[]): string {
	return ["BEGIN:VCALENDAR", "BEGIN:VEVENT", ...lines, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

describe("parseIcs — basic parsing", () => {
	it("parses a single non-recurring event", () => {
		const ics = makeVevent([
			"SUMMARY:Math Block",
			"DTSTART:20260317T083000",
			"DTEND:20260317T093000",
		]);
		const blocks = parseIcs(ics);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({
			title: "Math Block",
			startTime: "08:30",
			endTime: "09:30",
			color: "blue",
		});
	});

	it("returns empty array for empty string", () => {
		expect(parseIcs("")).toHaveLength(0);
	});

	it("returns empty array when no VEVENT blocks", () => {
		expect(parseIcs("BEGIN:VCALENDAR\r\nEND:VCALENDAR")).toHaveLength(0);
	});

	it("skips events with no SUMMARY", () => {
		const ics = makeVevent(["DTSTART:20260317T083000", "DTEND:20260317T093000"]);
		expect(parseIcs(ics)).toHaveLength(0);
	});

	it("skips all-day events (VALUE=DATE)", () => {
		const ics = makeVevent([
			"SUMMARY:Day Off",
			"DTSTART;VALUE=DATE:20260317",
			"DTEND;VALUE=DATE:20260318",
		]);
		expect(parseIcs(ics)).toHaveLength(0);
	});
});

describe("parseIcs — RRULE BYDAY expansion", () => {
	it("expands RRULE BYDAY=MO,WE,FR into 3 blocks", () => {
		const ics = makeVevent([
			"SUMMARY:Reading",
			"DTSTART:20260317T090000",
			"DTEND:20260317T100000",
			"RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
		]);
		const blocks = parseIcs(ics);
		expect(blocks).toHaveLength(3);
		const dows = blocks.map((b) => b.dayOfWeek).sort();
		expect(dows).toEqual([1, 3, 5]); // MO=1, WE=3, FR=5
	});

	it("expands BYDAY=TU,TH into 2 blocks", () => {
		const ics = makeVevent([
			"SUMMARY:Science",
			"DTSTART:20260317T110000",
			"DTEND:20260317T120000",
			"RRULE:FREQ=WEEKLY;BYDAY=TU,TH",
		]);
		const blocks = parseIcs(ics);
		expect(blocks).toHaveLength(2);
		const dows = blocks.map((b) => b.dayOfWeek).sort();
		expect(dows).toEqual([2, 4]); // TU=2, TH=4
	});

	it("sets all block titles from SUMMARY", () => {
		const ics = makeVevent([
			"SUMMARY:Math",
			"DTSTART:20260317T080000",
			"DTEND:20260317T090000",
			"RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
		]);
		const blocks = parseIcs(ics);
		expect(blocks).toHaveLength(5);
		for (const b of blocks) {
			expect(b.title).toBe("Math");
		}
	});
});

describe("parseIcs — TZID handling", () => {
	it("parses DTSTART with TZID prefix", () => {
		const ics = makeVevent([
			"SUMMARY:Block",
			"DTSTART;TZID=America/New_York:20260317T083000",
			"DTEND;TZID=America/New_York:20260317T093000",
		]);
		const blocks = parseIcs(ics);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.startTime).toBe("08:30");
		expect(blocks[0]?.endTime).toBe("09:30");
	});
});

describe("parseIcs — multiple events", () => {
	it("parses multiple VEVENT blocks", () => {
		const ics = [
			"BEGIN:VCALENDAR",
			"BEGIN:VEVENT",
			"SUMMARY:Morning Meeting",
			"DTSTART:20260317T080000",
			"DTEND:20260317T083000",
			"END:VEVENT",
			"BEGIN:VEVENT",
			"SUMMARY:Math",
			"DTSTART:20260317T090000",
			"DTEND:20260317T100000",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");

		const blocks = parseIcs(ics);
		expect(blocks).toHaveLength(2);
		expect(blocks[0]?.title).toBe("Morning Meeting");
		expect(blocks[1]?.title).toBe("Math");
	});
});

describe("parseIcs — line folding", () => {
	it("handles folded lines (continuation with leading space)", () => {
		const ics = [
			"BEGIN:VCALENDAR",
			"BEGIN:VEVENT",
			"SUMMARY:Long Title That Was",
			" Folded Here",
			"DTSTART:20260317T083000",
			"DTEND:20260317T093000",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");

		const blocks = parseIcs(ics);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.title).toBe("Long Title That WasFolded Here");
	});
});
