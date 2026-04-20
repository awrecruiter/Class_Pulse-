export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import {
	behaviorProfiles,
	classSessions,
	privilegeItems,
	privilegePurchases,
	ramBuckAccounts,
	teacherSettings,
} from "@/lib/db/schema";
import { correctionRateLimiter } from "@/lib/rate-limit";

const postSchema = z.object({
	itemId: z.string().uuid(),
});

// Student: GET store state (open/closed, items, balance)
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

	// 1. Look up session to get classId and teacherId
	const [session] = await db
		.select({ classId: classSessions.classId, teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

	// 2. Look up teacherSettings for storeIsOpen
	const [settings] = await db
		.select({ storeIsOpen: teacherSettings.storeIsOpen })
		.from(teacherSettings)
		.where(eq(teacherSettings.userId, session.teacherId));

	const isOpen = settings?.storeIsOpen ?? false;

	// 3. Look up active privilege items for this teacher
	const items = await db
		.select({
			id: privilegeItems.id,
			name: privilegeItems.name,
			cost: privilegeItems.cost,
			durationMinutes: privilegeItems.durationMinutes,
			sortOrder: privilegeItems.sortOrder,
		})
		.from(privilegeItems)
		.where(and(eq(privilegeItems.teacherId, session.teacherId), eq(privilegeItems.isActive, true)))
		.orderBy(privilegeItems.sortOrder);

	// 4. Look up student's RAM Buck balance
	const [account] = await db
		.select({ balance: ramBuckAccounts.balance })
		.from(ramBuckAccounts)
		.where(
			and(
				eq(ramBuckAccounts.classId, session.classId),
				eq(ramBuckAccounts.rosterId, payload.rosterId),
			),
		);

	const balance = account?.balance ?? 0;

	return NextResponse.json({
		isOpen,
		items,
		balance,
		rosterId: payload.rosterId,
	});
}

// Student: POST purchase request
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

	const body = await request.json();
	const result = postSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { itemId } = result.data;

	// Look up session
	const [session] = await db
		.select({ classId: classSessions.classId, teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

	// Check 1: Store is open
	const [settings] = await db
		.select({ storeIsOpen: teacherSettings.storeIsOpen })
		.from(teacherSettings)
		.where(eq(teacherSettings.userId, session.teacherId));

	if (!settings?.storeIsOpen)
		return NextResponse.json({ error: "Store is closed" }, { status: 403 });

	// Check 2: Item exists and is active
	const [item] = await db
		.select({
			id: privilegeItems.id,
			name: privilegeItems.name,
			cost: privilegeItems.cost,
		})
		.from(privilegeItems)
		.where(
			and(
				eq(privilegeItems.id, itemId),
				eq(privilegeItems.teacherId, session.teacherId),
				eq(privilegeItems.isActive, true),
			),
		);

	if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

	// Check 3: Student behavior step < 5
	const [behaviorProfile] = await db
		.select({ currentStep: behaviorProfiles.currentStep })
		.from(behaviorProfiles)
		.where(
			and(
				eq(behaviorProfiles.classId, session.classId),
				eq(behaviorProfiles.rosterId, payload.rosterId),
			),
		);

	if (behaviorProfile && behaviorProfile.currentStep >= 5)
		return NextResponse.json({ error: "Purchasing restricted due to behavior" }, { status: 403 });

	// Check 4: Sufficient balance
	const [account] = await db
		.select({ balance: ramBuckAccounts.balance })
		.from(ramBuckAccounts)
		.where(
			and(
				eq(ramBuckAccounts.classId, session.classId),
				eq(ramBuckAccounts.rosterId, payload.rosterId),
			),
		);

	const balance = account?.balance ?? 0;
	if (balance < item.cost)
		return NextResponse.json({ error: "Insufficient RAM Bucks" }, { status: 400 });

	// Check 5: No duplicate pending request
	const [existing] = await db
		.select({ id: privilegePurchases.id })
		.from(privilegePurchases)
		.where(
			and(
				eq(privilegePurchases.classId, session.classId),
				eq(privilegePurchases.rosterId, payload.rosterId),
				eq(privilegePurchases.itemId, itemId),
				eq(privilegePurchases.status, "pending"),
			),
		);

	if (existing) return NextResponse.json({ error: "Request already pending" }, { status: 400 });

	// All checks passed — insert purchase request
	const [purchase] = await db
		.insert(privilegePurchases)
		.values({
			classId: session.classId,
			rosterId: payload.rosterId,
			itemId,
			cost: item.cost,
			status: "pending",
		})
		.returning();

	return NextResponse.json({ purchase }, { status: 201 });
}
