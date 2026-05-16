export const dynamic = "force-dynamic";
export const maxDuration = 60; // Claude PDF extraction can take 20-40 s

import { and, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { extractQuestionsFromPdf } from "@/lib/ai/question-extract";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { questionBankItems } from "@/lib/db/schema";
import { questionExtractLimiter } from "@/lib/rate-limit";

const bodySchema = z.object({
	url: z.string().url(),
	filename: z.string().min(1),
	resourceType: z.string().default("unknown"),
	startDate: z.string().optional().default(new Date().toISOString().slice(0, 10)),
});

function addWeekdays(base: Date, n: number): Date {
	const d = new Date(base);
	let added = 0;
	while (added < n) {
		d.setDate(d.getDate() + 1);
		const dow = d.getDay();
		if (dow !== 0 && dow !== 6) added++;
	}
	return d;
}

async function ensureQuestionBankTable() {
	await db.execute(sql`
		CREATE TABLE IF NOT EXISTS question_bank_items (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			teacher_id text NOT NULL,
			source_url text NOT NULL,
			source_filename text NOT NULL,
			resource_type text NOT NULL,
			standard_code text,
			stem text NOT NULL,
			choices jsonb,
			answer text NOT NULL,
			question_type text NOT NULL DEFAULT 'free-response',
			sort_order integer NOT NULL DEFAULT 0,
			topic_day integer,
			assigned_date text,
			extracted_at timestamptz NOT NULL DEFAULT now()
		)
	`);
}

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = questionExtractLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	}

	const { url, filename, resourceType, startDate } = result.data;

	// Reject duplicate — same filename already extracted for this teacher
	const duplicate = await db
		.select({ id: questionBankItems.id })
		.from(questionBankItems)
		.where(
			and(
				eq(questionBankItems.teacherId, data.user.id),
				eq(questionBankItems.sourceFilename, filename),
			),
		)
		.limit(1)
		.catch(() => [] as { id: string }[]);

	if (duplicate.length > 0) {
		return NextResponse.json(
			{
				error: `"${filename}" is already in the bank — clear existing questions first if you want to re-extract`,
			},
			{ status: 409 },
		);
	}

	// Fetch PDF from S3 (bucket is public-read)
	let pdfBase64: string;
	try {
		const res = await fetch(url);
		if (!res.ok)
			return NextResponse.json({ error: "Failed to fetch PDF from storage" }, { status: 502 });
		const buffer = await res.arrayBuffer();
		pdfBase64 = Buffer.from(buffer).toString("base64");
	} catch (e) {
		return NextResponse.json({ error: `Storage fetch error: ${String(e)}` }, { status: 502 });
	}

	// Extract questions via Claude
	let extracted: Awaited<ReturnType<typeof extractQuestionsFromPdf>>;
	try {
		extracted = await extractQuestionsFromPdf(pdfBase64, filename, resourceType);
	} catch (e) {
		return NextResponse.json({ error: `Claude extraction error: ${String(e)}` }, { status: 500 });
	}

	if (extracted.questions.length === 0) {
		return NextResponse.json({ count: 0, questions: [] });
	}

	// Bulk insert into question bank
	const finalResourceType =
		extracted.resourceType !== "unknown" ? extracted.resourceType : resourceType;

	const rows = extracted.questions.map((q, i) => ({
		teacherId: data.user.id,
		sourceUrl: url,
		sourceFilename: filename,
		resourceType: finalResourceType,
		standardCode: q.standardCode ?? null,
		stem: q.stem,
		choices: q.choices ?? null,
		answer: q.answer,
		questionType: q.questionType,
		sortOrder: i,
		topicDay: q.topicDay ?? null,
	}));

	let inserted: (typeof questionBankItems.$inferSelect)[];
	try {
		inserted = await db.insert(questionBankItems).values(rows).returning();
	} catch (e1) {
		try {
			// Table may not exist yet — create it and retry
			await ensureQuestionBankTable();
			inserted = await db.insert(questionBankItems).values(rows).returning();
		} catch (e2) {
			return NextResponse.json(
				{ error: `DB error: ${String(e2)} (original: ${String(e1)})` },
				{ status: 500 },
			);
		}
	}

	// Auto-assign dates by topicDay using weekday offsets from startDate
	const byDay = new Map<number, string[]>();
	for (const q of inserted) {
		if (q.topicDay == null) continue;
		if (!byDay.has(q.topicDay)) byDay.set(q.topicDay, []);
		byDay.get(q.topicDay)!.push(q.id);
	}

	const base = new Date(startDate);
	for (const [day, ids] of byDay) {
		const assignedDate = addWeekdays(base, day - 1)
			.toISOString()
			.slice(0, 10);
		await db
			.update(questionBankItems)
			.set({ assignedDate })
			.where(
				and(
					eq(questionBankItems.teacherId, data.user.id),
					eq(questionBankItems.topicDay, day),
					inArray(questionBankItems.id, ids),
				),
			);
	}

	return NextResponse.json({ count: inserted.length, questions: inserted });
}
