export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

import { workspaceModeSchema } from "@/lib/workspace-mode";

const createClassSchema = z.object({
	workspaceMode: workspaceModeSchema.default("classroom"),
	label: z.string().min(1).max(100),
	periodTime: z.string().max(20).default(""),
	gradeLevel: z.string().trim().max(10).default(""),
	subject: z.string().max(50).default("Math"),
});

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const mode = workspaceModeSchema.safeParse(
		request.nextUrl.searchParams.get("mode") ?? "classroom",
	);
	if (!mode.success) return NextResponse.json({ error: "Invalid workspace mode" }, { status: 400 });
	const rows = await db
		.select()
		.from(classes)
		.where(and(eq(classes.teacherId, data.user.id), eq(classes.workspaceMode, mode.data)));

	// Attach roster counts
	const withCounts = await Promise.all(
		rows.map(async (cls) => {
			const roster = await db
				.select({ id: rosterEntries.id })
				.from(rosterEntries)
				.where(eq(rosterEntries.classId, cls.id));
			return { ...cls, studentCount: roster.length };
		}),
	);

	return NextResponse.json({ classes: withCounts });
}

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}
	const result = createClassSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const [created] = await db
		.insert(classes)
		.values({
			teacherId: data.user.id,
			workspaceMode: result.data.workspaceMode,
			label: result.data.label,
			periodTime: result.data.periodTime,
			gradeLevel: result.data.gradeLevel,
			subject: result.data.subject,
		})
		.returning();

	return NextResponse.json({ class: created }, { status: 201 });
}
