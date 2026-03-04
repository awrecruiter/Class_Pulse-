import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classSessions, comprehensionSignals } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: sessionId } = await params;

	// Verify teacher owns this session
	const [session] = await db
		.select({ teacherId: classSessions.teacherId, status: classSessions.status })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session || session.teacherId !== data.user.id) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			// Send initial data immediately
			await sendPulse(controller, encoder, sessionId);

			// Poll every 5 seconds
			const interval = setInterval(async () => {
				try {
					await sendPulse(controller, encoder, sessionId);
				} catch {
					clearInterval(interval);
					controller.close();
				}
			}, 5000);

			// Clean up when client disconnects
			request.signal.addEventListener("abort", () => {
				clearInterval(interval);
				controller.close();
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}

async function sendPulse(
	controller: ReadableStreamDefaultController,
	encoder: TextEncoder,
	sessionId: string,
) {
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

	const total = signals.length;
	const payload = { gotIt, almost, lost, stuckFor60s, total, ts: now };
	const data = `data: ${JSON.stringify(payload)}\n\n`;
	controller.enqueue(encoder.encode(data));
}
