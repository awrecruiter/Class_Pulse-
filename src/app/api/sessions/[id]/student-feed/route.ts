import { and, desc, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import {
	classSessions,
	manipulativePushes,
	privilegePurchases,
	ramBuckAccounts,
	teacherSettings,
} from "@/lib/db/schema";
import { getNoiseLevel } from "@/lib/noise-store";
import type { StudentFeedNoiseEvent } from "@/types";

const SESSION_POLL_MS = 5000;

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

	// Verify session exists and is active
	const [session] = await db
		.select({
			id: classSessions.id,
			status: classSessions.status,
			teacherId: classSessions.teacherId,
			classId: classSessions.classId,
		})
		.from(classSessions)
		.where(eq(classSessions.id, sessionId));

	if (!session) {
		return new Response("Not found", { status: 404 });
	}

	const encoder = new TextEncoder();
	let lastPushId: string | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			let closed = false;
			// Declare before safeClose so it can reference them without TDZ errors
			let interval: ReturnType<typeof setInterval> | undefined;
			let storeInterval: ReturnType<typeof setInterval> | undefined;
			let purchaseInterval: ReturnType<typeof setInterval> | undefined;
			let noiseInterval: ReturnType<typeof setInterval> | undefined;

			function safeClose() {
				if (closed) return;
				closed = true;
				clearInterval(interval);
				clearInterval(storeInterval);
				clearInterval(purchaseInterval);
				clearInterval(noiseInterval);
				controller.close();
			}

			function sendSessionEnded() {
				if (closed) return;
				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ type: "session-ended" })}\n\n`),
					);
				} catch {
					// stream already closed
				}
				safeClose();
			}

			// If session was already ended before student connected, notify immediately
			if (session.status === "ended") {
				sendSessionEnded();
				return;
			}

			// Send initial state immediately
			await sendLatestPush(controller, encoder, sessionId, lastPushId, (id) => {
				lastPushId = id;
			});

			// Send initial store status
			let lastStoreOpen: boolean | null = null;
			try {
				const [settings] = await db
					.select({ storeIsOpen: teacherSettings.storeIsOpen })
					.from(teacherSettings)
					.where(eq(teacherSettings.userId, session.teacherId));
				const isOpen = settings?.storeIsOpen ?? false;
				lastStoreOpen = isOpen;
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: "store-status", isOpen })}\n\n`),
				);
			} catch {
				// non-fatal — student will get next poll
			}

			// Poll every 5 seconds for new pushes and session status
			interval = setInterval(async () => {
				try {
					// Check if teacher ended the session
					const [current] = await db
						.select({ status: classSessions.status })
						.from(classSessions)
						.where(eq(classSessions.id, sessionId));
					if (!current || current.status === "ended") {
						sendSessionEnded();
						return;
					}
					await sendLatestPush(controller, encoder, sessionId, lastPushId, (id) => {
						lastPushId = id;
					});
				} catch {
					safeClose();
				}
			}, SESSION_POLL_MS);

			storeInterval = setInterval(async () => {
				try {
					const [settings] = await db
						.select({ storeIsOpen: teacherSettings.storeIsOpen })
						.from(teacherSettings)
						.where(eq(teacherSettings.userId, session.teacherId));
					const isOpen = settings?.storeIsOpen ?? false;
					if (isOpen !== lastStoreOpen) {
						lastStoreOpen = isOpen;
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ type: "store-status", isOpen })}\n\n`),
						);
					}
				} catch {
					safeClose();
				}
			}, 3000);

			// Poll for purchase status changes (approved / rejected)
			const notifiedPurchaseIds = new Set<string>();
			const rosterId = payload.rosterId;
			purchaseInterval = setInterval(async () => {
				try {
					const processed = await db
						.select({
							id: privilegePurchases.id,
							itemId: privilegePurchases.itemId,
							status: privilegePurchases.status,
						})
						.from(privilegePurchases)
						.where(
							and(
								eq(privilegePurchases.classId, session.classId),
								eq(privilegePurchases.rosterId, rosterId),
								inArray(privilegePurchases.status, ["approved", "rejected"]),
							),
						);

					for (const purchase of processed) {
						if (notifiedPurchaseIds.has(purchase.id)) continue;
						notifiedPurchaseIds.add(purchase.id);

						let newBalance: number | undefined;
						if (purchase.status === "approved") {
							const [account] = await db
								.select({ balance: ramBuckAccounts.balance })
								.from(ramBuckAccounts)
								.where(
									and(
										eq(ramBuckAccounts.classId, session.classId),
										eq(ramBuckAccounts.rosterId, rosterId),
									),
								);
							newBalance = account?.balance;
						}

						if (!closed) {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({
										type: "purchase-update",
										purchaseId: purchase.id,
										itemId: purchase.itemId,
										status: purchase.status,
										newBalance,
									})}\n\n`,
								),
							);
						}
					}
				} catch {
					// non-fatal — student will see update next poll
				}
			}, 3000);

			// Forward teacher mic amplitude to student waveform every 200ms
			noiseInterval = setInterval(() => {
				if (closed) return;
				const noiseEvent: StudentFeedNoiseEvent = {
					type: "noise",
					level: getNoiseLevel(sessionId),
				};
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(noiseEvent)}\n\n`));
				} catch {
					safeClose();
				}
			}, 200);

			request.signal.addEventListener("abort", safeClose);
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
