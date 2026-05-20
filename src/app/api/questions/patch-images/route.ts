export const dynamic = "force-dynamic";

import { and, asc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { questionBankItems } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const bodySchema = z.object({
	filename: z.string().min(1),
	pageImages: z.array(z.object({ page: z.number().int().positive(), imageUrl: z.string().url() })),
});

export async function PATCH(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json().catch(() => null);
	const result = bodySchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	}

	const { filename, pageImages } = result.data;
	if (pageImages.length === 0) return NextResponse.json({ updated: 0 });

	// Ensure columns exist (idempotent)
	await db
		.execute(sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS image_url text`)
		.catch(() => {});
	await db
		.execute(sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS source_page integer`)
		.catch(() => {});

	// Fetch existing questions for this filename, ordered by sort_order
	const existing = await db
		.select({ id: questionBankItems.id, sourcePage: questionBankItems.sourcePage })
		.from(questionBankItems)
		.where(
			and(
				eq(questionBankItems.teacherId, data.user.id),
				eq(questionBankItems.sourceFilename, filename),
			),
		)
		.orderBy(asc(questionBankItems.sortOrder))
		.catch(() => [] as { id: string; sourcePage: number | null }[]);

	if (existing.length === 0) return NextResponse.json({ updated: 0 });

	const pageMap = new Map(pageImages.map((p) => [p.page, p.imageUrl]));

	// Two strategies:
	// 1. Questions have sourcePage — match exactly by page number
	// 2. Questions lack sourcePage — assign in order (sort_order 0 → page 1, etc.)
	const hasSourcePages = existing.some((q) => q.sourcePage !== null);

	let updated = 0;
	for (let i = 0; i < existing.length; i++) {
		const q = existing[i];
		if (!q) continue;
		const page = hasSourcePages ? (q.sourcePage ?? null) : i + 1;
		if (page === null) continue;
		const imageUrl = pageMap.get(page);
		if (!imageUrl) continue;
		await db
			.update(questionBankItems)
			.set({ imageUrl })
			.where(eq(questionBankItems.id, q.id))
			.catch(() => {});
		updated++;
	}

	return NextResponse.json({ updated });
}
