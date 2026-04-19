export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, diGroupMembers, diGroups, diSessions } from "@/lib/db/schema";
import { diRateLimiter } from "@/lib/rate-limit";

const AddMembersSchema = z.object({
	rosterIds: z.array(z.string().uuid()).min(1),
});

const RemoveMemberSchema = z.object({
	rosterId: z.string().uuid(),
});

type Params = { params: Promise<{ id: string; diSessionId: string; groupId: string }> };

async function verifyAccess(classId: string, diSessionId: string, groupId: string, userId: string) {
	const [cls] = await db
		.select()
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, userId)));
	if (!cls) return null;

	const [session] = await db
		.select()
		.from(diSessions)
		.where(and(eq(diSessions.id, diSessionId), eq(diSessions.classId, classId)));
	if (!session || session.status !== "active") return null;

	const [group] = await db
		.select()
		.from(diGroups)
		.where(and(eq(diGroups.id, groupId), eq(diGroups.diSessionId, diSessionId)));
	if (!group) return null;

	return { cls, session, group };
}

export async function POST(request: NextRequest, { params }: Params) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = diRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, diSessionId, groupId } = await params;

	const access = await verifyAccess(classId, diSessionId, groupId, data.user.id);
	if (!access)
		return NextResponse.json({ error: "Not found or session not active" }, { status: 404 });

	const body = await request.json();
	const parsed = AddMembersSchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	// Insert with conflict ignore (unique index on diSessionId + rosterId)
	for (const rosterId of parsed.data.rosterIds) {
		await db
			.insert(diGroupMembers)
			.values({ diGroupId: groupId, diSessionId, rosterId })
			.onConflictDoNothing();
	}

	return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = diRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, diSessionId, groupId } = await params;

	const access = await verifyAccess(classId, diSessionId, groupId, data.user.id);
	if (!access)
		return NextResponse.json({ error: "Not found or session not active" }, { status: 404 });

	const body = await request.json();
	const parsed = RemoveMemberSchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	await db
		.delete(diGroupMembers)
		.where(
			and(eq(diGroupMembers.diGroupId, groupId), eq(diGroupMembers.rosterId, parsed.data.rosterId)),
		);

	return NextResponse.json({ ok: true });
}
