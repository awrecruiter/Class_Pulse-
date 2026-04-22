export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { pacingOverrides } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const upsertSchema = z.object({
	topicNumber: z.number().int().min(1).max(18),
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	cascadeMode: z.enum(["push_forward", "push_back", "stack"]).default("push_forward"),
});

/** GET /api/pacing/overrides — all overrides for the authenticated teacher */
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await db
		.select()
		.from(pacingOverrides)
		.where(eq(pacingOverrides.teacherId, data.user.id));
	return NextResponse.json({ overrides: rows });
}

/** POST /api/pacing/overrides — upsert a topic-level start-date override */
export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = upsertSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { topicNumber, startDate, cascadeMode } = result.data;
	const teacherId = data.user.id;

	const [row] = await db
		.insert(pacingOverrides)
		.values({ teacherId, topicNumber, startDate, cascadeMode })
		.onConflictDoUpdate({
			target: [pacingOverrides.teacherId, pacingOverrides.topicNumber],
			set: { startDate, cascadeMode, updatedAt: new Date() },
		})
		.returning();

	return NextResponse.json({ override: row });
}

/** DELETE /api/pacing/overrides?topic=N — remove a topic override (revert to YAAG date) */
export async function DELETE(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const topicParam = new URL(request.url).searchParams.get("topic");
	const topicNumber = topicParam ? Number.parseInt(topicParam, 10) : NaN;
	if (!Number.isFinite(topicNumber) || topicNumber < 1 || topicNumber > 18) {
		return NextResponse.json({ error: "topic param required (1–18)" }, { status: 400 });
	}

	await db.delete(pacingOverrides).where(eq(pacingOverrides.teacherId, data.user.id));

	return NextResponse.json({ ok: true });
}
