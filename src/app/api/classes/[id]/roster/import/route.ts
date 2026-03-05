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

function parseRows(rawRows: string[][]): {
	rows: ParsedRow[];
	errors: string[];
} {
	const rows: ParsedRow[] = [];
	const errors: string[] = [];

	for (const cols of rawRows) {
		const studentId = cols[0]?.trim() ?? "";
		if (!studentId) continue;

		// Skip header rows
		if (
			studentId.toLowerCase() === "student_id" ||
			studentId.toLowerCase() === "studentid" ||
			studentId.toLowerCase() === "student id"
		) {
			continue;
		}

		let firstName: string | null = null;
		let lastName: string | null = null;
		let firstInitial = "";
		let lastInitial = "";
		let performanceScore: number | null = null;

		if (cols.length === 2) {
			// "student_id,Jordan Mitchell" or "student_id,J.M."
			const col1 = cols[1]?.trim() ?? "";
			if (col1.includes(" ")) {
				// Full name with space: "Jordan Mitchell"
				const parts = col1.split(/\s+/);
				firstName = parts[0] ?? null;
				lastName = parts.slice(1).join(" ") || null;
				firstInitial = firstName?.[0]?.toUpperCase() ?? "";
				lastInitial = lastName?.[0]?.toUpperCase() ?? "";
			} else {
				const parsed = parseInitials(col1);
				if (!parsed) {
					errors.push(`Cannot parse name from "${col1}" in row: "${cols.join(",")}"`);
					continue;
				}
				firstInitial = parsed.firstInitial;
				lastInitial = parsed.lastInitial;
			}
		} else if (cols.length >= 3) {
			const col1 = cols[1]?.trim() ?? "";
			const col2 = cols[2]?.trim() ?? "";

			if (isFullName(col1)) {
				// cols[1] = first_name, cols[2] = last_name, cols[3] = optional score
				firstName = col1 || null;
				lastName = col2 || null;
				firstInitial = firstName?.[0]?.toUpperCase() ?? "";
				lastInitial = lastName?.[0]?.toUpperCase() ?? "";
			} else {
				// cols[1] = first_initial, cols[2] = last_initial, cols[3] = optional score
				firstInitial = col1.replace(/\./g, "").toUpperCase();
				lastInitial = col2.replace(/\./g, "").toUpperCase();
			}

			// Check for performance score in col 3 or 4
			const scoreCol = cols[3] !== undefined ? cols[3] : undefined;
			if (scoreCol !== undefined && scoreCol !== "") {
				const parsed = parseInt(String(scoreCol).trim(), 10);
				if (!Number.isNaN(parsed)) performanceScore = parsed;
			}
		}

		if (!firstInitial) {
			errors.push(`Missing first name/initial in row: "${cols.join(",")}"`);
			continue;
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
