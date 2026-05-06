import { type NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { lessonResources } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const VALID_TYPES = new Set(["slides", "book", "worksheet", "video", "other"]);

function normalizeHeader(h: string): string {
	return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type ParsedResource = {
	topicNumber: number;
	lessonNumber: string;
	resourceType: string;
	label: string;
	url: string;
	sortOrder: number;
};

function parseRows(rawRows: string[][]): { rows: ParsedResource[]; errors: string[] } {
	const rows: ParsedResource[] = [];
	const errors: string[] = [];
	if (rawRows.length < 2) return { rows, errors: ["File has no data rows"] };

	const headerRow = rawRows[0]?.map(normalizeHeader) ?? [];
	const topicIdx = headerRow.indexOf("topicnumber");
	const lessonIdx = headerRow.indexOf("lessonnumber");
	const typeIdx = headerRow.indexOf("resourcetype");
	const labelIdx = headerRow.indexOf("label");
	const urlIdx = headerRow.indexOf("url");
	const sortIdx = headerRow.indexOf("sortorder");

	if (topicIdx < 0 || lessonIdx < 0 || typeIdx < 0 || labelIdx < 0 || urlIdx < 0) {
		return {
			rows,
			errors: [
				"Missing required columns. Expected: topicNumber, lessonNumber, resourceType, label, url",
			],
		};
	}

	for (let i = 1; i < rawRows.length; i++) {
		const cols = rawRows[i] ?? [];
		const topicRaw = cols[topicIdx]?.trim() ?? "";
		const lessonNumber = cols[lessonIdx]?.trim() ?? "";
		const resourceType = cols[typeIdx]?.trim().toLowerCase() ?? "";
		const label = cols[labelIdx]?.trim() ?? "";
		const url = cols[urlIdx]?.trim() ?? "";
		const sortOrder = sortIdx >= 0 ? Number.parseInt(cols[sortIdx] ?? "0", 10) || 0 : 0;

		if (!topicRaw && !lessonNumber && !resourceType && !label && !url) continue; // blank row

		const topicNumber = Number.parseInt(topicRaw, 10);
		if (!Number.isFinite(topicNumber) || topicNumber < 1 || topicNumber > 18) {
			errors.push(`Row ${i + 1}: topicNumber must be 1–18, got "${topicRaw}"`);
			continue;
		}
		if (!lessonNumber) {
			errors.push(`Row ${i + 1}: lessonNumber is required`);
			continue;
		}
		if (!VALID_TYPES.has(resourceType)) {
			errors.push(
				`Row ${i + 1}: resourceType "${resourceType}" invalid — must be slides|book|worksheet|video|other`,
			);
			continue;
		}
		if (!label) {
			errors.push(`Row ${i + 1}: label is required`);
			continue;
		}
		if (!url.startsWith("http")) {
			errors.push(`Row ${i + 1}: url must start with http`);
			continue;
		}

		rows.push({ topicNumber, lessonNumber, resourceType, label, url, sortOrder });
	}

	return { rows, errors };
}

/** POST /api/resources/lesson/import — bulk CSV or XLSX import into teacher resource overrides */
export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const formData = await request.formData();
	const file = formData.get("file");
	if (!file || typeof file === "string") {
		return NextResponse.json({ error: "file field required" }, { status: 400 });
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const filename = (file as File).name?.toLowerCase() ?? "";

	let rawRows: string[][];

	if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
		const workbook = XLSX.read(buffer, { type: "buffer" });
		const sheetName = workbook.SheetNames[0];
		if (!sheetName) return NextResponse.json({ error: "Empty workbook" }, { status: 400 });
		const ws = workbook.Sheets[sheetName];
		if (!ws) return NextResponse.json({ error: "Empty sheet" }, { status: 400 });
		const jsonRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
		rawRows = jsonRows.map((row) => (row as unknown[]).map((cell) => String(cell ?? "").trim()));
	} else {
		const text = buffer.toString("utf-8");
		rawRows = text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
			.map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
	}

	const { rows, errors } = parseRows(rawRows);

	const teacherId = data.user.id;
	let imported = 0;
	let skipped = 0;

	for (const row of rows) {
		try {
			await db
				.insert(lessonResources)
				.values({ teacherId, ...row, isHidden: false })
				.onConflictDoUpdate({
					target: [
						lessonResources.teacherId,
						lessonResources.topicNumber,
						lessonResources.lessonNumber,
						lessonResources.resourceType,
					],
					set: {
						label: row.label,
						url: row.url,
						sortOrder: row.sortOrder,
						updatedAt: new Date(),
					},
				});
			imported++;
		} catch {
			skipped++;
			errors.push(
				`Failed to import row: ${row.topicNumber}.${row.lessonNumber} ${row.resourceType}`,
			);
		}
	}

	return NextResponse.json({ imported, skipped, errors });
}
