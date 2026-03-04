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
	firstInitial: string;
	lastInitial: string;
	performanceScore: number | null;
};

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

		let firstInitial = "";
		let lastInitial = "";
		let performanceScore: number | null = null;

		if (cols.length === 2) {
			// "student_id,J.M." or "student_id,JM"
			const parsed = parseInitials(cols[1] ?? "");
			if (!parsed) {
				errors.push(`Cannot parse initials from "${cols[1]}" in row: "${cols.join(",")}"`);
				continue;
			}
			firstInitial = parsed.firstInitial;
			lastInitial = parsed.lastInitial;
		} else if (cols.length >= 3) {
			// cols[1] = first_initial, cols[2] = last_initial, cols[3] = optional score
			firstInitial = (cols[1] ?? "").replace(/\./g, "").trim().toUpperCase();
			lastInitial = (cols[2] ?? "").replace(/\./g, "").trim().toUpperCase();

			if (cols[3] !== undefined && cols[3] !== "") {
				const parsed = parseInt(String(cols[3]).trim(), 10);
				if (!Number.isNaN(parsed)) {
					performanceScore = parsed;
				}
			}
		}

		if (!firstInitial) {
			errors.push(`Missing first initial in row: "${cols.join(",")}"`);
			continue;
		}

		rows.push({ studentId, firstInitial, lastInitial, performanceScore });
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
					firstInitial: row.firstInitial,
					lastInitial: row.lastInitial,
					...(row.performanceScore !== null ? { performanceScore: row.performanceScore } : {}),
				})
				.onConflictDoUpdate({
					target: [rosterEntries.classId, rosterEntries.studentId],
					set: {
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
