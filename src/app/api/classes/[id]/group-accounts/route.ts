export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, groupAccounts, studentGroups } from "@/lib/db/schema";
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

	const groups = await db
		.select({
			groupId: groupAccounts.groupId,
			balance: groupAccounts.balance,
			name: studentGroups.name,
			emoji: studentGroups.emoji,
			color: studentGroups.color,
		})
		.from(groupAccounts)
		.innerJoin(studentGroups, eq(groupAccounts.groupId, studentGroups.id))
		.where(eq(groupAccounts.classId, classId))
		.orderBy(studentGroups.sortOrder);

	return NextResponse.json({ groups });
}

const awardSchema = z.object({
	groupId: z.string().uuid(),
	amount: z.number().int().min(-10000).max(10000),
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
	const result = awardSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { groupId, amount } = result.data;

	await db
		.update(groupAccounts)
		.set({ balance: sql`${groupAccounts.balance} + ${amount}`, updatedAt: new Date() })
		.where(and(eq(groupAccounts.classId, classId), eq(groupAccounts.groupId, groupId)));

	return NextResponse.json({ ok: true });
}
