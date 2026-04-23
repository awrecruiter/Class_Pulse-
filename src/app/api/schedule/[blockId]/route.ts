import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scheduleBlocks } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const updateBlockSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	color: z.string().optional(),
	startTime: z
		.string()
		.regex(/^\d{2}:\d{2}$/)
		.optional(),
	endTime: z
		.string()
		.regex(/^\d{2}:\d{2}$/)
		.optional(),
	dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
	specificDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	sortOrder: z.number().int().optional(),
});

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ blockId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { blockId } = await params;
	const body = await request.json();
	const result = updateBlockSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [block] = await db
		.update(scheduleBlocks)
		.set(result.data)
		.where(and(eq(scheduleBlocks.id, blockId), eq(scheduleBlocks.teacherId, data.user.id)))
		.returning();

	if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });

	return NextResponse.json({ block });
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ blockId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { blockId } = await params;

	const [deleted] = await db
		.delete(scheduleBlocks)
		.where(and(eq(scheduleBlocks.id, blockId), eq(scheduleBlocks.teacherId, data.user.id)))
		.returning();

	if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

	return NextResponse.json({ ok: true });
}
