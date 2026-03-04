import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; rosterId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, rosterId } = await params;

	// Verify teacher owns this class
	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));

	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	// Soft delete — keep historical data
	await db
		.update(rosterEntries)
		.set({ isActive: false })
		.where(and(eq(rosterEntries.id, rosterId), eq(rosterEntries.classId, classId)));

	return NextResponse.json({ ok: true });
}
