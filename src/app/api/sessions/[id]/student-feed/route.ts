import { and, desc, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import {
	classSessions,
	manipulativePushes,
	ramBuckAccounts,
	ramBuckTransactions,
} from "@/lib/db/schema";

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
	let lastRamTxId: string | null = null;
	const { rosterId } = payload;

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
					clearInterval(ramIntervalId);
					controller.close();
				}
			}, 5000);

			// Poll every 3 seconds for RAM awards
			const ramIntervalId = setInterval(async () => {
				try {
					await sendLatestRamAward(controller, encoder, rosterId, sessionId, lastRamTxId, (id) => {
						lastRamTxId = id;
					});
				} catch {
					// Non-critical — ignore
				}
			}, 3000);

			request.signal.addEventListener("abort", () => {
				clearInterval(interval);
				clearInterval(ramIntervalId);
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
		controller.enqueue(encoder.encode(`event: push\ndata: ${JSON.stringify(payload)}\n\n`));
	}
}

async function sendLatestRamAward(
	controller: ReadableStreamDefaultController,
	encoder: TextEncoder,
	rosterId: string,
	sessionId: string,
	lastRamTxId: string | null,
	setLastRamTxId: (id: string) => void,
) {
	const [latest] = await db
		.select({
			id: ramBuckTransactions.id,
			amount: ramBuckTransactions.amount,
			reason: ramBuckTransactions.reason,
		})
		.from(ramBuckTransactions)
		.where(
			and(
				eq(ramBuckTransactions.rosterId, rosterId),
				eq(ramBuckTransactions.sessionId, sessionId),
				gt(ramBuckTransactions.amount, 0),
			),
		)
		.orderBy(desc(ramBuckTransactions.createdAt))
		.limit(1);

	if (latest && latest.id !== lastRamTxId) {
		setLastRamTxId(latest.id);

		// Look up current balance
		const [account] = await db
			.select({ balance: ramBuckAccounts.balance })
			.from(ramBuckAccounts)
			.where(eq(ramBuckAccounts.rosterId, rosterId));

		const newBalance = account?.balance ?? 0;
		controller.enqueue(
			encoder.encode(
				`event: ram_award\ndata: ${JSON.stringify({ amount: latest.amount, newBalance, reason: latest.reason })}\n\n`,
			),
		);
	}
}
