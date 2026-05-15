import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { questionBankItems } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function PATCH(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const teacherId = data.user.id;

	let body: { questionIds: string[]; date: string | null };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const { questionIds, date } = body;

	if (!Array.isArray(questionIds) || questionIds.length === 0) {
		return NextResponse.json({ error: "questionIds must be a non-empty array" }, { status: 400 });
	}

	if (date !== null && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
		return NextResponse.json({ error: "date must be YYYY-MM-DD or null" }, { status: 400 });
	}

	await db
		.update(questionBankItems)
		.set({ assignedDate: date })
		.where(
			and(inArray(questionBankItems.id, questionIds), eq(questionBankItems.teacherId, teacherId)),
		);

	return NextResponse.json({ updated: questionIds.length });
}
