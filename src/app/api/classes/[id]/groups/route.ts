export const dynamic = "force-dynamic";

import { and, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	behaviorProfiles,
	classes,
	groupAccounts,
	groupMemberships,
	ramBuckAccounts,
	rosterEntries,
	studentGroups,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const DEFAULT_GROUPS = [
	{ name: "Dogs", emoji: "🐕", color: "amber", sortOrder: 0 },
	{ name: "Cats", emoji: "🐱", color: "purple", sortOrder: 1 },
	{ name: "Birds", emoji: "🐦", color: "sky", sortOrder: 2 },
	{ name: "Bears", emoji: "🐻", color: "green", sortOrder: 3 },
];

const actionSchema = z.object({
	action: z.enum(["auto-assign", "create-groups"]),
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

	const groups = await db
		.select()
		.from(studentGroups)
		.where(eq(studentGroups.classId, classId))
		.orderBy(studentGroups.sortOrder);
	const ensuredGroups =
		groups.length > 0
			? groups
			: (
					await db
						.insert(studentGroups)
						.values(DEFAULT_GROUPS.map((g) => ({ ...g, classId })))
						.returning()
				).sort((a, b) => a.sortOrder - b.sortOrder);

	const memberships = await db
		.select({
			id: groupMemberships.id,
			groupId: groupMemberships.groupId,
			rosterId: groupMemberships.rosterId,
			assignedAt: groupMemberships.assignedAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(groupMemberships)
		.innerJoin(rosterEntries, eq(groupMemberships.rosterId, rosterEntries.id))
		.where(eq(groupMemberships.classId, classId));

	const groupsWithMembers = ensuredGroups.map((g) => ({
		...g,
		members: memberships.filter((m) => m.groupId === g.id),
	}));

	return NextResponse.json({ groups: groupsWithMembers });
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
	const result = actionSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	// Create or fetch the 4 default groups
	const existingGroups = await db
		.select()
		.from(studentGroups)
		.where(eq(studentGroups.classId, classId))
		.orderBy(studentGroups.sortOrder);

	let groups = existingGroups;

	if (groups.length === 0) {
		const inserted = await db
			.insert(studentGroups)
			.values(DEFAULT_GROUPS.map((g) => ({ ...g, classId })))
			.returning();
		groups = inserted.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	// create-groups: just return the empty groups, no student assignment
	if (result.data.action === "create-groups") {
		const groupsWithMembers = groups.map((g) => ({ ...g, members: [] }));
		return NextResponse.json({ groups: groupsWithMembers });
	}

	// Get all active roster entries with performance scores
	const roster = await db
		.select()
		.from(rosterEntries)
		.where(and(eq(rosterEntries.classId, classId), eq(rosterEntries.isActive, true)));

	// Sort by performanceScore DESC if any student has a score; else keep original order
	const hasScores = roster.some((s) => s.performanceScore !== null);
	const sorted = hasScores
		? [...roster].sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0))
		: roster;

	// Snake-draft distribution: round 1 → 0,1,2,3; round 2 → 3,2,1,0; ...
	// Ensures top performers are spread across all groups.
	const groupCount = groups.length;
	const membershipValues = sorted
		.map((student, i) => {
			const round = Math.floor(i / groupCount);
			const pos = i % groupCount;
			const groupIndex = round % 2 === 0 ? pos : groupCount - 1 - pos;
			const group = groups[groupIndex];
			if (!group) return null;
			return { classId, groupId: group.id, rosterId: student.id };
		})
		.filter((v): v is { classId: string; groupId: string; rosterId: string } => v !== null);

	if (membershipValues.length > 0) {
		await db
			.insert(groupMemberships)
			.values(membershipValues)
			.onConflictDoUpdate({
				target: [groupMemberships.classId, groupMemberships.rosterId],
				set: {
					groupId: sql`excluded.group_id`,
					assignedAt: new Date(),
				},
			});

		// Also upsert ram buck accounts and behavior profiles for all students
		const accountValues = roster.map((student) => ({
			classId,
			rosterId: student.id,
		}));
		await db.insert(ramBuckAccounts).values(accountValues).onConflictDoNothing();

		const profileValues = roster.map((student) => ({
			classId,
			rosterId: student.id,
		}));
		await db.insert(behaviorProfiles).values(profileValues).onConflictDoNothing();

		// Seed group accounts for each group
		await db
			.insert(groupAccounts)
			.values(groups.map((g) => ({ classId, groupId: g.id })))
			.onConflictDoNothing();
	}

	// Re-fetch with members
	const memberships = await db
		.select({
			id: groupMemberships.id,
			groupId: groupMemberships.groupId,
			rosterId: groupMemberships.rosterId,
			assignedAt: groupMemberships.assignedAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(groupMemberships)
		.innerJoin(rosterEntries, eq(groupMemberships.rosterId, rosterEntries.id))
		.where(eq(groupMemberships.classId, classId));

	const groupsWithMembers = groups.map((g) => ({
		...g,
		members: memberships.filter((m) => m.groupId === g.id),
	}));

	return NextResponse.json({ groups: groupsWithMembers, usedPerformanceScores: hasScores });
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	// Delete all group memberships for this class (keeps groups, just unassigns everyone)
	const classGroups = await db
		.select({ id: studentGroups.id })
		.from(studentGroups)
		.where(eq(studentGroups.classId, classId));

	if (classGroups.length > 0) {
		await db.delete(groupMemberships).where(
			inArray(
				groupMemberships.groupId,
				classGroups.map((g) => g.id),
			),
		);
	}

	return NextResponse.json({ cleared: true });
}
