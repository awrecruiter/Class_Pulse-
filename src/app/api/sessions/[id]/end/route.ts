export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classSessions } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const [session] = await db
		.select()
		.from(classSessions)
		.where(and(eq(classSessions.id, id), eq(classSessions.teacherId, data.user.id)));

	if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const [ended] = await db
		.update(classSessions)
		.set({ status: "ended", endedAt: new Date() })
		.where(eq(classSessions.id, id))
		.returning();

	return NextResponse.json({ session: ended });
}
