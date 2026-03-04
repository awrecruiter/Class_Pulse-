import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classSessions, manipulativePushes } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

// Matches CoachResponse["manipulative"] shape so teacher can push
// the exact spec the AI coach already generated, or a preset.
const specSchema = z.object({
	type: z.enum(["fraction-bar", "area-model", "number-line"]),
	caption: z.string(),
	// fraction-bar
	bars: z
		.array(
			z.object({
				parts: z.number().int().min(1).max(20),
				filled: z.number().int().min(0).max(20),
				label: z.string(),
			}),
		)
		.optional(),
	// area-model
	rows: z.number().int().min(1).max(12).optional(),
	cols: z.number().int().min(1).max(12).optional(),
	shadedRows: z.number().int().min(0).max(12).optional(),
	shadedCols: z.number().int().min(0).max(12).optional(),
	// number-line
	min: z.number().optional(),
	max: z.number().optional(),
	markers: z.array(z.object({ value: z.number(), label: z.string() })).optional(),
	highlightIndex: z.number().int().optional(),
});

const bodySchema = z.object({
	spec: specSchema,
	triggeredBy: z.enum(["teacher", "auto"]).default("teacher"),
	standardCode: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: sessionId } = await params;

	const [session] = await db
		.select({ teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session || session.teacherId !== data.user.id) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const body = await request.json();
	const result = bodySchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: "Invalid spec" }, { status: 400 });
	}

	const { spec, triggeredBy, standardCode } = result.data;

	const [push] = await db
		.insert(manipulativePushes)
		.values({
			sessionId,
			triggeredBy,
			spec: JSON.stringify(spec),
			standardCode: standardCode ?? null,
		})
		.returning({ id: manipulativePushes.id, pushedAt: manipulativePushes.pushedAt });

	return NextResponse.json({ ok: true, pushId: push.id });
}
