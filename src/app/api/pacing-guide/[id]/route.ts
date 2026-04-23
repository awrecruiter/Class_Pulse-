import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { pacingGuideEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	await db
		.delete(pacingGuideEntries)
		.where(and(eq(pacingGuideEntries.id, id), eq(pacingGuideEntries.teacherId, data.user.id)));

	return NextResponse.json({ ok: true });
}
