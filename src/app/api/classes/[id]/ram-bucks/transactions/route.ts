export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, ramBuckTransactions, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const querySchema = z.object({
	rosterId: z.string().uuid().optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
});

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

	const { searchParams } = new URL(request.url);
	const parsed = querySchema.safeParse({
		rosterId: searchParams.get("rosterId") ?? undefined,
		limit: searchParams.get("limit") ?? undefined,
	});
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	const { rosterId, limit } = parsed.data;

	const conditions = rosterId
		? and(eq(ramBuckTransactions.classId, classId), eq(ramBuckTransactions.rosterId, rosterId))
		: eq(ramBuckTransactions.classId, classId);

	const transactions = await db
		.select({
			id: ramBuckTransactions.id,
			rosterId: ramBuckTransactions.rosterId,
			sessionId: ramBuckTransactions.sessionId,
			type: ramBuckTransactions.type,
			amount: ramBuckTransactions.amount,
			reason: ramBuckTransactions.reason,
			createdAt: ramBuckTransactions.createdAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(ramBuckTransactions)
		.innerJoin(rosterEntries, eq(ramBuckTransactions.rosterId, rosterEntries.id))
		.where(conditions)
		.orderBy(desc(ramBuckTransactions.createdAt))
		.limit(limit);

	return NextResponse.json({ transactions });
}
