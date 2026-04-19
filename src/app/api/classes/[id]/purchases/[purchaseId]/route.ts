export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, privilegePurchases, ramBuckAccounts, ramBuckTransactions } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const actionSchema = z.object({
	action: z.enum(["approve", "reject"]),
});

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; purchaseId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, purchaseId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = actionSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	// Get purchase
	const [purchase] = await db
		.select()
		.from(privilegePurchases)
		.where(and(eq(privilegePurchases.id, purchaseId), eq(privilegePurchases.classId, classId)));

	if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
	if (purchase.status !== "pending")
		return NextResponse.json({ error: "Purchase already processed" }, { status: 400 });

	const now = new Date();

	if (result.data.action === "approve") {
		// Deduct RAM bucks
		const [account] = await db
			.select()
			.from(ramBuckAccounts)
			.where(
				and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, purchase.rosterId)),
			);

		if (!account || account.balance < purchase.cost) {
			return NextResponse.json({ error: "Insufficient RAM Bucks" }, { status: 400 });
		}

		await db
			.update(ramBuckAccounts)
			.set({ balance: Math.max(0, account.balance - purchase.cost), updatedAt: now })
			.where(
				and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, purchase.rosterId)),
			);

		await db.insert(ramBuckTransactions).values({
			classId,
			rosterId: purchase.rosterId,
			type: "purchase",
			amount: -purchase.cost,
			reason: `Store purchase approved (purchase #${purchaseId.slice(0, 8)})`,
		});

		const [updated] = await db
			.update(privilegePurchases)
			.set({ status: "approved", processedAt: now })
			.where(eq(privilegePurchases.id, purchaseId))
			.returning();

		return NextResponse.json({ purchase: updated });
	} else {
		// Reject — no RAM buck changes
		const [updated] = await db
			.update(privilegePurchases)
			.set({ status: "rejected", processedAt: now })
			.where(eq(privilegePurchases.id, purchaseId))
			.returning();

		return NextResponse.json({ purchase: updated });
	}
}
