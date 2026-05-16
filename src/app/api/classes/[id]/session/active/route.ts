import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, classSessions } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id: classId } = await params;

	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	// Verify teacher owns the class
	const cls = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)))
		.limit(1)
		.then((r) => r[0] ?? null);

	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const session = await db
		.select({ id: classSessions.id, joinCode: classSessions.joinCode })
		.from(classSessions)
		.where(and(eq(classSessions.classId, classId), eq(classSessions.status, "active")))
		.limit(1)
		.then((r) => r[0] ?? null);

	return NextResponse.json(
		session ? { id: session.id, joinCode: session.joinCode } : { id: null, joinCode: null },
	);
}
