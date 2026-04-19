export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scheduleBlocks } from "@/lib/db/schema";
import { scheduleExtractLimiter } from "@/lib/rate-limit";

const blockSchema = z.object({
	title: z.string().min(1).max(200),
	color: z.string().default("blue"),
	startTime: z.string().regex(/^\d{2}:\d{2}$/),
	endTime: z.string().regex(/^\d{2}:\d{2}$/),
	dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
	specificDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	sortOrder: z.number().int().optional(),
});

const bodySchema = z.object({
	blocks: z.array(blockSchema).min(1).max(200),
});

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = scheduleExtractLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const rows = result.data.blocks.map((b, i) => ({
		teacherId: data.user.id,
		title: b.title,
		color: b.color,
		startTime: b.startTime,
		endTime: b.endTime,
		dayOfWeek: b.dayOfWeek ?? null,
		specificDate: b.specificDate ?? null,
		sortOrder: b.sortOrder ?? i,
	}));

	const inserted = await db.insert(scheduleBlocks).values(rows).returning();

	return NextResponse.json({ blocks: inserted, count: inserted.length }, { status: 201 });
}
