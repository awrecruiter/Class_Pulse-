import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	groupAccounts,
	groupMemberships,
	ramBuckAccounts,
	ramBuckTransactions,
} from "@/lib/db/schema";

export type TransactionType =
	| "academic-correct"
	| "academic-mastery"
	| "academic-iready"
	| "behavior-positive"
	| "behavior-fine"
	| "purchase"
	| "manual-award"
	| "manual-deduct"
	| "reset";

export async function awardRamBucks(params: {
	classId: string;
	rosterId: string;
	sessionId: string | null;
	type: TransactionType;
	amount: number; // positive = earn, negative = deduct
	reason: string;
}): Promise<{ newBalance: number; groupBalance: number | null }> {
	const { classId, rosterId, sessionId, type, amount, reason } = params;

	// 1. Upsert individual account then atomically update balance.
	// Using GREATEST(0, balance + amount) prevents going negative without a
	// read-modify-write race — two concurrent requests can't both read the
	// same stale balance and both write it back.
	await db.insert(ramBuckAccounts).values({ classId, rosterId }).onConflictDoNothing();

	const [updated] = await db
		.update(ramBuckAccounts)
		.set({
			balance: sql`GREATEST(0, balance + ${amount})`,
			lifetimeEarned: sql`lifetime_earned + GREATEST(0, ${amount})`,
			updatedAt: new Date(),
		})
		.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)))
		.returning({ balance: ramBuckAccounts.balance });

	if (!updated) {
		return { newBalance: 0, groupBalance: null };
	}

	const newBalance = updated.balance;

	// 2. Insert transaction record
	await db.insert(ramBuckTransactions).values({
		classId,
		rosterId,
		sessionId: sessionId ?? null,
		type,
		amount,
		reason,
	});

	// 3. Group account update
	// Store purchases and resets don't affect group coins — only active behavioral choices do.
	if (type === "purchase" || type === "reset") {
		return { newBalance, groupBalance: null };
	}

	const [membership] = await db
		.select({ groupId: groupMemberships.groupId })
		.from(groupMemberships)
		.where(and(eq(groupMemberships.classId, classId), eq(groupMemberships.rosterId, rosterId)));

	if (!membership) {
		return { newBalance, groupBalance: null };
	}

	const { groupId } = membership;

	// Upsert group account then atomically apply coin delta.
	// Punitive asymmetric: earning contributes +1 coin, deductions cost -2 coins.
	// Amount is irrelevant — only the direction of the behavioral choice matters.
	await db.insert(groupAccounts).values({ classId, groupId }).onConflictDoNothing();

	const coinDelta = amount > 0 ? 1 : -2;

	const [updatedGroup] = await db
		.update(groupAccounts)
		.set({
			balance: sql`GREATEST(0, balance + ${coinDelta})`,
			updatedAt: new Date(),
		})
		.where(and(eq(groupAccounts.classId, classId), eq(groupAccounts.groupId, groupId)))
		.returning({ balance: groupAccounts.balance });

	return { newBalance, groupBalance: updatedGroup?.balance ?? null };
}
