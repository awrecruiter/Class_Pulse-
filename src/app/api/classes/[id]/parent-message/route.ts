import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, parentContacts, parentMessages } from "@/lib/db/schema";
import { sessionRateLimiter, smsRateLimiter } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";

const messageSchema = z.object({
	rosterId: z.string().uuid(),
	body: z.string().min(1).max(1600),
	triggeredBy: z.enum(["incident", "broadcast", "academic-guidance", "manual"]),
	incidentId: z.string().uuid().optional(),
});

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const rosterId = request.nextUrl.searchParams.get("rosterId");
	if (!rosterId) return NextResponse.json({ error: "rosterId required" }, { status: 400 });

	const messages = await db
		.select()
		.from(parentMessages)
		.where(and(eq(parentMessages.classId, classId), eq(parentMessages.rosterId, rosterId)))
		.orderBy(desc(parentMessages.sentAt))
		.limit(50);

	return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	if (!smsRateLimiter.check(ip).success)
		return NextResponse.json({ error: "SMS rate limit exceeded" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = messageSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { rosterId, body: messageBody, triggeredBy, incidentId } = result.data;

	// Look up active parent contact
	const [contact] = await db
		.select({ phone: parentContacts.phone })
		.from(parentContacts)
		.where(
			and(
				eq(parentContacts.classId, classId),
				eq(parentContacts.rosterId, rosterId),
				eq(parentContacts.isActive, true),
			),
		);

	if (!contact) return NextResponse.json({ error: "No parent contact on file" }, { status: 404 });

	const smsResult = await sendSms(contact.phone, messageBody);

	if (!smsResult.ok) {
		console.error("[parent-message] SMS send failed:", smsResult.error, "for classId:", classId);
	}

	await db.insert(parentMessages).values({
		classId,
		rosterId,
		incidentId: incidentId ?? null,
		phone: contact.phone,
		body: messageBody,
		triggeredBy,
		status: smsResult.ok ? "sent" : "failed",
		smsSid: smsResult.sid ?? null,
	});

	return NextResponse.json({ ok: true, smsSent: smsResult.ok, smsNote: smsResult.error ?? null });
}
