export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { questionBankItems } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const [deleted] = await db
		.delete(questionBankItems)
		.where(and(eq(questionBankItems.id, id), eq(questionBankItems.teacherId, data.user.id)))
		.returning({ id: questionBankItems.id });

	if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

	return NextResponse.json({ ok: true });
}
