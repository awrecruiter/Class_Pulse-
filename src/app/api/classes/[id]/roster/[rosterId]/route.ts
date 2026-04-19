export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const patchSchema = z.object({
	firstName: z.string().min(1).max(50).optional(),
	lastInitial: z.string().length(1).optional(),
});

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; rosterId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, rosterId } = await params;

	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = patchSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const updates: Partial<typeof rosterEntries.$inferInsert> = {};
	if (result.data.firstName !== undefined) {
		updates.firstName = result.data.firstName;
		updates.firstInitial = result.data.firstName[0]?.toUpperCase() ?? updates.firstInitial;
	}
	if (result.data.lastInitial !== undefined) {
		updates.lastInitial = result.data.lastInitial.toUpperCase();
	}

	if (Object.keys(updates).length === 0) {
		return NextResponse.json({ ok: true });
	}

	await db
		.update(rosterEntries)
		.set(updates)
		.where(and(eq(rosterEntries.id, rosterId), eq(rosterEntries.classId, classId)));

	return NextResponse.json({ ok: true });
}

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
