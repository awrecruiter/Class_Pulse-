import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { orientations } from "@/lib/db/schema";
import { ownsOrientationClass } from "@/lib/orientation/server";
import { orientationProgressSchema } from "@/lib/orientation/validation";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; inviteId: string }> },
) {
	if (!sessionRateLimiter.check(request.headers.get("x-forwarded-for") ?? "anonymous").success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { id, inviteId } = await params;
	if (
		!z.uuid().safeParse(id).success ||
		!z.uuid().safeParse(inviteId).success ||
		!(await ownsOrientationClass(id, data.user.id))
	)
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	const result = orientationProgressSchema.safeParse(await request.json().catch(() => null));
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	const { reviewed, ...fields } = result.data;
	const [updated] = await db
		.update(orientations)
		.set({ ...fields, reviewedAt: reviewed ? new Date() : null })
		.where(and(eq(orientations.id, inviteId), eq(orientations.classId, id)))
		.returning({ id: orientations.id });
	if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({ ok: true });
}
