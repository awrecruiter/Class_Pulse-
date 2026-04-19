import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classSessions, comprehensionSignals } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { data } = await auth.getSession();
	if (!data?.user) return new Response("Unauthorized", { status: 401 });

	const { id: sessionId } = await params;

	const [session] = await db
		.select({ teacherId: classSessions.teacherId })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session || session.teacherId !== data.user.id)
		return new Response("Not found", { status: 404 });

	const encoder = new TextEncoder();
	let lastPayload = "";

	const stream = new ReadableStream({
		async start(controller) {
			async function send() {
				const rows = await db
					.select({
						rosterId: comprehensionSignals.rosterId,
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

				for (const row of rows) {
					if (row.signal === "got-it") gotIt++;
					else if (row.signal === "almost") almost++;
					else if (row.signal === "lost") {
						lost++;
						if (row.lostSince && now - row.lostSince.getTime() >= 60_000) stuckFor60s++;
					}
				}

				const payload = JSON.stringify({
					gotIt,
					almost,
					lost,
					stuckFor60s,
					total: rows.length,
					signals: rows.map((r) => ({ rosterId: r.rosterId, signal: r.signal })),
				});

				if (payload !== lastPayload) {
					lastPayload = payload;
					controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
				}
			}

			await send();

			const interval = setInterval(async () => {
				try {
					await send();
				} catch {
					clearInterval(interval);
					controller.close();
				}
			}, 2000);

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
