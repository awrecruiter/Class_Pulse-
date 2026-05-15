export const dynamic = "force-dynamic";

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
	const rows = extracted.questions.map((q, i) => ({
		teacherId: data.user.id,
		sourceUrl: url,
		sourceFilename: filename,
		resourceType: extracted.resourceType !== "unknown" ? extracted.resourceType : resourceType,
		standardCode: q.standardCode ?? null,
		stem: q.stem,
		choices: q.choices ?? null,
		answer: q.answer,
		questionType: q.questionType,
		sortOrder: i,
		topicDay: q.topicDay ?? null,
	}));

	const inserted = await db.insert(questionBankItems).values(rows).returning();

	return NextResponse.json({ count: inserted.length, questions: inserted });
}
