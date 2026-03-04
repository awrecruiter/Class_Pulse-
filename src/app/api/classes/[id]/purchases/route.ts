import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	behaviorProfiles,
	classes,
	privilegeItems,
	privilegePurchases,
	ramBuckAccounts,
	rosterEntries,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const purchaseSchema = z.object({
	rosterId: z.string().uuid(),
	itemId: z.string().uuid(),
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

	const purchases = await db
		.select({
			id: privilegePurchases.id,
			rosterId: privilegePurchases.rosterId,
			itemId: privilegePurchases.itemId,
			cost: privilegePurchases.cost,
			status: privilegePurchases.status,
			requestedAt: privilegePurchases.requestedAt,
			processedAt: privilegePurchases.processedAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
			itemName: privilegeItems.name,
			itemDurationMinutes: privilegeItems.durationMinutes,
		})
		.from(privilegePurchases)
		.innerJoin(rosterEntries, eq(privilegePurchases.rosterId, rosterEntries.id))
		.innerJoin(privilegeItems, eq(privilegePurchases.itemId, privilegeItems.id))
		.where(and(eq(privilegePurchases.classId, classId), eq(privilegePurchases.status, "pending")))
		.orderBy(privilegePurchases.requestedAt);

	return NextResponse.json({ purchases });
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
	const result = purchaseSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { rosterId, itemId } = result.data;

	// Check student is not on step >= 5 (behavior restriction)
	const [behaviorProfile] = await db
		.select({ currentStep: behaviorProfiles.currentStep })
		.from(behaviorProfiles)
		.where(and(eq(behaviorProfiles.classId, classId), eq(behaviorProfiles.rosterId, rosterId)));

	if (behaviorProfile && behaviorProfile.currentStep >= 5) {
		return NextResponse.json(
			{ error: "Student is on Step 5+ and cannot make purchases" },
			{ status: 403 },
		);
	}

	// Get item details
	const [item] = await db
		.select()
		.from(privilegeItems)
		.where(and(eq(privilegeItems.id, itemId), eq(privilegeItems.isActive, true)));

	if (!item) return NextResponse.json({ error: "Item not found or inactive" }, { status: 404 });

	// Check student has enough balance
	const [account] = await db
		.select({ balance: ramBuckAccounts.balance })
		.from(ramBuckAccounts)
		.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)));

	if (!account || account.balance < item.cost) {
		return NextResponse.json({ error: "Insufficient RAM Bucks" }, { status: 400 });
	}

	// Create purchase request
	const [purchase] = await db
		.insert(privilegePurchases)
		.values({
			classId,
			rosterId,
			itemId,
			cost: item.cost,
			status: "pending",
		})
		.returning();

	return NextResponse.json({ purchase }, { status: 201 });
}
