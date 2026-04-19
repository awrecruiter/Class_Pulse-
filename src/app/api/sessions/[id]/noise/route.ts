export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { ambientAlerts, classSessions } from "@/lib/db/schema";
import { setNoiseLevel } from "@/lib/noise-store";
import { ambientScanLimiter } from "@/lib/rate-limit";

const HIGH_NOISE_THRESHOLD = 75;

const noiseSchema = z.object({
	level: z.number().int().min(0).max(100),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!ambientScanLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: sessionId } = await params;

	const [session] = await db
		.select({ teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));
	if (!session || session.teacherId !== data.user.id)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = noiseSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { level } = result.data;
	setNoiseLevel(sessionId, level);

	// Log alert only for high-noise events
	if (level >= HIGH_NOISE_THRESHOLD) {
		await db.insert(ambientAlerts).values({
			sessionId,
			alertType: "noise",
			severity: "high",
			details: `Noise level: ${level}`,
		});
	}

	return NextResponse.json({ ok: true, level });
}
