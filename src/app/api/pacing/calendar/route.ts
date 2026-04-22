export const dynamic = "force-dynamic";

import { and, eq, gte, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { blockedDays, pacingLessonPlacements, pacingOverrides } from "@/lib/db/schema";
import { buildCalendarDays, computeEffectiveTopicDates } from "@/lib/pacing-calendar";
import { sessionRateLimiter } from "@/lib/rate-limit";

/**
 * GET /api/pacing/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns CalendarDay[] for the requested date range.
 */
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const start = searchParams.get("start");
	const end = searchParams.get("end");

	if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
		return NextResponse.json(
			{ error: "start and end params required (YYYY-MM-DD)" },
			{ status: 400 },
		);
	}

	const teacherId = data.user.id;

	const [overrides, blocked, placements] = await Promise.all([
		db.select().from(pacingOverrides).where(eq(pacingOverrides.teacherId, teacherId)),
		db
			.select()
			.from(blockedDays)
			.where(
				and(
					eq(blockedDays.teacherId, teacherId),
					gte(blockedDays.date, start),
					lte(blockedDays.date, end),
				),
			),
		db
			.select()
			.from(pacingLessonPlacements)
			.where(
				and(
					eq(pacingLessonPlacements.teacherId, teacherId),
					gte(pacingLessonPlacements.date, start),
					lte(pacingLessonPlacements.date, end),
				),
			),
	]);

	const effectiveTopics = computeEffectiveTopicDates(overrides);
	const days = buildCalendarDays({
		rangeStart: start,
		rangeEnd: end,
		effectiveTopics,
		blockedDays: blocked,
		explicitPlacements: placements,
	});

	return NextResponse.json({ days });
}
