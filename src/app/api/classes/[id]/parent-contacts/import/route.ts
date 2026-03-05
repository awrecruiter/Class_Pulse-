import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, parentContacts, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const PHONE_RE = /^\+1\d{10}$/;

function normalizePhone(raw: string): string | null {
	// Strip everything except digits
	const digits = raw.replace(/\D/g, "");
	if (digits.length === 10) return `+1${digits}`;
	if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
	return null;
}

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

// CSV format: studentId, parentName, phone, notes(optional)
// OR:         studentId, phone  (parentName omitted)
function parseContactRows(rawRows: string[][]): {
	rows: { studentId: string; parentName: string; phone: string; notes: string }[];
	errors: string[];
} {
	const rows: { studentId: string; parentName: string; phone: string; notes: string }[] = [];
	const errors: string[] = [];

	for (const cols of rawRows) {
		const studentId = cols[0]?.trim() ?? "";
		if (!studentId) continue;

		// Skip header rows
		if (
			studentId.toLowerCase() === "student_id" ||
			studentId.toLowerCase() === "studentid" ||
			studentId.toLowerCase() === "student id"
		)
			continue;

		let parentName = "";
		let rawPhone = "";
		let notes = "";

		if (cols.length === 2) {
			// studentId, phone
			rawPhone = cols[1]?.trim() ?? "";
		} else if (cols.length >= 3) {
			// Check if col[1] looks like a phone or a name
			const col1 = cols[1]?.trim() ?? "";
			const col1Digits = col1.replace(/\D/g, "");
			if (col1Digits.length >= 10) {
				// studentId, phone, notes
				rawPhone = col1;
				notes = cols[2]?.trim() ?? "";
			} else {
				// studentId, parentName, phone, notes
				parentName = col1;
				rawPhone = cols[2]?.trim() ?? "";
				notes = cols[3]?.trim() ?? "";
			}
		}

		const phone = normalizePhone(rawPhone);
		if (!phone || !PHONE_RE.test(phone)) {
			errors.push(
				`Invalid phone "${rawPhone}" for student ${studentId} — must be 10-digit US number`,
			);
			continue;
		}

		rows.push({ studentId, parentName, phone, notes });
	}

	return { rows, errors };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

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
		if (!firstSheetName) return NextResponse.json({ error: "Empty workbook" }, { status: 400 });
		const ws = workbook.Sheets[firstSheetName];
		if (!ws) return NextResponse.json({ error: "Empty sheet" }, { status: 400 });
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

	const { rows, errors } = parseContactRows(rawRows);

	// Load all roster entries for this class to look up by studentId
	const roster = await db
		.select({ id: rosterEntries.id, studentId: rosterEntries.studentId })
		.from(rosterEntries)
		.where(and(eq(rosterEntries.classId, classId), eq(rosterEntries.isActive, true)));

	const rosterMap = new Map(roster.map((r) => [r.studentId, r.id]));

	let added = 0;
	const notFound: string[] = [];

	for (const row of rows) {
		const rosterId = rosterMap.get(row.studentId);
		if (!rosterId) {
			notFound.push(row.studentId);
			continue;
		}
		await db
			.insert(parentContacts)
			.values({ classId, rosterId, parentName: row.parentName, phone: row.phone, notes: row.notes })
			.onConflictDoUpdate({
				target: [parentContacts.classId, parentContacts.rosterId],
				set: {
					parentName: row.parentName,
					phone: row.phone,
					notes: row.notes,
					isActive: true,
					updatedAt: new Date(),
				},
			});
		added++;
	}

	return NextResponse.json({ added, notFound, errors });
}
