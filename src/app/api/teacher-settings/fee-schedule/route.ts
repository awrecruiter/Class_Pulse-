import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { ramBuckFeeSchedule } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const DEFAULT_FEE_SCHEDULE = [
	{ step: 1, label: "Ram Buck Fine", deductionAmount: 5 },
	{ step: 2, label: "No Games", deductionAmount: 10 },
	{ step: 3, label: "No PE", deductionAmount: 15 },
	{ step: 4, label: "Silent Lunch", deductionAmount: 20 },
	{ step: 5, label: "Call Home", deductionAmount: 30 },
	{ step: 6, label: "Write Up", deductionAmount: 40 },
	{ step: 7, label: "Detention", deductionAmount: 60 },
	{ step: 8, label: "Saturday School", deductionAmount: 100 },
];

const updateScheduleSchema = z.object({
	schedule: z
		.array(
			z.object({
				step: z.number().int().min(1).max(8),
				label: z.string().min(1).max(100),
				deductionAmount: z.number().int().min(0).max(10000),
			}),
		)
		.min(1)
		.max(8),
});

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await db
		.select()
		.from(ramBuckFeeSchedule)
		.where(eq(ramBuckFeeSchedule.teacherId, data.user.id))
		.orderBy(ramBuckFeeSchedule.step);

	if (rows.length === 0) {
		// Seed defaults
		const seeded = await db
			.insert(ramBuckFeeSchedule)
			.values(DEFAULT_FEE_SCHEDULE.map((s) => ({ ...s, teacherId: data.user.id })))
			.returning();
		return NextResponse.json({ schedule: seeded.sort((a, b) => a.step - b.step) });
	}

	return NextResponse.json({ schedule: rows });
}

export async function PUT(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = updateScheduleSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const updated = await Promise.all(
		result.data.schedule.map((entry) =>
			db
				.insert(ramBuckFeeSchedule)
				.values({
					teacherId: data.user.id,
					step: entry.step,
					label: entry.label,
					deductionAmount: entry.deductionAmount,
				})
				.onConflictDoUpdate({
					target: [ramBuckFeeSchedule.teacherId, ramBuckFeeSchedule.step],
					set: {
						label: entry.label,
						deductionAmount: entry.deductionAmount,
						updatedAt: new Date(),
					},
				})
				.returning(),
		),
	);

	const flat = updated.flat().sort((a, b) => a.step - b.step);
	return NextResponse.json({ schedule: flat });
}
