export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { lessonResources } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export type TodayQuestion = {
	standardCode: string;
	problem: string;
	answer: string;
	timeMinutes?: number;
	deliverAtMinute?: number;
	isExitTicket?: boolean;
};

export type TodayResourceSection = {
	resourceType: "bell-ringer" | "cfu" | "exit-ticket" | "pacing";
	questions: TodayQuestion[];
};

/**
 * GET /api/resources/today?date=YYYY-MM-DD
 * Returns uploaded question sets for the given date (defaults to today).
 */
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const dateParam = new URL(request.url).searchParams.get("date");
	const date =
		dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
			? dateParam
			: new Date().toISOString().slice(0, 10);

	const rows = await db
		.select({
			resourceType: lessonResources.resourceType,
			resourceData: lessonResources.resourceData,
		})
		.from(lessonResources)
		.where(and(eq(lessonResources.teacherId, data.user.id), eq(lessonResources.importDate, date)));

	const sections: TodayResourceSection[] = [];

	for (const row of rows) {
		const rt = row.resourceType as TodayResourceSection["resourceType"];
		if (!["bell-ringer", "cfu", "exit-ticket", "pacing"].includes(rt)) continue;
		if (rt === "pacing") continue; // pacing rows are schedule data, not questions

		const rawData = row.resourceData as { rows?: unknown[] } | null;
		const rawRows = rawData?.rows ?? [];

		const questions: TodayQuestion[] = [];
		for (const r of rawRows) {
			const item = r as Record<string, unknown>;
			if (typeof item.problem !== "string" || typeof item.answer !== "string") continue;
			const q: TodayQuestion = {
				standardCode: (item.standard_code as string | undefined) ?? "",
				problem: item.problem,
				answer: item.answer,
			};
			if (typeof item.time_minutes === "number") q.timeMinutes = item.time_minutes;
			if (typeof item.deliver_at_minute === "number") q.deliverAtMinute = item.deliver_at_minute;
			q.isExitTicket = typeof item.is_exit_ticket === "boolean" ? item.is_exit_ticket : false;
			questions.push(q);
		}

		if (questions.length > 0) {
			sections.push({ resourceType: rt, questions });
		}
	}

	return NextResponse.json({ date, sections });
}
