export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, diGroupMembers, diGroups, diSessions, teacherSettings } from "@/lib/db/schema";
import { diRateLimiter } from "@/lib/rate-limit";

const CreateSessionSchema = z.object({
	label: z.string().min(1).max(100).default("DI Activity"),
	groups: z
		.array(
			z.object({
				name: z.string().min(1).max(30),
				color: z.string().min(1).max(20),
				memberRosterIds: z.array(z.string()),
			}),
		)
		.min(2)
		.max(6),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = diRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;

	// Verify teacher owns this class
	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

	const sessions = await db
		.select()
		.from(diSessions)
		.where(eq(diSessions.classId, classId))
		.orderBy(diSessions.createdAt);

	// Load groups + members for each session
	const result = await Promise.all(
		sessions.map(async (session) => {
			const groups = await db.select().from(diGroups).where(eq(diGroups.diSessionId, session.id));
			const groupsWithMembers = await Promise.all(
				groups.map(async (group) => {
					const members = await db
						.select()
						.from(diGroupMembers)
						.where(eq(diGroupMembers.diGroupId, group.id));
					return { ...group, members };
				}),
			);
			return { ...session, groups: groupsWithMembers };
		}),
	);

	return NextResponse.json({ sessions: result });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = diRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;

	// Verify teacher owns class
	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

	const body = await request.json();
	const parsed = CreateSessionSchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	const { label, groups } = parsed.data;

	// Snapshot diRewardAmount from teacher settings
	const [settings] = await db
		.select()
		.from(teacherSettings)
		.where(eq(teacherSettings.userId, data.user.id));
	const rewardAmount = settings?.diRewardAmount ?? 10;

	// Create session
	const [session] = await db
		.insert(diSessions)
		.values({ classId, teacherId: data.user.id, label, rewardAmount })
		.returning();

	// Create groups + members
	const createdGroups = await Promise.all(
		groups.map(async (g) => {
			const [group] = await db
				.insert(diGroups)
				.values({ diSessionId: session.id, name: g.name, color: g.color })
				.returning();
			if (g.memberRosterIds.length > 0) {
				await db.insert(diGroupMembers).values(
					g.memberRosterIds.map((rosterId) => ({
						diGroupId: group.id,
						diSessionId: session.id,
						rosterId,
					})),
				);
			}
			return { ...group, members: g.memberRosterIds };
		}),
	);

	return NextResponse.json({ session: { ...session, groups: createdGroups } }, { status: 201 });
}
