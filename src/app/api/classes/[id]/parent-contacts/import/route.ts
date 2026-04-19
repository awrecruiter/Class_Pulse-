export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, parentContacts, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const PHONE_RE = /^\+1\d{10}$/;

function normalizeToE164(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	if (digits.length === 10) return `+1${digits}`;
	if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
	return raw;
}

/** Parse any text blob (CSV or PDF-extracted text) into rows of cells */
function parseCsvRows(text: string): string[][] {
	return text
		.split(/\r?\n/)
		.map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")))
		.filter((row) => row.some((cell) => cell.length > 0));
}

/** Parse an XLSX/XLS buffer into rows of cells */
function parseXlsxRows(buf: Buffer): string[][] {
	const wb = xlsxRead(buf, { type: "buffer" });
	const ws = wb.Sheets[wb.SheetNames[0] ?? ""];
	if (!ws) return [];
	const raw: unknown[][] = xlsxUtils.sheet_to_json(ws, { header: 1, defval: "" });
	return raw.map((row) =>
		(row as unknown[]).map((cell) => (cell == null ? "" : String(cell).trim())),
	);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;

	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const contentType = request.headers.get("content-type") ?? "";
	const arrayBuf = await request.arrayBuffer();
	const buf = Buffer.from(arrayBuf);

	let rows: string[][];

	if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
		// Try PDF first, fall back to XLSX
		try {
			const parser = new PDFParse({ data: new Uint8Array(buf) });
			try {
				const result = await parser.getText();
				rows = parseCsvRows(result.text);
			} finally {
				await parser.destroy();
			}
		} catch {
			try {
				rows = parseXlsxRows(buf);
			} catch {
				return NextResponse.json(
					{ error: "Could not parse file as PDF or Excel" },
					{ status: 400 },
				);
			}
		}
	} else if (
		contentType.includes("spreadsheet") ||
		contentType.includes("excel") ||
		contentType.includes("application/octet-stream")
	) {
		rows = parseXlsxRows(buf);
	} else {
		// Default: treat as CSV text
		rows = parseCsvRows(buf.toString("utf-8"));
	}

	// Detect and skip header row (first cell is non-numeric)
	const dataRows = /^\d/.test(rows[0]?.[0] ?? "") ? rows : rows.slice(1);

	const roster = await db
		.select({ id: rosterEntries.id, studentId: rosterEntries.studentId })
		.from(rosterEntries)
		.where(and(eq(rosterEntries.classId, classId), eq(rosterEntries.isActive, true)));

	const rosterByStudentId = new Map(roster.map((r) => [r.studentId, r.id]));

	let imported = 0;
	let skipped = 0;
	const errors: string[] = [];

	for (const [rowIdx, row] of dataRows.entries()) {
		const [studentIdRaw, parentNameRaw, phoneRaw, notesRaw] = row;
		const studentIdStr = (studentIdRaw ?? "").trim();
		const phone = normalizeToE164((phoneRaw ?? "").trim());
		const parentName = (parentNameRaw ?? "").trim().slice(0, 100);
		const notes = (notesRaw ?? "").trim().slice(0, 500);

		if (!studentIdStr || !phone) {
			skipped++;
			continue;
		}

		if (!PHONE_RE.test(phone)) {
			errors.push(`Row ${rowIdx + 1}: invalid phone "${phoneRaw}" for student ${studentIdStr}`);
			skipped++;
			continue;
		}

		const rosterId = rosterByStudentId.get(studentIdStr);
		if (!rosterId) {
			errors.push(`Row ${rowIdx + 1}: student ID "${studentIdStr}" not found in roster`);
			skipped++;
			continue;
		}

		await db
			.insert(parentContacts)
			.values({ classId, rosterId, parentName, phone, notes })
			.onConflictDoUpdate({
				target: [parentContacts.classId, parentContacts.rosterId],
				set: { parentName, phone, notes, isActive: true, updatedAt: new Date() },
			});

		imported++;
	}

	return NextResponse.json({ imported, skipped, errors });
}
