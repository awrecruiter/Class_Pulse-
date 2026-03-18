import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scheduleBlocks } from "@/lib/db/schema";
import { remindersRateLimiter } from "@/lib/rate-limit";

const reminderSchema = z.object({
	text: z.string().min(1).max(300),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = remindersRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = reminderSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [block] = await db
		.insert(scheduleBlocks)
		.values({
			teacherId: data.user.id,
			title: result.data.text,
			color: "yellow",
			blockType: "reminder",
			startTime: "00:00",
			endTime: "00:01",
			dayOfWeek: null,
			specificDate: result.data.date,
			sortOrder: 0,
		})
		.returning();

	return NextResponse.json({ block }, { status: 201 });
}
