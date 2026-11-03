import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	interventionFlags,
	orientations,
	parentContacts,
	parentReportTokens,
} from "@/lib/db/schema";
import { ownsOrientationClass } from "@/lib/orientation/server";
import { orientationProgressSchema } from "@/lib/orientation/validation";
import { sessionRateLimiter } from "@/lib/rate-limit";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; inviteId: string }> },
) {
	if (!sessionRateLimiter.check(request.headers.get("x-forwarded-for") ?? "anonymous").success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { id, inviteId } = await params;
	if (
		!z.uuid().safeParse(id).success ||
		!z.uuid().safeParse(inviteId).success ||
		!(await ownsOrientationClass(id, data.user.id))
	)
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	const body = await request.json().catch(() => null);
	if (body?.action === "confirm-parent") {
		const parsed = z.object({ phone: z.string().regex(/^\+1\d{10}$/) }).safeParse(body);
		if (!parsed.success)
			return NextResponse.json({ error: "Confirm the current parent number." }, { status: 400 });
		const confirmed = await db.transaction(async (tx) => {
			const [invite] = await tx
				.select()
				.from(orientations)
				.where(and(eq(orientations.id, inviteId), eq(orientations.classId, id)));
			if (!invite?.rosterId) return false;
			const [contact] = await tx
				.select()
				.from(parentContacts)
				.where(
					and(
						eq(parentContacts.classId, id),
						eq(parentContacts.rosterId, invite.rosterId),
						eq(parentContacts.isActive, true),
					),
				)
				.for("update");
			if (!contact || contact.phone !== parsed.data.phone) return false;
			// Previously issued links must not become usable for a newly confirmed destination.
			const flags = tx
				.select({ id: interventionFlags.id })
				.from(interventionFlags)
				.where(
					and(eq(interventionFlags.classId, id), eq(interventionFlags.rosterId, invite.rosterId)),
				);
			await tx.delete(parentReportTokens).where(inArray(parentReportTokens.flagId, flags));
			await tx
				.update(parentContacts)
				.set({
					confirmedPhone: contact.phone,
					phoneConfirmedAt: new Date(),
					phoneConfirmedBy: data.user.id,
				})
				.where(eq(parentContacts.id, contact.id));
			return true;
		});
		return NextResponse.json(
			confirmed
				? { ok: true }
				: { error: "Parent number changed or contact unavailable. Refresh before confirming." },
			{ status: confirmed ? 200 : 409 },
		);
	}
	const result = orientationProgressSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	const { reviewed, ...fields } = result.data;
	const [updated] = await db
		.update(orientations)
		.set({ ...fields, reviewedAt: reviewed ? new Date() : null })
		.where(and(eq(orientations.id, inviteId), eq(orientations.classId, id)))
		.returning({ id: orientations.id });
	if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({ ok: true });
}
