export const dynamic = "force-dynamic";

import { and, desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import {
	classSessions,
	privilegeItems,
	privilegePurchases,
	ramBuckFeeSchedule,
	ramBuckTransactions,
} from "@/lib/db/schema";
import { correctionRateLimiter } from "@/lib/rate-limit";

export type LedgerEntry = {
	id: string;
	date: string;
	label: string;
	amount: number | null;
	kind: "credit" | "debit" | "pending" | "rejected";
};

export type FeeRow = {
	step: number;
	label: string;
	deductionAmount: number;
};

const TYPE_LABELS: Record<string, string> = {
	"academic-correct": "Correct answer",
	"academic-mastery": "Mastery bonus",
	"academic-iready": "iReady goal",
	"behavior-positive": "Positive behavior",
	"behavior-fine": "Behavior fine",
	purchase: "Store purchase",
	"manual-award": "Teacher award",
	"manual-deduct": "Teacher deduction",
	reset: "Balance reset",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!correctionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const token = request.cookies.get(STUDENT_COOKIE)?.value;
	if (!token) return NextResponse.json({ error: "Not joined" }, { status: 401 });

	const payload = verifyStudentToken(token);
	if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

	const { id: sessionId } = await params;
	if (payload.sessionId !== sessionId)
		return NextResponse.json({ error: "Session mismatch" }, { status: 403 });

	const [session] = await db
		.select({ classId: classSessions.classId, teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

	const { classId, teacherId } = session;
	const { rosterId } = payload;

	// 1. Balance transactions (last 40)
	const txns = await db
		.select({
			id: ramBuckTransactions.id,
			type: ramBuckTransactions.type,
			amount: ramBuckTransactions.amount,
			reason: ramBuckTransactions.reason,
			createdAt: ramBuckTransactions.createdAt,
		})
		.from(ramBuckTransactions)
		.where(
			and(eq(ramBuckTransactions.classId, classId), eq(ramBuckTransactions.rosterId, rosterId)),
		)
		.orderBy(desc(ramBuckTransactions.createdAt))
		.limit(40);

	// 2. Pending + rejected purchase requests (not yet in transactions)
	const pendingRejected = await db
		.select({
			id: privilegePurchases.id,
			itemId: privilegePurchases.itemId,
			cost: privilegePurchases.cost,
			status: privilegePurchases.status,
			requestedAt: privilegePurchases.requestedAt,
		})
		.from(privilegePurchases)
		.where(
			and(
				eq(privilegePurchases.classId, classId),
				eq(privilegePurchases.rosterId, rosterId),
				inArray(privilegePurchases.status, ["pending", "rejected"]),
			),
		)
		.orderBy(desc(privilegePurchases.requestedAt))
		.limit(20);

	// Fetch item names for those purchases
	const itemIds = [...new Set(pendingRejected.map((p) => p.itemId))];
	const itemNames: Record<string, string> = {};
	if (itemIds.length > 0) {
		const items = await db
			.select({ id: privilegeItems.id, name: privilegeItems.name })
			.from(privilegeItems)
			.where(inArray(privilegeItems.id, itemIds));
		for (const item of items) itemNames[item.id] = item.name;
	}

	// Build unified ledger entries
	const entries: LedgerEntry[] = [];

	for (const t of txns) {
		entries.push({
			id: t.id,
			date: t.createdAt.toISOString(),
			label: t.reason || TYPE_LABELS[t.type] || t.type,
			amount: t.amount,
			kind: t.amount >= 0 ? "credit" : "debit",
		});
	}

	for (const p of pendingRejected) {
		const name = itemNames[p.itemId] ?? "Store item";
		entries.push({
			id: p.id,
			date: p.requestedAt.toISOString(),
			label: `${name} — ${p.status === "pending" ? "Pending approval" : "Request denied"}`,
			amount: p.status === "rejected" ? null : null,
			kind: p.status === "pending" ? "pending" : "rejected",
		});
	}

	// Sort by date desc, cap at 50
	entries.sort((a, b) => b.date.localeCompare(a.date));
	entries.splice(50);

	// Fee schedule — behavior deductions the student may incur
	const fees = await db
		.select({
			step: ramBuckFeeSchedule.step,
			label: ramBuckFeeSchedule.label,
			deductionAmount: ramBuckFeeSchedule.deductionAmount,
		})
		.from(ramBuckFeeSchedule)
		.where(eq(ramBuckFeeSchedule.teacherId, teacherId))
		.orderBy(ramBuckFeeSchedule.step);

	return NextResponse.json({ entries, fees });
}
