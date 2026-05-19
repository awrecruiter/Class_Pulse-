export const dynamic = "force-dynamic";

import { and, eq, or } from "drizzle-orm";
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
	url: string;
};

/**
 * GET /api/resources/today?date=YYYY-MM-DD
 * Returns uploaded resource sections for the given date (defaults to today).
 * Every section includes its URL so the UI can show chips and voice commands
 * can open resources directly. Pacing rows are included with an empty
 * questions array (they have a URL but no Q&A data).
 */
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const searchParams = new URL(request.url).searchParams;
	const dateParam = searchParams.get("date");
	const date =
		dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
			? dateParam
			: new Date().toISOString().slice(0, 10);
	const classIdParam = searchParams.get("classId") ?? "";

	const rows = await db
		.select({
			resourceType: lessonResources.resourceType,
			resourceData: lessonResources.resourceData,
			url: lessonResources.url,
		})
		.from(lessonResources)
		.where(
			and(
				eq(lessonResources.teacherId, data.user.id),
				eq(lessonResources.importDate, date),
				or(eq(lessonResources.classId, ""), eq(lessonResources.classId, classIdParam)),
			),
		)
		.catch(() => []);

	const sections: TodayResourceSection[] = [];

	for (const row of rows) {
		const rt = row.resourceType as TodayResourceSection["resourceType"];
		if (!["bell-ringer", "cfu", "exit-ticket", "pacing"].includes(rt)) continue;

		// Pacing rows have no Q&A data — include them with an empty questions array
		// so the UI can show a chip and voice commands can open the URL.
		if (rt === "pacing") {
			sections.push({ resourceType: "pacing", questions: [], url: row.url });
			continue;
		}

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

		// Always push — even empty-question rows let the chip show as "uploaded"
		sections.push({ resourceType: rt, questions, url: row.url });
	}

	return NextResponse.json({ date, sections });
}
