import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, diGroups, diSessions } from "@/lib/db/schema";
import { diRateLimiter } from "@/lib/rate-limit";

const PatchGroupSchema = z.object({
	delta: z.number().int(),
});

type Params = { params: Promise<{ id: string; diSessionId: string; groupId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = diRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId, diSessionId, groupId } = await params;

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
	const parsed = PatchGroupSchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	const [group] = await db
		.select()
		.from(diGroups)
		.where(and(eq(diGroups.id, groupId), eq(diGroups.diSessionId, diSessionId)));
	if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

	const newPoints = Math.max(0, group.points + parsed.data.delta);
	const [updated] = await db
		.update(diGroups)
		.set({ points: newPoints })
		.where(eq(diGroups.id, groupId))
		.returning();

	return NextResponse.json({ group: updated });
}
