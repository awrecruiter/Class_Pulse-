import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { orientations, parentContacts, rosterEntries } from "@/lib/db/schema";
import { ownsOrientationClass } from "@/lib/orientation/server";
import { orientationSetupSchema } from "@/lib/orientation/validation";
import { sessionRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function authorize(request: NextRequest, context: Context) {
	if (!sessionRateLimiter.check(request.headers.get("x-forwarded-for") ?? "anonymous").success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { id } = await context.params;
	if (!z.uuid().safeParse(id).success || !(await ownsOrientationClass(id, data.user.id)))
		return NextResponse.json({ error: "Class not found" }, { status: 404 });
	return id;
}

export async function GET(request: NextRequest, context: Context) {
	const result = await authorize(request, context);
	if (result instanceof NextResponse) return result;
	const rows = await db
		.select({
			invite: orientations,
			studentName: rosterEntries.firstName,
			parentPhone: parentContacts.phone,
			confirmedPhone: parentContacts.confirmedPhone,
			phoneConfirmedAt: parentContacts.phoneConfirmedAt,
		})
		.from(orientations)
		.leftJoin(rosterEntries, eq(rosterEntries.id, orientations.rosterId))
		.leftJoin(parentContacts, eq(parentContacts.rosterId, orientations.rosterId))
		.where(eq(orientations.classId, result))
		.orderBy(desc(orientations.createdAt));
	return NextResponse.json(
		{ orientations: rows.map(({ invite, ...contact }) => ({ ...invite, ...contact })) },
		{ headers: { "Cache-Control": "no-store" } },
	);
}

export async function POST(request: NextRequest, context: Context) {
	const classId = await authorize(request, context);
	if (classId instanceof NextResponse) return classId;
	const result = orientationSetupSchema.safeParse(await request.json().catch(() => null));
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	const [invite] = await db
		.insert(orientations)
		.values({
			classId,
			...result.data,
			token: randomBytes(24).toString("hex"),
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		})
		.returning();
	return NextResponse.json(
		{ orientation: invite },
		{ status: 201, headers: { "Cache-Control": "no-store" } },
	);
}
