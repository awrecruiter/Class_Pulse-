export const dynamic = "force-dynamic";

import { asc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classSessions, questionBankItems, questionPushes } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const bodySchema = z.object({
	questionId: z.string().uuid(),
});

async function ensureColumns() {
	await db
		.execute(sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS image_url text`)
		.catch(() => {});
	await db
		.execute(sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS source_page integer`)
		.catch(() => {});
}
const _ready = ensureColumns();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: sessionId } = await params;

	// Verify session ownership
	const [session] = await db
		.select({ teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session || session.teacherId !== data.user.id) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	}

	const { questionId } = result.data;

	// Fetch question from bank
	const [question] = await db
		.select()
		.from(questionBankItems)
		.where(eq(questionBankItems.id, questionId));

	if (!question || question.teacherId !== data.user.id) {
		return NextResponse.json({ error: "Question not found" }, { status: 404 });
	}

	// Compute crop metadata so the student sees only this question's slice of the page image
	let cropIndex = 0;
	let cropTotal = 1;
	if (question.imageUrl) {
		const coPageRows = await db
			.select({ id: questionBankItems.id, sortOrder: questionBankItems.sortOrder })
			.from(questionBankItems)
			.where(eq(questionBankItems.imageUrl, question.imageUrl))
			.orderBy(asc(questionBankItems.sortOrder));
		cropTotal = coPageRows.length;
		const idx = coPageRows.findIndex((r) => r.id === question.id);
		cropIndex = idx === -1 ? 0 : idx;
	}

	// Snapshot at push time — includes crop + resourceType so student renders correctly
	const questionJson = JSON.stringify({
		stem: question.stem,
		choices: question.choices,
		answer: question.answer,
		questionType: question.questionType,
		standardCode: question.standardCode,
		imageUrl: question.imageUrl ?? null,
		sourcePage: question.sourcePage ?? null,
		resourceType: question.resourceType,
		cropIndex,
		cropTotal,
	});

	const [push] = await db
		.insert(questionPushes)
		.values({ sessionId, questionId, questionJson })
		.returning({ id: questionPushes.id, pushedAt: questionPushes.pushedAt });

	return NextResponse.json({ ok: true, pushId: push.id });
}
