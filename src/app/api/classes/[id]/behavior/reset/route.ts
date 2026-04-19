export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { behaviorProfiles, classes } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const resetSchema = z.object({
	rosterId: z.string().uuid().optional(),
});

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
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
	const result = resetSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const now = new Date();

	if (result.data.rosterId) {
		await db
			.update(behaviorProfiles)
			.set({ currentStep: 0, lastResetAt: now, updatedAt: now })
			.where(
				and(
					eq(behaviorProfiles.classId, classId),
					eq(behaviorProfiles.rosterId, result.data.rosterId),
				),
			);
	} else {
		await db
			.update(behaviorProfiles)
			.set({ currentStep: 0, lastResetAt: now, updatedAt: now })
			.where(eq(behaviorProfiles.classId, classId));
	}

	return NextResponse.json({ ok: true });
}
