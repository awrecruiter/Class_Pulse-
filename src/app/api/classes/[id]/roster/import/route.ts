import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

function parseInitials(raw: string): { firstInitial: string; lastInitial: string } | null {
	// Accept "J.M.", "JM", "J M", "J", etc.
	const cleaned = raw.trim().replace(/\./g, "").replace(/\s+/g, "");
	if (cleaned.length === 2) {
		return {
			firstInitial: cleaned[0]?.toUpperCase() ?? "",
			lastInitial: cleaned[1]?.toUpperCase() ?? "",
		};
	}
	if (cleaned.length === 1) {
		return { firstInitial: cleaned[0]?.toUpperCase() ?? "", lastInitial: "" };
	}
	return null;
}

type ParsedRow = {
	studentId: string;
	firstName: string | null;
	lastName: string | null;
	firstInitial: string;
	lastInitial: string;
	performanceScore: number | null;
};

// Detect if a column looks like a full name (more than 2 chars, no dots)
function isFullName(s: string): boolean {
	const cleaned = s.trim().replace(/\./g, "");
	return cleaned.length > 1;
}

// Normalize header names to canonical keys
function normalizeHeader(h: string): string {
	return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Detect column indices from header row; returns null if no header found
function detectColumns(firstRow: string[]): {
	studentIdIdx: number;
	firstNameIdx: number;
	lastNameIdx: number;
	scoreIdx: number;
} | null {
	const normalized = firstRow.map(normalizeHeader);
	const idIdx = normalized.findIndex((h) =>
		["studentid", "studentnumber", "id", "stuid", "stunum", "idnumber"].includes(h),
	);
	const fnIdx = normalized.findIndex((h) =>
		["firstname", "fname", "first", "given", "givenname"].includes(h),
	);
	const lnIdx = normalized.findIndex((h) =>
		["lastname", "lname", "last", "surname", "family", "familyname"].includes(h),
	);
	const scoreIdx = normalized.findIndex((h) =>
		["score", "performance", "performancescore", "level", "lexile"].includes(h),
	);
	// Only treat as header if at least one recognizable column found
	if (idIdx === -1 && fnIdx === -1 && lnIdx === -1) return null;
	return {
		studentIdIdx: idIdx,
		firstNameIdx: fnIdx,
		lastNameIdx: lnIdx,
		scoreIdx,
	};
}

function parseRows(rawRows: string[][]): {
	rows: ParsedRow[];
	errors: string[];
} {
	const rows: ParsedRow[] = [];
	const errors: string[] = [];
	if (rawRows.length === 0) return { rows, errors };

	// Try to detect column mapping from first row
	let dataRows = rawRows;
	let idIdx = 0;
	let fnIdx = 1;
	let lnIdx = -1;
	let scoreIdx = -1;

	const colMap = detectColumns(rawRows[0] ?? []);
	if (colMap !== null) {
		// First row is a header
		dataRows = rawRows.slice(1);
		idIdx = colMap.studentIdIdx >= 0 ? colMap.studentIdIdx : 0;
		fnIdx = colMap.firstNameIdx >= 0 ? colMap.firstNameIdx : idIdx === 0 ? 1 : 0;
		lnIdx = colMap.lastNameIdx;
		scoreIdx = colMap.scoreIdx;
	}

	for (const cols of dataRows) {
		const studentId = cols[idIdx]?.trim().replace(/\.+$/, "") ?? "";
		if (!studentId) continue;

		// Skip any stray header-looking rows
		if (["student_id", "studentid", "student id", "id"].includes(studentId.toLowerCase())) continue;

		let firstName: string | null = null;
		let lastName: string | null = null;
		let firstInitial = "";
		let lastInitial = "";
		let performanceScore: number | null = null;

		// First name column
		const rawFirst = fnIdx >= 0 ? (cols[fnIdx]?.trim().replace(/\.+$/, "") ?? "") : "";

		if (lnIdx >= 0) {
			// Separate first + last columns
			firstName = rawFirst || null;
			lastName = cols[lnIdx]?.trim().replace(/\.+$/, "") || null;
			firstInitial = firstName?.[0]?.toUpperCase() ?? "";
			lastInitial = lastName?.[0]?.toUpperCase() ?? "";
		} else if (rawFirst.includes(" ")) {
			// "Jordan Mitchell" in a single column
			const parts = rawFirst.split(/\s+/);
			firstName = parts[0] ?? null;
			lastName = parts.slice(1).join(" ") || null;
			firstInitial = firstName?.[0]?.toUpperCase() ?? "";
			lastInitial = lastName?.[0]?.toUpperCase() ?? "";
		} else if (rawFirst) {
			// Single token — could be initials "J.M." or just first name "Jordan"
			const parsed = parseInitials(rawFirst);
			if (parsed) {
				firstInitial = parsed.firstInitial;
				lastInitial = parsed.lastInitial;
			} else {
				// Treat as first name only
				firstName = rawFirst;
				firstInitial = rawFirst[0]?.toUpperCase() ?? "";
			}
		} else if (colMap === null && cols.length >= 3) {
			// No header detected, fallback: col1=first, col2=last
			const col1 = cols[1]?.trim() ?? "";
			const col2 = cols[2]?.trim() ?? "";
			if (isFullName(col1)) {
				firstName = col1 || null;
				lastName = col2 || null;
				firstInitial = firstName?.[0]?.toUpperCase() ?? "";
				lastInitial = lastName?.[0]?.toUpperCase() ?? "";
			} else {
				firstInitial = col1.replace(/\./g, "").toUpperCase();
				lastInitial = col2.replace(/\./g, "").toUpperCase();
			}
		}

		if (!firstInitial) {
			errors.push(`Missing name in row: "${cols.join(",")}"`);
			continue;
		}

		// Performance score
		if (scoreIdx >= 0 && cols[scoreIdx] !== undefined && cols[scoreIdx] !== "") {
			const parsed = parseInt(String(cols[scoreIdx]).trim(), 10);
			if (!Number.isNaN(parsed)) performanceScore = parsed;
		}

		rows.push({ studentId, firstName, lastName, firstInitial, lastInitial, performanceScore });
	}

	return { rows, errors };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const contentType = request.headers.get("content-type") ?? "";
	const isXlsx =
		contentType.includes("application/octet-stream") ||
		contentType.includes("spreadsheetml") ||
		contentType.includes("excel");

	let rawRows: string[][];

	if (isXlsx) {
		const arrayBuffer = await request.arrayBuffer();
		const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
		const firstSheetName = workbook.SheetNames[0];
		if (!firstSheetName) {
			return NextResponse.json({ error: "Empty workbook" }, { status: 400 });
		}
		const ws = workbook.Sheets[firstSheetName];
		if (!ws) {
			return NextResponse.json({ error: "Empty sheet" }, { status: 400 });
		}
		const jsonRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
		rawRows = jsonRows.map((row) => (row as unknown[]).map((cell) => String(cell ?? "").trim()));
	} else {
		const csvText = await request.text();
		rawRows = csvText
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
			.map((line) => line.split(",").map((c) => c.trim()));
	}

	const { rows, errors } = parseRows(rawRows);

	const added: string[] = [];
	const skipped: string[] = [];

	for (const row of rows) {
		try {
			const result = await db
				.insert(rosterEntries)
				.values({
					classId,
					studentId: row.studentId,
					firstName: row.firstName,
					lastName: row.lastName,
					firstInitial: row.firstInitial,
					lastInitial: row.lastInitial,
					...(row.performanceScore !== null ? { performanceScore: row.performanceScore } : {}),
				})
				.onConflictDoUpdate({
					target: [rosterEntries.classId, rosterEntries.studentId],
					set: {
						firstName: row.firstName,
						lastName: row.lastName,
						firstInitial: row.firstInitial,
						lastInitial: row.lastInitial,
						isActive: true,
						...(row.performanceScore !== null ? { performanceScore: row.performanceScore } : {}),
					},
				})
				.returning({ id: rosterEntries.id });

			if (result.length > 0) {
				added.push(row.studentId);
			} else {
				skipped.push(row.studentId);
			}
		} catch {
			errors.push(`Error inserting student ${row.studentId}`);
		}
	}

	return NextResponse.json({ added: added.length, skipped: skipped.length, errors });
}
