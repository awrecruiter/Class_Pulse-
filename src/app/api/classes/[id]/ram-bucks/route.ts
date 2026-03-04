import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, ramBuckAccounts, ramBuckTransactions, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const awardSchema = z.object({
	rosterId: z.string().uuid(),
	amount: z.number().int().min(-10000).max(10000),
	type: z.enum([
		"academic-correct",
		"academic-mastery",
		"academic-iready",
		"behavior-positive",
		"behavior-fine",
		"purchase",
		"manual-award",
		"manual-deduct",
		"reset",
	]),
	reason: z.string().max(200).default(""),
	sessionId: z.string().uuid().optional(),
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

	const accounts = await db
		.select({
			id: ramBuckAccounts.id,
			rosterId: ramBuckAccounts.rosterId,
			balance: ramBuckAccounts.balance,
			lifetimeEarned: ramBuckAccounts.lifetimeEarned,
			lastResetAt: ramBuckAccounts.lastResetAt,
			updatedAt: ramBuckAccounts.updatedAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(ramBuckAccounts)
		.innerJoin(rosterEntries, eq(ramBuckAccounts.rosterId, rosterEntries.id))
		.where(eq(ramBuckAccounts.classId, classId));

	return NextResponse.json({ accounts });
}

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

	const { rosterId, amount, type, reason, sessionId } = result.data;

	// Upsert account first
	const [account] = await db
		.insert(ramBuckAccounts)
		.values({ classId, rosterId })
		.onConflictDoUpdate({
			target: [ramBuckAccounts.classId, ramBuckAccounts.rosterId],
			set: { updatedAt: new Date() },
		})
		.returning();

	if (!account) return NextResponse.json({ error: "Failed to get account" }, { status: 500 });

	// Update balance
	const newBalance = Math.max(0, account.balance + amount);
	const lifetimeDelta = amount > 0 ? amount : 0;

	const [updated] = await db
		.update(ramBuckAccounts)
		.set({
			balance: newBalance,
			lifetimeEarned: account.lifetimeEarned + lifetimeDelta,
			updatedAt: new Date(),
		})
		.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)))
		.returning();

	// Insert transaction record
	const [transaction] = await db
		.insert(ramBuckTransactions)
		.values({
			classId,
			rosterId,
			sessionId: sessionId ?? null,
			type,
			amount,
			reason,
		})
		.returning();

	return NextResponse.json({ account: updated, transaction });
}
