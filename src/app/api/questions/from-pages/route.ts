export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { questionBankItems } from "@/lib/db/schema";
import { questionExtractLimiter } from "@/lib/rate-limit";

const bodySchema = z.object({
	pageImages: z
		.array(z.object({ page: z.number().int().positive(), imageUrl: z.string().url() }))
		.min(1),
	sourceUrl: z.string().url(),
	filename: z.string().min(1),
	resourceType: z.string().default("bell-ringer"),
	startDate: z.string().optional().default(new Date().toISOString().slice(0, 10)),
	replace: z.boolean().optional().default(false),
});

async function ensureColumns() {
	await db
		.execute(sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS image_url text`)
		.catch(() => {});
	await db
		.execute(sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS source_page integer`)
		.catch(() => {});
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

	const { pageImages, sourceUrl, filename, resourceType, replace } = result.data;

	// Check for duplicate — same filename already in bank for this teacher
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
		if (!replace) {
			return NextResponse.json(
				{
					error: `"${filename}" is already in the bank — clear existing questions first if you want to re-import`,
				},
				{ status: 409 },
			);
		}
		// replace=true: delete existing questions for this filename before recreating
		await db
			.delete(questionBankItems)
			.where(
				and(
					eq(questionBankItems.teacherId, data.user.id),
					eq(questionBankItems.sourceFilename, filename),
				),
			)
			.catch(() => {});
	}

	await ensureColumns();

	const rows = pageImages.map((p, i) => ({
		teacherId: data.user.id,
		sourceUrl,
		sourceFilename: filename,
		resourceType,
		standardCode: null,
		stem: "",
		choices: null,
		answer: "",
		questionType: "free-response" as const,
		sortOrder: i,
		topicDay: null,
		assignedDate: null,
		imageUrl: p.imageUrl,
		sourcePage: p.page,
	}));

	try {
		const inserted = await db
			.insert(questionBankItems)
			.values(rows)
			.returning({ id: questionBankItems.id });
		return NextResponse.json({ count: inserted.length });
	} catch (e) {
		return NextResponse.json({ error: `DB error: ${String(e)}` }, { status: 500 });
	}
}
