export const dynamic = "force-dynamic";

import { sql } from "drizzle-orm";
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
});

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

	const { url, filename, resourceType } = result.data;

	// Fetch PDF from S3 (bucket is public-read)
	let pdfBase64: string;
	try {
		const res = await fetch(url);
		if (!res.ok) return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
		const buffer = await res.arrayBuffer();
		pdfBase64 = Buffer.from(buffer).toString("base64");
	} catch {
		return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
	}

	// Extract questions via Claude
	let extracted: Awaited<ReturnType<typeof extractQuestionsFromPdf>>;
	try {
		extracted = await extractQuestionsFromPdf(pdfBase64, filename, resourceType);
	} catch {
		return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
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
	} catch {
		try {
			// Table may not exist yet — create it and retry
			await ensureQuestionBankTable();
			inserted = await db.insert(questionBankItems).values(rows).returning();
		} catch {
			return NextResponse.json(
				{ error: "Database error — could not save questions" },
				{ status: 500 },
			);
		}
	}

	return NextResponse.json({ count: inserted.length, questions: inserted });
}
