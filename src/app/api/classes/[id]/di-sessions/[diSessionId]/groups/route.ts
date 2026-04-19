export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, diGroupMembers, diGroups, diSessions } from "@/lib/db/schema";
import { diRateLimiter } from "@/lib/rate-limit";

const AddGroupSchema = z.object({
	name: z.string().min(1).max(30),
	color: z.string().min(1).max(20),
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

	return NextResponse.json({ groups: groupsWithMembers });
}

export async function POST(request: NextRequest, { params }: Params) {
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
	if (session.status !== "active")
		return NextResponse.json({ error: "Session not active" }, { status: 409 });

	const body = await request.json();
	const parsed = AddGroupSchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	const [group] = await db
		.insert(diGroups)
		.values({ diSessionId, name: parsed.data.name, color: parsed.data.color })
		.returning();

	return NextResponse.json({ group: { ...group, members: [] } }, { status: 201 });
}
