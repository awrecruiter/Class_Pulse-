import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classSessions, comprehensionSignals } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

	const signals = await db
		.select({
			signal: comprehensionSignals.signal,
			lostSince: comprehensionSignals.lostSince,
		})
		.from(comprehensionSignals)
		.where(eq(comprehensionSignals.sessionId, sessionId));

	const now = Date.now();
	let gotIt = 0;
	let almost = 0;
	let lost = 0;
	let stuckFor60s = 0;

	for (const row of signals) {
		if (row.signal === "got-it") gotIt++;
		else if (row.signal === "almost") almost++;
		else if (row.signal === "lost") {
			lost++;
			if (row.lostSince && now - row.lostSince.getTime() >= 60_000) {
				stuckFor60s++;
			}
		}
	}

	return NextResponse.json({ gotIt, almost, lost, stuckFor60s, total: signals.length, ts: now });
}
