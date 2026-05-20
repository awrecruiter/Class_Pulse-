export const dynamic = "force-dynamic";

import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FL_BEST_STANDARDS } from "@/data/fl-best-standards";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { lessonResources } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

async function ensureColumns() {
	await db
		.execute(
			sql`ALTER TABLE lesson_resources ADD COLUMN IF NOT EXISTS class_id text NOT NULL DEFAULT ''`,
		)
		.catch(() => {});
	await db
		.execute(
			sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_lesson_resources_teacher_lesson_type"
			ON lesson_resources (teacher_id, topic_number, lesson_number, resource_type, class_id)`,
		)
		.catch(() => {});
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType = "bell-ringer" | "cfu" | "exit-ticket" | "pacing";

interface ImportError {
	row: number;
	field: string;
	value: string;
	message: string;
	critical: boolean;
}

interface BellRingerRow {
	standard_code: string;
	problem: string;
	answer: string;
	date?: string;
	time_minutes?: number;
}

interface CfuRow {
	standard_code: string;
	problem: string;
	answer: string;
	date?: string;
	deliver_at_minute?: number;
	is_exit_ticket?: boolean;
}

interface PacingRow {
	week_of: string;
	standard_code: string;
	topic?: string;
	lesson?: string;
	notes?: string;
}

type ParsedRow = BellRingerRow | CfuRow | PacingRow;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FL_BEST_CODE_SET = new Set(FL_BEST_STANDARDS.map((b) => b.code));

/** Find the closest matching standard code (simple prefix + strand matching) */
function suggestStandard(code: string): string | null {
	if (!code) return null;
	const upper = code.toUpperCase();
	// Try prefix match
	const prefix = upper.slice(0, 7); // e.g. "MA.5.FR"
	const matches = FL_BEST_STANDARDS.filter((b) => b.code.startsWith(prefix));
	if (matches.length > 0 && matches[0]) return matches[0].code;
	return null;
}

function isValidDate(s: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

function todayDate(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Parse a CSV string into rows of string arrays. Handles quoted fields with commas. */
function parseCsv(text: string): string[][] {
	const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
	const rows: string[][] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		const fields: string[] = [];
		let current = "";
		let inQuote = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				if (inQuote && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuote = !inQuote;
				}
			} else if (ch === "," && !inQuote) {
				fields.push(current.trim());
				current = "";
			} else {
				current += ch;
			}
		}
		fields.push(current.trim());
		rows.push(fields);
	}
	return rows;
}

// ─── Parsers per resource type ────────────────────────────────────────────────

function parseBellRingerCsv(
	rows: string[][],
	fallbackDate: string,
): { data: BellRingerRow[]; errors: ImportError[] } {
	const errors: ImportError[] = [];
	const data: BellRingerRow[] = [];

	if (rows.length === 0) return { data, errors };
	const header = rows[0]?.map((h) => h.toLowerCase().replace(/\s+/g, "_")) ?? [];
	const idx = (name: string) => header.indexOf(name);

	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];
		if (!row || row.every((c) => !c)) continue;
		const rowNum = i + 1;

		const standardCode = row[idx("standard_code")]?.trim() ?? "";
		const problem = row[idx("problem")]?.trim() ?? "";
		const answer = row[idx("answer")]?.trim() ?? "";
		const dateRaw = row[idx("date")]?.trim() ?? "";
		const timeRaw = row[idx("time_minutes")]?.trim() ?? "";

		let rowCritical = false;

		if (!standardCode) {
			errors.push({
				row: rowNum,
				field: "standard_code",
				value: "",
				message: "standard_code is required",
				critical: true,
			});
			rowCritical = true;
		} else if (!FL_BEST_CODE_SET.has(standardCode)) {
			const suggestion = suggestStandard(standardCode);
			errors.push({
				row: rowNum,
				field: "standard_code",
				value: standardCode,
				message: `Standard not found${suggestion ? `. Did you mean ${suggestion}?` : ""}`,
				critical: false,
			});
		}

		if (!problem) {
			errors.push({
				row: rowNum,
				field: "problem",
				value: "",
				message: "problem is required",
				critical: true,
			});
			rowCritical = true;
		}
		if (!answer) {
			errors.push({
				row: rowNum,
				field: "answer",
				value: "",
				message: "answer is required",
				critical: true,
			});
			rowCritical = true;
		}

		let date = fallbackDate;
		if (dateRaw) {
			if (!isValidDate(dateRaw)) {
				errors.push({
					row: rowNum,
					field: "date",
					value: dateRaw,
					message: "date must be YYYY-MM-DD",
					critical: false,
				});
			} else {
				date = dateRaw;
			}
		}

		let timeMinutes: number | undefined;
		if (timeRaw) {
			const parsed = Number.parseInt(timeRaw, 10);
			if (Number.isNaN(parsed) || parsed < 1) {
				errors.push({
					row: rowNum,
					field: "time_minutes",
					value: timeRaw,
					message: "time_minutes must be a positive integer",
					critical: false,
				});
			} else {
				timeMinutes = parsed;
			}
		}

		if (!rowCritical) {
			data.push({
				standard_code: standardCode,
				problem,
				answer,
				date,
				time_minutes: timeMinutes ?? 5,
			});
		}
	}

	return { data, errors };
}

function parseCfuCsv(
	rows: string[][],
	fallbackDate: string,
): { data: CfuRow[]; errors: ImportError[] } {
	const errors: ImportError[] = [];
	const data: CfuRow[] = [];

	if (rows.length === 0) return { data, errors };
	const header = rows[0]?.map((h) => h.toLowerCase().replace(/\s+/g, "_")) ?? [];
	const idx = (name: string) => header.indexOf(name);

	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];
		if (!row || row.every((c) => !c)) continue;
		const rowNum = i + 1;

		const standardCode = row[idx("standard_code")]?.trim() ?? "";
		const problem = row[idx("problem")]?.trim() ?? "";
		const answer = row[idx("answer")]?.trim() ?? "";
		const dateRaw = row[idx("date")]?.trim() ?? "";
		const deliverRaw = row[idx("deliver_at_minute")]?.trim() ?? "";
		const exitRaw = row[idx("is_exit_ticket")]?.trim() ?? "";

		let rowCritical = false;

		if (!standardCode) {
			errors.push({
				row: rowNum,
				field: "standard_code",
				value: "",
				message: "standard_code is required",
				critical: true,
			});
			rowCritical = true;
		} else if (!FL_BEST_CODE_SET.has(standardCode)) {
			const suggestion = suggestStandard(standardCode);
			errors.push({
				row: rowNum,
				field: "standard_code",
				value: standardCode,
				message: `Standard not found${suggestion ? `. Did you mean ${suggestion}?` : ""}`,
				critical: false,
			});
		}

		if (!problem) {
			errors.push({
				row: rowNum,
				field: "problem",
				value: "",
				message: "problem is required",
				critical: true,
			});
			rowCritical = true;
		}
		if (!answer) {
			errors.push({
				row: rowNum,
				field: "answer",
				value: "",
				message: "answer is required",
				critical: true,
			});
			rowCritical = true;
		}

		let date = fallbackDate;
		if (dateRaw) {
			if (!isValidDate(dateRaw)) {
				errors.push({
					row: rowNum,
					field: "date",
					value: dateRaw,
					message: "date must be YYYY-MM-DD",
					critical: false,
				});
			} else {
				date = dateRaw;
			}
		}

		let deliverAtMinute: number | undefined;
		if (deliverRaw) {
			const parsed = Number.parseInt(deliverRaw, 10);
			if (Number.isNaN(parsed) || parsed < 0) {
				errors.push({
					row: rowNum,
					field: "deliver_at_minute",
					value: deliverRaw,
					message: "deliver_at_minute must be a non-negative integer",
					critical: false,
				});
			} else {
				deliverAtMinute = parsed;
			}
		}

		const isExitTicket = exitRaw ? ["true", "1", "yes"].includes(exitRaw.toLowerCase()) : false;

		if (!rowCritical) {
			data.push({
				standard_code: standardCode,
				problem,
				answer,
				date,
				deliver_at_minute: deliverAtMinute,
				is_exit_ticket: isExitTicket,
			});
		}
	}

	return { data, errors };
}

function parsePacingCsv(
	rows: string[][],
	fallbackDate: string,
): { data: PacingRow[]; errors: ImportError[] } {
	const errors: ImportError[] = [];
	const data: PacingRow[] = [];

	if (rows.length === 0) return { data, errors };
	const header = rows[0]?.map((h) => h.toLowerCase().replace(/\s+/g, "_")) ?? [];
	const idx = (name: string) => header.indexOf(name);

	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];
		if (!row || row.every((c) => !c)) continue;
		const rowNum = i + 1;

		const weekOf = row[idx("week_of")]?.trim() ?? row[idx("date")]?.trim() ?? fallbackDate;
		const standardCode = row[idx("standard_code")]?.trim() ?? "";
		const topic = row[idx("topic")]?.trim() ?? "";
		const lesson = row[idx("lesson")]?.trim() ?? "";
		const notes = row[idx("notes")]?.trim() ?? "";

		let rowCritical = false;

		if (!isValidDate(weekOf)) {
			errors.push({
				row: rowNum,
				field: "week_of",
				value: weekOf,
				message: "week_of must be YYYY-MM-DD (Monday of the week)",
				critical: true,
			});
			rowCritical = true;
		}

		if (!standardCode) {
			errors.push({
				row: rowNum,
				field: "standard_code",
				value: "",
				message: "standard_code is required",
				critical: true,
			});
			rowCritical = true;
		} else if (!FL_BEST_CODE_SET.has(standardCode)) {
			const suggestion = suggestStandard(standardCode);
			errors.push({
				row: rowNum,
				field: "standard_code",
				value: standardCode,
				message: `Standard not found${suggestion ? `. Did you mean ${suggestion}?` : ""}`,
				critical: false,
			});
		}

		if (!rowCritical) {
			data.push({ week_of: weekOf, standard_code: standardCode, topic, lesson, notes });
		}
	}

	return { data, errors };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const teacherId = data.user.id;

	await ensureColumns();

	// ─── JSON path (URL paste flow) ───────────────────────────────────────────
	const contentType = request.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
		}

		const jsonSchema = z.object({
			resourceType: z.enum(["bell-ringer", "cfu", "exit-ticket", "pacing"]),
			date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
			url: z.string().min(1, "url is required"),
			classId: z.string().optional(),
		});
		const parsed = jsonSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message ?? "Invalid request" },
				{ status: 400 },
			);
		}

		const { resourceType, date: importDate, url, classId: rawClassId } = parsed.data;
		const classId = rawClassId ?? "";

		// Try upsert with class_id (migration 0020 applied — 5-col unique index).
		// Falls back to upsert without class_id for older production DBs.
		try {
			await db.execute(sql`
				INSERT INTO lesson_resources
					(teacher_id, topic_number, lesson_number, resource_type, label, url, is_hidden, sort_order, import_date, class_id)
				VALUES
					(${teacherId}, ${0}, ${importDate}, ${resourceType}, ${resourceType}, ${url}, ${false}, ${0}, ${importDate}, ${classId})
				ON CONFLICT (teacher_id, topic_number, lesson_number, resource_type, class_id)
				DO UPDATE SET
					url = EXCLUDED.url, label = EXCLUDED.label,
					import_date = EXCLUDED.import_date, updated_at = now()
			`);
		} catch {
			// 5-col unique index or class_id column missing — fall back to pre-migration schema
			try {
				await db.execute(sql`
					INSERT INTO lesson_resources
						(teacher_id, topic_number, lesson_number, resource_type, label, url, is_hidden, sort_order, import_date)
					VALUES
						(${teacherId}, ${0}, ${importDate}, ${resourceType}, ${resourceType}, ${url}, ${false}, ${0}, ${importDate})
					ON CONFLICT (teacher_id, topic_number, lesson_number, resource_type)
					DO UPDATE SET
						url = EXCLUDED.url, label = EXCLUDED.label,
						import_date = EXCLUDED.import_date, updated_at = now()
				`);
			} catch (e2) {
				console.error("[resources/upload] DB upsert failed:", e2);
				return NextResponse.json(
					{
						error: `Database error: ${e2 instanceof Error ? e2.message.slice(0, 200) : String(e2)}`,
					},
					{ status: 500 },
				);
			}
		}

		return NextResponse.json({ status: "success", importedRows: 1 });
	}
	// ─── FormData / CSV path ──────────────────────────────────────────────────

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
	}

	const file = formData.get("file") as File | null;
	const resourceTypeRaw = (formData.get("resourceType") as string | null)?.trim() ?? "";
	const classId = (formData.get("classId") as string | null)?.trim() ?? "";
	const dateRaw = (formData.get("date") as string | null)?.trim() ?? "";

	if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
	if (!["bell-ringer", "cfu", "exit-ticket", "pacing"].includes(resourceTypeRaw)) {
		return NextResponse.json(
			{ error: "resourceType must be bell-ringer | cfu | exit-ticket | pacing" },
			{ status: 400 },
		);
	}
	if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });

	const resourceType = resourceTypeRaw as ResourceType;
	const importDate = dateRaw && isValidDate(dateRaw) ? dateRaw : todayDate();

	let csvText: string;
	try {
		csvText = await file.text();
	} catch {
		return NextResponse.json({ error: "Failed to read file" }, { status: 400 });
	}

	const allRows = parseCsv(csvText);
	const totalRows = Math.max(0, allRows.length - 1); // exclude header

	let parsedData: ParsedRow[] = [];
	let errors: ImportError[] = [];

	if (resourceType === "bell-ringer") {
		const result = parseBellRingerCsv(allRows, importDate);
		parsedData = result.data;
		errors = result.errors;
	} else if (resourceType === "cfu" || resourceType === "exit-ticket") {
		const result = parseCfuCsv(allRows, importDate);
		// For exit-ticket type, force is_exit_ticket = true on all rows
		if (resourceType === "exit-ticket") {
			for (const row of result.data as CfuRow[]) {
				row.is_exit_ticket = true;
			}
		}
		parsedData = result.data;
		errors = result.errors;
	} else if (resourceType === "pacing") {
		const result = parsePacingCsv(allRows, importDate);
		parsedData = result.data;
		errors = result.errors;
	}

	const importedRows = parsedData.length;

	if (importedRows === 0 && totalRows > 0) {
		return NextResponse.json({
			status: "error",
			resourceType,
			totalRows,
			importedRows: 0,
			errors,
		});
	}

	// Write to lessonResources — group all rows for a date into a single record.
	try {
		await db.insert(lessonResources).values({
			teacherId,
			topicNumber: 0,
			lessonNumber: importDate,
			resourceType,
			label: `${resourceType} import ${importDate}`.slice(0, 120),
			url: "",
			isHidden: false,
			sortOrder: 0,
			resourceData: { rows: parsedData } as unknown as Record<string, unknown>,
			importDate,
			classId,
		});
	} catch (insertErr) {
		const isUniqueViolation =
			insertErr instanceof Error && insertErr.message.includes("duplicate key");
		if (!isUniqueViolation) {
			console.error("[resources/upload] DB write error:", insertErr);
			return NextResponse.json({ error: "Database error writing resource" }, { status: 500 });
		}
		try {
			const { eq, and } = await import("drizzle-orm");
			await db
				.update(lessonResources)
				.set({
					resourceData: { rows: parsedData } as unknown as Record<string, unknown>,
					importDate,
					label: `${resourceType} import ${importDate}`.slice(0, 120),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(lessonResources.teacherId, teacherId),
						eq(lessonResources.topicNumber, 0),
						eq(lessonResources.lessonNumber, importDate),
						eq(lessonResources.resourceType, resourceType),
						eq(lessonResources.classId, classId),
					),
				);
		} catch (updateErr) {
			console.error("[resources/upload] DB update error:", updateErr);
			return NextResponse.json({ error: "Database error writing resource" }, { status: 500 });
		}
	}

	const status =
		importedRows === totalRows ? "success" : importedRows > 0 ? "partial_success" : "error";

	return NextResponse.json({
		status,
		resourceType,
		totalRows,
		importedRows,
		errors,
	});
}
