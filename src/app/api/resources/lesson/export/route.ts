export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { lessonResources } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

/** GET /api/resources/lesson/export — download all teacher resource overrides as CSV */
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await db
		.select()
		.from(lessonResources)
		.where(eq(lessonResources.teacherId, data.user.id))
		.orderBy(
			lessonResources.topicNumber,
			lessonResources.lessonNumber,
			lessonResources.resourceType,
		);

	const lines = [
		"topicNumber,lessonNumber,resourceType,label,url,sortOrder",
		...rows
			.filter((r) => !r.isHidden)
			.map((r) =>
				[
					r.topicNumber,
					r.lessonNumber,
					r.resourceType,
					csvEscape(r.label),
					csvEscape(r.url),
					r.sortOrder,
				].join(","),
			),
	];

	return new NextResponse(lines.join("\r\n"), {
		headers: {
			"Content-Type": "text/csv",
			"Content-Disposition": `attachment; filename="lesson-resources-${new Date().toISOString().slice(0, 10)}.csv"`,
		},
	});
}

function csvEscape(value: string): string {
	if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}
