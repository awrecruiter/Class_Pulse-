import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	classes,
	interventionFlags,
	parentContacts,
	parentMessages,
	parentReportTokens,
	rosterEntries,
} from "@/lib/db/schema";
import { sessionRateLimiter, smsRateLimiter } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";

const actionSchema = z.object({
	action: z.enum(["send", "dismiss"]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const body = await request.json();
	const parsed = actionSchema.safeParse(body);
	if (!parsed.success)
		return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

	// Verify teacher owns this flag's class
	const [flag] = await db
		.select({
			id: interventionFlags.id,
			classId: interventionFlags.classId,
			rosterId: interventionFlags.rosterId,
			tier: interventionFlags.tier,
			standardCode: interventionFlags.standardCode,
			sessionCount: interventionFlags.sessionCount,
			status: interventionFlags.status,
		})
		.from(interventionFlags)
		.where(eq(interventionFlags.id, id));

	if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const [cls] = await db
		.select({ teacherId: classes.teacherId, label: classes.label })
		.from(classes)
		.where(and(eq(classes.id, flag.classId), eq(classes.teacherId, data.user.id)));

	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	if (flag.status !== "draft")
		return NextResponse.json({ error: "Flag already processed" }, { status: 409 });

	if (parsed.data.action === "dismiss") {
		await db
			.update(interventionFlags)
			.set({ status: "dismissed" })
			.where(eq(interventionFlags.id, id));
		return NextResponse.json({ ok: true });
	}

	// action === "send"

	// Fetch roster entry (initials + studentId only — FERPA)
	const [roster] = await db
		.select({
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
			studentId: rosterEntries.studentId,
		})
		.from(rosterEntries)
		.where(eq(rosterEntries.id, flag.rosterId));

	if (!roster) return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });

	// Fetch parent contact
	const [contact] = await db
		.select({ phone: parentContacts.phone, parentName: parentContacts.parentName })
		.from(parentContacts)
		.where(
			and(
				eq(parentContacts.classId, flag.classId),
				eq(parentContacts.rosterId, flag.rosterId),
				eq(parentContacts.isActive, true),
			),
		);

	if (!contact) return NextResponse.json({ error: "No parent contact on file" }, { status: 422 });

	// Rate-limit per teacher IP + recipient phone to prevent burst-sending to many parents
	if (!smsRateLimiter.check(`${ip}:${contact.phone}`).success)
		return NextResponse.json({ error: "SMS rate limit" }, { status: 429 });

	// Generate report token
	const token = crypto.randomBytes(24).toString("hex");
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
	await db.insert(parentReportTokens).values({ token, flagId: id, expiresAt });

	// NEXT_PUBLIC_APP_URL → VERCEL_URL (auto-set by Vercel, hostname only) → fallback
	const baseUrl =
		process.env.NEXT_PUBLIC_APP_URL ??
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://classpulse.app");
	const reportUrl = `${baseUrl}/report/${token}`;

	const tierLabel = flag.tier === "tier3" ? "ongoing" : "repeated";
	const msg =
		`Hello${contact.parentName ? ` ${contact.parentName}` : ""}! Your student has shown ${tierLabel} difficulty with ${flag.standardCode} across ${flag.sessionCount} class sessions. ` +
		`Your teacher has prepared a brief support summary: ${reportUrl}`;

	// Send SMS
	const smsResult = await sendSms(contact.phone, msg);
	const smsStatus: "sent" | "failed" = smsResult.ok ? "sent" : "failed";
	const smsSid = smsResult.sid;

	await db.insert(parentMessages).values({
		classId: flag.classId,
		rosterId: flag.rosterId,
		phone: contact.phone,
		body: msg,
		triggeredBy: "academic-guidance",
		status: smsStatus,
		smsSid: smsSid ?? null,
	});

	await db
		.update(interventionFlags)
		.set({ status: "sent", sentAt: new Date() })
		.where(eq(interventionFlags.id, id));

	return NextResponse.json({ ok: true, reportUrl });
}
