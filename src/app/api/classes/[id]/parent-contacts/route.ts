import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, parentContacts, rosterEntries } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const PHONE_RE = /^\+1\d{10}$/;

function normalizeToE164(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	if (digits.length === 10) return `+1${digits}`;
	if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
	return raw;
}

const contactSchema = z.object({
	rosterId: z.string().uuid(),
	parentName: z.string().max(100).default(""),
	phone: z
		.string()
		.transform(normalizeToE164)
		.refine((v) => PHONE_RE.test(v), "Invalid US phone number — enter 10 digits"),
	notes: z.string().max(500).default(""),
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

	const contacts = await db
		.select({
			id: parentContacts.id,
			rosterId: parentContacts.rosterId,
			parentName: parentContacts.parentName,
			phone: parentContacts.phone,
			notes: parentContacts.notes,
			isActive: parentContacts.isActive,
			createdAt: parentContacts.createdAt,
			updatedAt: parentContacts.updatedAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(parentContacts)
		.innerJoin(rosterEntries, eq(parentContacts.rosterId, rosterEntries.id))
		.where(and(eq(parentContacts.classId, classId), eq(parentContacts.isActive, true)));

	return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = contactSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { rosterId, parentName, phone, notes } = result.data;

	const [contact] = await db
		.insert(parentContacts)
		.values({ classId, rosterId, parentName, phone, notes })
		.onConflictDoUpdate({
			target: [parentContacts.classId, parentContacts.rosterId],
			set: { parentName, phone, notes, isActive: true, updatedAt: new Date() },
		})
		.returning();

	return NextResponse.json({ contact });
}
