export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scheduleBlocks, scheduleDocLinks } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ blockId: string; docId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { blockId, docId } = await params;

	// Verify block belongs to this teacher
	const [block] = await db
		.select({ id: scheduleBlocks.id })
		.from(scheduleBlocks)
		.where(and(eq(scheduleBlocks.id, blockId), eq(scheduleBlocks.teacherId, data.user.id)));

	if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const [deleted] = await db
		.delete(scheduleDocLinks)
		.where(and(eq(scheduleDocLinks.id, docId), eq(scheduleDocLinks.blockId, blockId)))
		.returning();

	if (!deleted) return NextResponse.json({ error: "Doc not found" }, { status: 404 });

	return NextResponse.json({ ok: true });
}
