import { and, eq } from "drizzle-orm";
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

	// 1. Upsert individual account
	await db.insert(ramBuckAccounts).values({ classId, rosterId }).onConflictDoNothing();

	const [existing] = await db
		.select()
		.from(ramBuckAccounts)
		.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)));

	if (!existing) {
		return { newBalance: 0, groupBalance: null };
	}

	const newBalance = Math.max(0, existing.balance + amount);
	const lifetimeDelta = amount > 0 ? amount : 0;

	await db
		.update(ramBuckAccounts)
		.set({
			balance: newBalance,
			lifetimeEarned: existing.lifetimeEarned + lifetimeDelta,
			updatedAt: new Date(),
		})
		.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)));

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

	// Upsert group account
	await db.insert(groupAccounts).values({ classId, groupId }).onConflictDoNothing();

	const [groupAccount] = await db
		.select()
		.from(groupAccounts)
		.where(and(eq(groupAccounts.classId, classId), eq(groupAccounts.groupId, groupId)));

	if (!groupAccount) {
		return { newBalance, groupBalance: null };
	}

	// Punitive asymmetric: earning contributes +1 coin, deductions cost -2 coins.
	// Amount is irrelevant — only the direction of the behavioral choice matters.
	const coinDelta = amount > 0 ? 1 : -2;
	const newGroupBalance = Math.max(0, groupAccount.balance + coinDelta);

	await db
		.update(groupAccounts)
		.set({ balance: newGroupBalance, updatedAt: new Date() })
		.where(and(eq(groupAccounts.classId, classId), eq(groupAccounts.groupId, groupId)));

	return { newBalance, groupBalance: newGroupBalance };
}
