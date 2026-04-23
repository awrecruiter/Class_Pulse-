import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, ramBuckAccounts, ramBuckTransactions, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const resetSchema = z.object({
	rosterId: z.string().uuid().optional(),
});

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
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
	const result = resetSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { rosterId } = result.data;

	if (rosterId) {
		// Reset single student
		const [account] = await db
			.select()
			.from(ramBuckAccounts)
			.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)));

		if (account) {
			await db
				.update(ramBuckAccounts)
				.set({ balance: 0, lastResetAt: new Date(), updatedAt: new Date() })
				.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)));

			await db.insert(ramBuckTransactions).values({
				classId,
				rosterId,
				type: "reset",
				amount: -account.balance,
				reason: "Balance reset by teacher",
			});
		}
	} else {
		// Reset ALL students in class
		const accounts = await db
			.select()
			.from(ramBuckAccounts)
			.where(eq(ramBuckAccounts.classId, classId));

		for (const account of accounts) {
			if (account.balance === 0) continue;

			await db
				.update(ramBuckAccounts)
				.set({ balance: 0, lastResetAt: new Date(), updatedAt: new Date() })
				.where(eq(ramBuckAccounts.id, account.id));

			await db.insert(ramBuckTransactions).values({
				classId,
				rosterId: account.rosterId,
				type: "reset",
				amount: -account.balance,
				reason: "Class-wide balance reset by teacher",
			});
		}
	}

	// Return updated accounts
	const accounts = await db
		.select({
			id: ramBuckAccounts.id,
			rosterId: ramBuckAccounts.rosterId,
			balance: ramBuckAccounts.balance,
			lifetimeEarned: ramBuckAccounts.lifetimeEarned,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(ramBuckAccounts)
		.innerJoin(rosterEntries, eq(ramBuckAccounts.rosterId, rosterEntries.id))
		.where(eq(ramBuckAccounts.classId, classId));

	return NextResponse.json({ accounts });
}
