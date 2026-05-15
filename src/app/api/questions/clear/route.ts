export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { questionBankItems } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function DELETE(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await db.delete(questionBankItems).where(eq(questionBankItems.teacherId, data.user.id));

	return NextResponse.json({ ok: true });
}
