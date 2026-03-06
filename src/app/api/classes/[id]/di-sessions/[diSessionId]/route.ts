import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, diGroupMembers, diGroups, diSessions } from "@/lib/db/schema";
import { awardRamBucks } from "@/lib/ram-bucks";
import { diRateLimiter } from "@/lib/rate-limit";

const PatchSchema = z.object({
	action: z.literal("end"),
});

type Params = { params: Promise<{ id: string; diSessionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = diRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, diSessionId } = await params;

	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

	const [session] = await db
		.select()
		.from(diSessions)
		.where(and(eq(diSessions.id, diSessionId), eq(diSessions.classId, classId)));
	if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

	const groups = await db.select().from(diGroups).where(eq(diGroups.diSessionId, diSessionId));
	const groupsWithMembers = await Promise.all(
		groups.map(async (group) => {
			const members = await db
				.select()
				.from(diGroupMembers)
				.where(eq(diGroupMembers.diGroupId, group.id));
			return { ...group, members };
		}),
	);

	return NextResponse.json({ session: { ...session, groups: groupsWithMembers } });
}

export async function PATCH(request: NextRequest, { params }: Params) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = diRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, diSessionId } = await params;

	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

	const body = await request.json();
	const parsed = PatchSchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	const [session] = await db
		.select()
		.from(diSessions)
		.where(and(eq(diSessions.id, diSessionId), eq(diSessions.classId, classId)));
	if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
	if (session.status !== "active")
		return NextResponse.json({ error: "Session already ended" }, { status: 409 });

	// Find all groups and determine winner(s) — ties all win
	const groups = await db.select().from(diGroups).where(eq(diGroups.diSessionId, diSessionId));

	const maxPoints = Math.max(...groups.map((g) => g.points));
	const winningGroups = groups.filter((g) => g.points === maxPoints);

	// Award RAM bucks to all members of winning group(s)
	const winners: { groupId: string; groupName: string; rosterIds: string[] }[] = [];
	for (const group of winningGroups) {
		const members = await db
			.select()
			.from(diGroupMembers)
			.where(eq(diGroupMembers.diGroupId, group.id));
		const rosterIds = members.map((m) => m.rosterId);
		for (const rosterId of rosterIds) {
			await awardRamBucks({
				classId,
				rosterId,
				sessionId: null,
				type: "behavior-positive",
				amount: session.rewardAmount,
				reason: `DI session winner — ${session.label}`,
			});
		}
		winners.push({ groupId: group.id, groupName: group.name, rosterIds });
	}

	// Mark session ended
	const [updated] = await db
		.update(diSessions)
		.set({ status: "ended", endedAt: new Date() })
		.where(eq(diSessions.id, diSessionId))
		.returning();

	return NextResponse.json({
		session: updated,
		winners,
		bucksAwarded: session.rewardAmount,
	});
}
