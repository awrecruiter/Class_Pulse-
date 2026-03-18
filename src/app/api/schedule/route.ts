import { eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scheduleBlocks, scheduleDocLinks } from "@/lib/db/schema";
import { resolveDocUrl } from "@/lib/portal-urls";
import { sessionRateLimiter } from "@/lib/rate-limit";

const createBlockSchema = z.object({
	title: z.string().min(1).max(200),
	color: z.string().default("blue"),
	startTime: z.string().regex(/^\d{2}:\d{2}$/),
	endTime: z.string().regex(/^\d{2}:\d{2}$/),
	dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
	specificDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	sortOrder: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const dayParam = searchParams.get("day");
	const dateParam = searchParams.get("date");

	const day = dayParam !== null ? parseInt(dayParam, 10) : null;
	const date = dateParam ?? null;

	// Fetch all blocks for this teacher
	const allBlocks = await db
		.select()
		.from(scheduleBlocks)
		.where(eq(scheduleBlocks.teacherId, data.user.id));

	let selectedBlocks: typeof allBlocks;

	if (date !== null && day !== null) {
		// Date-specific blocks for this exact date
		const dateSpecific = allBlocks.filter((b) => b.specificDate === date);

		// Weekly blocks for this day of week, excluding startTimes overridden by a date-specific block
		const overriddenStartTimes = new Set(dateSpecific.map((b) => b.startTime));
		const weekly = allBlocks.filter(
			(b) =>
				b.dayOfWeek === day && b.specificDate === null && !overriddenStartTimes.has(b.startTime),
		);

		selectedBlocks = [...dateSpecific, ...weekly];
	} else if (day !== null) {
		selectedBlocks = allBlocks.filter((b) => b.dayOfWeek === day && b.specificDate === null);
	} else if (date !== null) {
		selectedBlocks = allBlocks.filter((b) => b.specificDate === date);
	} else {
		selectedBlocks = allBlocks;
	}

	// Sort by startTime
	selectedBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));

	// Fetch doc links for these blocks
	if (selectedBlocks.length === 0) {
		return NextResponse.json({ blocks: [] });
	}

	const blockIds = selectedBlocks.map((b) => b.id);
	const allDocLinks = await db
		.select()
		.from(scheduleDocLinks)
		.where(inArray(scheduleDocLinks.blockId, blockIds))
		.orderBy(scheduleDocLinks.sortOrder);

	// Group doc links by blockId
	const docsByBlock = new Map<string, typeof allDocLinks>();
	for (const doc of allDocLinks) {
		const arr = docsByBlock.get(doc.blockId) ?? [];
		arr.push(doc);
		docsByBlock.set(doc.blockId, arr);
	}

	const blocks = selectedBlocks.map((b) => ({
		id: b.id,
		title: b.title,
		color: b.color,
		blockType: b.blockType,
		startTime: b.startTime,
		endTime: b.endTime,
		dayOfWeek: b.dayOfWeek,
		specificDate: b.specificDate,
		sortOrder: b.sortOrder,
		docs: (docsByBlock.get(b.id) ?? []).map((d) => ({
			id: d.id,
			label: d.label,
			url: resolveDocUrl(d.url, d.linkType),
			linkType: d.linkType,
		})),
	}));

	return NextResponse.json({ blocks });
}

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = createBlockSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [block] = await db
		.insert(scheduleBlocks)
		.values({
			teacherId: data.user.id,
			title: result.data.title,
			color: result.data.color,
			startTime: result.data.startTime,
			endTime: result.data.endTime,
			dayOfWeek: result.data.dayOfWeek ?? null,
			specificDate: result.data.specificDate ?? null,
			sortOrder: result.data.sortOrder ?? 0,
		})
		.returning();

	return NextResponse.json({ block }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await db.delete(scheduleBlocks).where(eq(scheduleBlocks.teacherId, data.user.id));

	return NextResponse.json({ ok: true });
}
