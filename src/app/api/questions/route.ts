export const dynamic = "force-dynamic";

import { and, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { questionBankItems } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const resourceType = searchParams.get("resourceType");
	const date = searchParams.get("date");
	const filename = searchParams.get("filename");

	const conditions = [eq(questionBankItems.teacherId, data.user.id)];
	if (resourceType) conditions.push(eq(questionBankItems.resourceType, resourceType));
	if (date) conditions.push(eq(questionBankItems.assignedDate, date));
	if (filename) conditions.push(eq(questionBankItems.sourceFilename, filename));

	const questions = await db
		.select()
		.from(questionBankItems)
		.where(and(...conditions))
		.orderBy(desc(questionBankItems.extractedAt))
		.catch(async () => {
			// Table doesn't exist yet — create it so the next extraction works
			try {
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
						image_url text,
						source_page integer,
						extracted_at timestamptz NOT NULL DEFAULT now()
					)
				`);
				await db
					.execute(sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS image_url text`)
					.catch(() => {});
				await db
					.execute(
						sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS source_page integer`,
					)
					.catch(() => {});
				await db
					.execute(sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS bbox_top_pct real`)
					.catch(() => {});
				await db
					.execute(
						sql`ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS bbox_bottom_pct real`,
					)
					.catch(() => {});
			} catch {
				// ignore
			}
			return [] as (typeof questionBankItems.$inferSelect)[];
		});

	return NextResponse.json({ questions });
}
