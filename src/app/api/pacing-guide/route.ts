export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { pacingGuideEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const createSchema = z.object({
	weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	standardCode: z.string().min(1).max(32),
	title: z.string().max(120).optional().default(""),
});

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const entries = await db
		.select()
		.from(pacingGuideEntries)
		.where(eq(pacingGuideEntries.teacherId, data.user.id))
		.orderBy(pacingGuideEntries.weekOf);

	return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = createSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [entry] = await db
		.insert(pacingGuideEntries)
		.values({
			teacherId: data.user.id,
			weekOf: result.data.weekOf,
			standardCode: result.data.standardCode,
			title: result.data.title,
		})
		.onConflictDoUpdate({
			target: [pacingGuideEntries.teacherId, pacingGuideEntries.weekOf],
			set: {
				standardCode: result.data.standardCode,
				title: result.data.title,
			},
		})
		.returning();

	return NextResponse.json({ entry }, { status: 201 });
}
