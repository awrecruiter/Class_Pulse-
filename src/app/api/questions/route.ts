export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { questionBankItems } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const resourceType = searchParams.get("resourceType");

	const conditions = [eq(questionBankItems.teacherId, data.user.id)];
	if (resourceType) conditions.push(eq(questionBankItems.resourceType, resourceType));

	const questions = await db
		.select()
		.from(questionBankItems)
		.where(and(...conditions))
		.orderBy(desc(questionBankItems.extractedAt))
		.catch(() => [] as (typeof questionBankItems.$inferSelect)[]);

	return NextResponse.json({ questions });
}
