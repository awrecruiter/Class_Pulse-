import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, groupMilestones } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	try {
		const milestones = await db
			.select()
			.from(groupMilestones)
			.where(eq(groupMilestones.classId, classId))
			.orderBy(asc(groupMilestones.coinsRequired), asc(groupMilestones.sortOrder));

		return NextResponse.json({ milestones });
	} catch (err) {
		console.error("[group-milestones GET]", err);
		return NextResponse.json({ error: "Database error" }, { status: 500 });
	}
}

const createSchema = z.object({
	name: z.string().min(1).max(80),
	coinsRequired: z.number().int().min(1).max(100000),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = createSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	try {
		const [milestone] = await db
			.insert(groupMilestones)
			.values({ classId, name: result.data.name, coinsRequired: result.data.coinsRequired })
			.returning();

		return NextResponse.json({ milestone });
	} catch (err) {
		console.error("[group-milestones POST]", err);
		return NextResponse.json({ error: "Database error" }, { status: 500 });
	}
}

const deleteSchema = z.object({ milestoneId: z.string().uuid() });

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const url = new URL(request.url);
	const result = deleteSchema.safeParse({ milestoneId: url.searchParams.get("milestoneId") });
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	try {
		await db
			.delete(groupMilestones)
			.where(
				and(eq(groupMilestones.id, result.data.milestoneId), eq(groupMilestones.classId, classId)),
			);

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("[group-milestones DELETE]", err);
		return NextResponse.json({ error: "Database error" }, { status: 500 });
	}
}
