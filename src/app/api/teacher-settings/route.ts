import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { teacherSettings } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const updateSettingsSchema = z.object({
	masteryThreshold: z.number().int().min(1).max(10).optional(),
	confusionAlertPercent: z.number().int().min(10).max(90).optional(),
	useAliasMode: z.boolean().optional(),
	storeResetSchedule: z.enum(["daily", "weekly", "monthly", "quarterly", "manual"]).optional(),
	storeIsOpen: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const [settings] = await db
		.select()
		.from(teacherSettings)
		.where(eq(teacherSettings.userId, data.user.id));

	// Auto-create defaults on first access
	if (!settings) {
		const [created] = await db.insert(teacherSettings).values({ userId: data.user.id }).returning();
		return NextResponse.json({ settings: created });
	}

	return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = updateSettingsSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [updated] = await db
		.insert(teacherSettings)
		.values({ userId: data.user.id, ...result.data })
		.onConflictDoUpdate({
			target: teacherSettings.userId,
			set: { ...result.data, updatedAt: new Date() },
		})
		.returning();

	return NextResponse.json({ settings: updated });
}
