export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scheduleBlocks, scheduleDocLinks } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const addDocSchema = z.object({
	label: z.string().min(1).max(200),
	url: z.string().min(1).max(2000),
	linkType: z.enum(["url", "internal", "portal", "pdf"]).default("url"),
	sortOrder: z.number().int().optional(),
});

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ blockId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { blockId } = await params;

	// Verify block belongs to this teacher
	const [block] = await db
		.select({ id: scheduleBlocks.id })
		.from(scheduleBlocks)
		.where(and(eq(scheduleBlocks.id, blockId), eq(scheduleBlocks.teacherId, data.user.id)));

	if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = addDocSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [doc] = await db
		.insert(scheduleDocLinks)
		.values({
			blockId,
			label: result.data.label,
			url: result.data.url,
			linkType: result.data.linkType,
			sortOrder: result.data.sortOrder ?? 0,
		})
		.returning();

	return NextResponse.json({ doc }, { status: 201 });
}
