import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import {
	calendlyFailureMessage,
	calendlyGet,
	calendlyUserSchema,
	sealToken,
} from "@/lib/calendly/client";
import { db } from "@/lib/db";
import { calendlyConnections } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";
export async function GET() {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const [connection] = await db
		.select({ accountName: calendlyConnections.accountName })
		.from(calendlyConnections)
		.where(eq(calendlyConnections.userId, data.user.id));
	return NextResponse.json(
		{ connected: !!connection, accountName: connection?.accountName },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
export async function PUT(request: NextRequest) {
	if (!sessionRateLimiter.check(request.headers.get("x-forwarded-for") ?? "anonymous").success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const result = z
		.object({ token: z.string().trim().min(20).max(4000) })
		.safeParse(await request.json().catch(() => null));
	if (!result.success)
		return NextResponse.json({ error: "Enter a Calendly personal access token." }, { status: 400 });
	try {
		const user = calendlyUserSchema.parse(
			await calendlyGet(result.data.token, "/users/me"),
		).resource;
		// A token that can read the profile may still be unable to read bookings.
		// Verify event/invitee scope before replacing a previously saved credential.
		const query = new URLSearchParams({
			user: user.uri,
			status: "active",
			count: "1",
			min_start_time: new Date().toISOString(),
		});
		await calendlyGet(result.data.token, `/scheduled_events?${query}`);
		const fields = {
			tokenEncrypted: sealToken(result.data.token),
			userUri: user.uri,
			accountName: user.name,
		};
		await db
			.insert(calendlyConnections)
			.values({ userId: data.user.id, ...fields })
			.onConflictDoUpdate({ target: calendlyConnections.userId, set: fields });
		return NextResponse.json({ connected: true, accountName: user.name });
	} catch (cause) {
		return NextResponse.json(
			{
				error: calendlyFailureMessage(
					cause,
					"Could not connect Calendly. Check the token and its users:read and scheduled_events:read permissions.",
				),
			},
			{ status: 422 },
		);
	}
}
export async function DELETE() {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	await db.delete(calendlyConnections).where(eq(calendlyConnections.userId, data.user.id));
	return NextResponse.json({ ok: true });
}
