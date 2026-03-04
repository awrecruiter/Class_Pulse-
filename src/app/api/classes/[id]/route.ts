import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, classSessions, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const updateClassSchema = z.object({
	label: z.string().min(1).max(100).optional(),
	periodTime: z.string().max(20).optional(),
	gradeLevel: z.string().max(10).optional(),
	subject: z.string().max(50).optional(),
	isArchived: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, id), eq(classes.teacherId, data.user.id)));

	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const roster = await db
		.select()
		.from(rosterEntries)
		.where(and(eq(rosterEntries.classId, id), eq(rosterEntries.isActive, true)));

	const activeSessions = await db
		.select()
		.from(classSessions)
		.where(and(eq(classSessions.classId, id), eq(classSessions.status, "active")));

	return NextResponse.json({ class: cls, roster, activeSession: activeSessions[0] ?? null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, id), eq(classes.teacherId, data.user.id)));

	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = updateClassSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [updated] = await db
		.update(classes)
		.set({ ...result.data, updatedAt: new Date() })
		.where(eq(classes.id, id))
		.returning();

	return NextResponse.json({ class: updated });
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

	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, id), eq(classes.teacherId, data.user.id)));

	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	// Soft delete — archive rather than destroy student data
	await db
		.update(classes)
		.set({ isArchived: true, updatedAt: new Date() })
		.where(eq(classes.id, id));

	return NextResponse.json({ ok: true });
}
