export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { lessonResourceDefaults, lessonResources } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";
import type { LessonResource } from "@/types";

const upsertSchema = z.object({
	topicNumber: z.number().int().min(1).max(18),
	lessonNumber: z.string().min(1).max(20),
	resourceType: z.enum(["slides", "book", "worksheet", "video", "other"]),
	label: z.string().min(1).max(120),
	url: z.string().url().max(2048),
	isHidden: z.boolean().optional().default(false),
	sortOrder: z.number().int().optional().default(0),
});

function mergeResources(
	defaults: (typeof lessonResourceDefaults.$inferSelect)[],
	overrides: (typeof lessonResources.$inferSelect)[],
): LessonResource[] {
	const hiddenTypes = new Set(overrides.filter((o) => o.isHidden).map((o) => o.resourceType));
	const overrideMap = new Map(overrides.filter((o) => !o.isHidden).map((o) => [o.resourceType, o]));

	const effective: LessonResource[] = [];

	for (const d of defaults) {
		if (hiddenTypes.has(d.resourceType)) continue;
		const override = overrideMap.get(d.resourceType);
		if (override) {
			effective.push({
				...override,
				resourceType: override.resourceType as LessonResource["resourceType"],
				isTeacherOverride: true,
			});
			overrideMap.delete(d.resourceType);
		} else {
			effective.push({
				...d,
				resourceType: d.resourceType as LessonResource["resourceType"],
				isTeacherOverride: false,
			});
		}
	}

	for (const o of overrideMap.values()) {
		effective.push({
			...o,
			resourceType: o.resourceType as LessonResource["resourceType"],
			isTeacherOverride: true,
		});
	}

	return effective.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** GET /api/resources/lesson?topic=N&lesson=X — merged resources for one lesson
 *  GET /api/resources/lesson — all teacher overrides (no params) for the catalog page */
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const params = new URL(request.url).searchParams;
	const topicParam = params.get("topic");
	const lessonParam = params.get("lesson");

	// No params → return all teacher overrides for catalog page
	if (!topicParam && !lessonParam) {
		const rows = await db
			.select()
			.from(lessonResources)
			.where(eq(lessonResources.teacherId, data.user.id));
		return NextResponse.json({ resources: rows });
	}

	const topicNumber = topicParam ? Number.parseInt(topicParam, 10) : NaN;
	if (!Number.isFinite(topicNumber) || topicNumber < 1 || topicNumber > 18 || !lessonParam) {
		return NextResponse.json({ error: "topic (1–18) and lesson params required" }, { status: 400 });
	}

	const [defaults, overrides] = await Promise.all([
		db
			.select()
			.from(lessonResourceDefaults)
			.where(
				and(
					eq(lessonResourceDefaults.topicNumber, topicNumber),
					eq(lessonResourceDefaults.lessonNumber, lessonParam),
				),
			),
		db
			.select()
			.from(lessonResources)
			.where(
				and(
					eq(lessonResources.teacherId, data.user.id),
					eq(lessonResources.topicNumber, topicNumber),
					eq(lessonResources.lessonNumber, lessonParam),
				),
			),
	]);

	return NextResponse.json({ resources: mergeResources(defaults, overrides) });
}

/** POST /api/resources/lesson — upsert a teacher override */
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

	const { topicNumber, lessonNumber, resourceType, label, url, isHidden, sortOrder } = result.data;
	const teacherId = data.user.id;

	const [row] = await db
		.insert(lessonResources)
		.values({ teacherId, topicNumber, lessonNumber, resourceType, label, url, isHidden, sortOrder })
		.onConflictDoUpdate({
			target: [
				lessonResources.teacherId,
				lessonResources.topicNumber,
				lessonResources.lessonNumber,
				lessonResources.resourceType,
			],
			set: { label, url, isHidden, sortOrder, updatedAt: new Date() },
		})
		.returning();

	return NextResponse.json({ resource: row });
}

/** DELETE /api/resources/lesson?id=UUID — remove a teacher override by id */
export async function DELETE(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = new URL(request.url).searchParams.get("id");
	if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

	await db
		.delete(lessonResources)
		.where(and(eq(lessonResources.id, id), eq(lessonResources.teacherId, data.user.id)));

	return NextResponse.json({ ok: true });
}
