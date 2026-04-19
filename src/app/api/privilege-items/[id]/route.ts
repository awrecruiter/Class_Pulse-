export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { privilegeItems } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const updateItemSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	cost: z.number().int().min(0).max(10000).optional(),
	durationMinutes: z.number().int().min(1).max(300).nullable().optional(),
	isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const body = await request.json();
	const result = updateItemSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const updates: Partial<typeof result.data> = {};
	if (result.data.name !== undefined) updates.name = result.data.name;
	if (result.data.cost !== undefined) updates.cost = result.data.cost;
	if (result.data.durationMinutes !== undefined)
		updates.durationMinutes = result.data.durationMinutes;
	if (result.data.isActive !== undefined) updates.isActive = result.data.isActive;

	const [updated] = await db
		.update(privilegeItems)
		.set(updates)
		.where(and(eq(privilegeItems.id, id), eq(privilegeItems.teacherId, data.user.id)))
		.returning();

	if (!updated) return NextResponse.json({ error: "Item not found" }, { status: 404 });

	return NextResponse.json({ item: updated });
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	// Soft delete — set isActive = false
	const [updated] = await db
		.update(privilegeItems)
		.set({ isActive: false })
		.where(and(eq(privilegeItems.id, id), eq(privilegeItems.teacherId, data.user.id)))
		.returning();

	if (!updated) return NextResponse.json({ error: "Item not found" }, { status: 404 });

	return NextResponse.json({ ok: true });
}
