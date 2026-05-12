export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, interventionFlags, parentReportTokens, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

// Generic standard code used for on-demand "share report" tokens
// (not tied to a detected pattern — teacher-initiated)
const ON_DEMAND_STANDARD = "MA.5.NSO.1.1";

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
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const { rosterId, classId } = body as { rosterId?: string; classId?: string };
	if (!rosterId || typeof rosterId !== "string") {
		return NextResponse.json({ error: "rosterId is required" }, { status: 400 });
	}
	if (!classId || typeof classId !== "string") {
		return NextResponse.json({ error: "classId is required" }, { status: 400 });
	}

	// Verify that this class belongs to the authenticated teacher
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

	// Verify the roster entry belongs to this class
	const [roster] = await db
		.select({ id: rosterEntries.id })
		.from(rosterEntries)
		.where(and(eq(rosterEntries.id, rosterId), eq(rosterEntries.classId, classId)));
	if (!roster) return NextResponse.json({ error: "Student not found" }, { status: 404 });

	// Check for an existing non-expired token for this roster+class via a linked flag
	// We look for a valid token that has a flag pointing to this rosterId in this classId
	const now = new Date();
	const existingTokens = await db
		.select({
			token: parentReportTokens.token,
			expiresAt: parentReportTokens.expiresAt,
		})
		.from(parentReportTokens)
		.innerJoin(interventionFlags, eq(parentReportTokens.flagId, interventionFlags.id))
		.where(
			and(
				eq(interventionFlags.rosterId, rosterId),
				eq(interventionFlags.classId, classId),
				gt(parentReportTokens.expiresAt, now),
			),
		)
		.limit(1);

	if (existingTokens.length > 0) {
		const existingToken = existingTokens[0].token;
		const origin = request.headers.get("origin") ?? "";
		const baseUrl = origin || (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
		const url = `${baseUrl}/report/${existingToken}`;
		return NextResponse.json({ url });
	}

	// Find or create an intervention flag for this student
	// Use "sent" status so it won't collide with the unique index on (rosterId, standardCode, "draft")
	let flagId: string;

	const [existingFlag] = await db
		.select({ id: interventionFlags.id })
		.from(interventionFlags)
		.where(
			and(
				eq(interventionFlags.rosterId, rosterId),
				eq(interventionFlags.classId, classId),
				eq(interventionFlags.standardCode, ON_DEMAND_STANDARD),
				eq(interventionFlags.status, "sent"),
			),
		)
		.limit(1);

	if (existingFlag) {
		flagId = existingFlag.id;
	} else {
		const [newFlag] = await db
			.insert(interventionFlags)
			.values({
				classId,
				rosterId,
				tier: "watch",
				standardCode: ON_DEMAND_STANDARD,
				sessionCount: 1,
				detectedAt: now,
				status: "sent",
				sentAt: now,
			})
			.returning({ id: interventionFlags.id });
		flagId = newFlag.id;
	}

	// Generate token
	const token = crypto.randomBytes(24).toString("hex");
	const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

	await db.insert(parentReportTokens).values({
		token,
		flagId,
		expiresAt,
	});

	const origin = request.headers.get("origin") ?? "";
	const baseUrl = origin || (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
	const url = `${baseUrl}/report/${token}`;

	return NextResponse.json({ url });
}
