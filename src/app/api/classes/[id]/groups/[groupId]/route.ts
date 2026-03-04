import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	behaviorProfiles,
	classes,
	groupMemberships,
	ramBuckAccounts,
	studentGroups,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const moveStudentSchema = z.object({
	rosterId: z.string().uuid(),
});

const renameGroupSchema = z.object({
	name: z.string().min(1).max(50).optional(),
	emoji: z.string().min(1).max(10).optional(),
});

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

// PUT /api/classes/[id]/groups/[groupId] — move student to this group
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; groupId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, groupId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	// Verify group belongs to this class
	const [group] = await db
		.select()
		.from(studentGroups)
		.where(and(eq(studentGroups.id, groupId), eq(studentGroups.classId, classId)));
	if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

	const body = await request.json();
	const result = moveStudentSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { rosterId } = result.data;

	// Enforce max 6 students per group
	const currentMembers = await db
		.select({ rosterId: groupMemberships.rosterId })
		.from(groupMemberships)
		.where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.classId, classId)));

	const alreadyInGroup = currentMembers.some((m) => m.rosterId === rosterId);
	if (!alreadyInGroup && currentMembers.length >= 6) {
		return NextResponse.json({ error: "Group is full (max 6 students)" }, { status: 400 });
	}

	// Upsert membership
	await db
		.insert(groupMemberships)
		.values({ classId, groupId, rosterId })
		.onConflictDoUpdate({
			target: [groupMemberships.classId, groupMemberships.rosterId],
			set: { groupId, assignedAt: new Date() },
		});

	// Ensure ram buck account exists for student
	await db.insert(ramBuckAccounts).values({ classId, rosterId }).onConflictDoNothing();

	// Ensure behavior profile exists for student
	await db.insert(behaviorProfiles).values({ classId, rosterId }).onConflictDoNothing();

	return NextResponse.json({ ok: true });
}

// PATCH /api/classes/[id]/groups/[groupId] — rename group
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; groupId: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, groupId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = renameGroupSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	if (!result.data.name && !result.data.emoji) {
		return NextResponse.json({ error: "Provide name or emoji to update" }, { status: 400 });
	}

	const [updated] = await db
		.update(studentGroups)
		.set({
			...(result.data.name ? { name: result.data.name } : {}),
			...(result.data.emoji ? { emoji: result.data.emoji } : {}),
		})
		.where(and(eq(studentGroups.id, groupId), eq(studentGroups.classId, classId)))
		.returning();

	if (!updated) return NextResponse.json({ error: "Group not found" }, { status: 404 });

	return NextResponse.json({ group: updated });
}
