export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { blockedDays, pacingLessonPlacements, pacingOverrides } from "@/lib/db/schema";
import {
	buildCalendarDays,
	type CascadeMode,
	computeEffectiveTopicDates,
	resolveDrag,
} from "@/lib/pacing-calendar";
import { sessionRateLimiter } from "@/lib/rate-limit";

const lessonRefSchema = z.object({
	topicNumber: z.number().int().min(1).max(18),
	lessonNumber: z.string().max(10),
});

const dragSchema = z.object({
	/** Lessons being dragged */
	lessons: z.array(lessonRefSchema).min(1).max(50),
	/** First target date (YYYY-MM-DD) */
	targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	cascadeMode: z.enum(["push_forward", "push_back", "stack"]),
	/** Full range the client is currently viewing — used to load context */
	viewStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	viewEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/pacing/placements — resolve + persist a drag operation.
 * Body: DragSchema
 * Returns: updated CalendarDay[] for the view range (for optimistic update)
 */
export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = dragSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { lessons, targetDate, cascadeMode, viewStart, viewEnd } = result.data;
	const teacherId = data.user.id;

	// Load current state
	const [overrides, blocked, placements] = await Promise.all([
		db.select().from(pacingOverrides).where(eq(pacingOverrides.teacherId, teacherId)),
		db.select().from(blockedDays).where(eq(blockedDays.teacherId, teacherId)),
		db.select().from(pacingLessonPlacements).where(eq(pacingLessonPlacements.teacherId, teacherId)),
	]);

	const effectiveTopics = computeEffectiveTopicDates(overrides);
	const calendarDays = buildCalendarDays({
		rangeStart: viewStart,
		rangeEnd: viewEnd,
		effectiveTopics,
		blockedDays: blocked,
		explicitPlacements: placements,
	});

	const blockedSet = new Set(blocked.map((b) => b.date));

	const resolution = resolveDrag({
		dragging: lessons,
		targetDate,
		cascadeMode: cascadeMode as CascadeMode,
		calendarDays,
		blockedDays: blockedSet,
		allLessons: new Map(),
	});

	// Delete old placements for moved lessons
	if (resolution.deletedPlacements.length > 0) {
		// Delete each individually to avoid complex AND/OR chains
		for (const del of resolution.deletedPlacements) {
			await db
				.delete(pacingLessonPlacements)
				.where(
					and(
						eq(pacingLessonPlacements.teacherId, teacherId),
						eq(pacingLessonPlacements.topicNumber, del.topicNumber),
						eq(pacingLessonPlacements.lessonNumber, del.lessonNumber),
					),
				);
		}
	}

	// Upsert new placements
	for (const p of resolution.newPlacements) {
		await db
			.insert(pacingLessonPlacements)
			.values({ teacherId, ...p })
			.onConflictDoUpdate({
				target: [
					pacingLessonPlacements.teacherId,
					pacingLessonPlacements.topicNumber,
					pacingLessonPlacements.lessonNumber,
				],
				set: { date: p.date, updatedAt: new Date() },
			});
	}

	// Return updated calendar for the view range
	const freshPlacements = await db
		.select()
		.from(pacingLessonPlacements)
		.where(eq(pacingLessonPlacements.teacherId, teacherId));

	const updatedDays = buildCalendarDays({
		rangeStart: viewStart,
		rangeEnd: viewEnd,
		effectiveTopics,
		blockedDays: blocked,
		explicitPlacements: freshPlacements,
	});

	return NextResponse.json({ days: updatedDays, rescheduledCount: resolution.rescheduledCount });
}

/** DELETE /api/pacing/placements — reset all explicit placements (revert to computed) */
export async function DELETE(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await db.delete(pacingLessonPlacements).where(eq(pacingLessonPlacements.teacherId, data.user.id));
	return NextResponse.json({ ok: true });
}
