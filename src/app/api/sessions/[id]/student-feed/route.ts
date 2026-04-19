import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classSessions, manipulativePushes } from "@/lib/db/schema";
import { getNoiseLevel } from "@/lib/noise-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	// Student auth via signed cookie
	const token = request.cookies.get(STUDENT_COOKIE)?.value;
	if (!token) {
		return new Response("Unauthorized", { status: 401 });
	}

	const payload = verifyStudentToken(token);
	if (!payload) {
		return new Response("Invalid session", { status: 401 });
	}

	const { id: sessionId } = await params;
	if (payload.sessionId !== sessionId) {
		return new Response("Session mismatch", { status: 403 });
	}

	// Verify session exists
	const [session] = await db
		.select({ id: classSessions.id })
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session) {
		return new Response("Not found", { status: 404 });
	}

	const encoder = new TextEncoder();
	let lastPushId: string | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			// Send initial state immediately
			await sendLatestPush(controller, encoder, sessionId, lastPushId, (id) => {
				lastPushId = id;
			});

			// Poll every 5 seconds for new pushes
			const interval = setInterval(async () => {
				try {
					await sendLatestPush(controller, encoder, sessionId, lastPushId, (id) => {
						lastPushId = id;
					});
				} catch {
					clearInterval(interval);
					controller.close();
				}
			}, 5000);

			let lastNoiseLevel = -1;
			const noiseInterval = setInterval(() => {
				try {
					const level = getNoiseLevel(sessionId);
					if (Math.abs(level - lastNoiseLevel) >= 3) {
						lastNoiseLevel = level;
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ type: "noise", level })}\n\n`),
						);
					}
				} catch {
					clearInterval(noiseInterval);
					controller.close();
				}
			}, 300);

			request.signal.addEventListener("abort", () => {
				clearInterval(interval);
				clearInterval(noiseInterval);
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

async function sendLatestPush(
	controller: ReadableStreamDefaultController,
	encoder: TextEncoder,
	sessionId: string,
	lastPushId: string | null,
	setLastPushId: (id: string) => void,
) {
	const [latest] = await db
		.select({
			id: manipulativePushes.id,
			spec: manipulativePushes.spec,
			pushedAt: manipulativePushes.pushedAt,
			standardCode: manipulativePushes.standardCode,
		})
		.from(manipulativePushes)
		.where(eq(manipulativePushes.sessionId, sessionId))
		.orderBy(desc(manipulativePushes.pushedAt))
		.limit(1);

	// Only send if there's a new push the student hasn't received yet
	if (latest && latest.id !== lastPushId) {
		setLastPushId(latest.id);
		const payload = {
			pushId: latest.id,
			spec: JSON.parse(latest.spec),
			pushedAt: latest.pushedAt,
			standardCode: latest.standardCode ?? null,
		};
		controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
	}
}
