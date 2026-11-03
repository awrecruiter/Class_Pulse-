import { and, asc, eq, gt, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { openToken, readReservations } from "@/lib/calendly/client";
import { db } from "@/lib/db";
import {
	calendlyConnections,
	classes,
	orientations,
	reservations,
	rosterEntries,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

const fields = z.object({
	learnerName: z.string().trim().min(1).max(100),
	subject: z.string().trim().min(1).max(100),
	topic: z.string().trim().min(1).max(200),
});
export async function GET() {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!sessionRateLimiter.check(`reservations:${data.user.id}`).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const manual = await db
		.select()
		.from(reservations)
		.where(
			and(
				eq(reservations.teacherId, data.user.id),
				or(eq(reservations.source, "calendly"), gt(reservations.endsAt, new Date())),
			),
		)
		.orderBy(asc(reservations.startsAt));
	const [connection] = await db
		.select()
		.from(calendlyConnections)
		.where(eq(calendlyConnections.userId, data.user.id));
	let external: Awaited<ReturnType<typeof readReservations>> = { reservations: [], limited: false };
	let error: string | undefined;
	if (connection) {
		try {
			external = await readReservations(openToken(connection.tokenEncrypted), connection.userUri);
		} catch {
			error = "Calendly could not refresh. Retry to see current reservations.";
		}
	}
	const learners = connection
		? await db
				.select({
					spaceId: classes.id,
					mode: classes.workspaceMode,
					email: orientations.parentEmail,
					name: rosterEntries.firstName,
					initial: rosterEntries.lastInitial,
					subject: classes.subject,
					topic: orientations.learningContent,
				})
				.from(orientations)
				.innerJoin(classes, eq(classes.id, orientations.classId))
				.innerJoin(rosterEntries, eq(rosterEntries.id, orientations.rosterId))
				.where(and(eq(classes.teacherId, data.user.id), eq(rosterEntries.isActive, true)))
		: [];
	const linkedSpaces = manual.some((row) => row.classId)
		? await db
				.select({ id: classes.id, mode: classes.workspaceMode })
				.from(classes)
				.where(eq(classes.teacherId, data.user.id))
		: [];
	const upcoming = [
		...manual
			.filter((row) => row.source !== "calendly")
			.map((row) => {
				const space = linkedSpaces.find((space) => space.id === row.classId);
				return {
					...row,
					learningSpaceUrl: space
						? `${space.mode === "classroom" ? "/classes" : "/tutoring"}/${space.id}`
						: undefined,
				};
			}),
		...external.reservations.map(({ inviteeEmail, ...row }) => {
			const saved = manual.find((item) => item.sourceUri === row.sourceUri);
			const matches = learners.filter((learner) => learner.email.toLowerCase() === inviteeEmail);
			const learner = matches.length === 1 ? matches[0] : undefined;
			return {
				...row,
				id: row.sourceUri,
				source: "calendly",
				learningSpaceUrl: learner
					? `${learner.mode === "classroom" ? "/classes" : "/tutoring"}/${learner.spaceId}`
					: undefined,
				learnerName:
					saved?.learnerName ||
					(learner?.name ? `${learner.name} ${learner.initial}.` : row.learnerName),
				subject: saved?.subject || learner?.subject || row.subject,
				topic: saved?.topic || learner?.topic || row.topic,
			};
		}),
	];
	upcoming.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
	return NextResponse.json(
		{ reservations: upcoming, connected: !!connection, limited: external.limited, error },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
export async function POST(request: NextRequest) {
	if (!sessionRateLimiter.check(request.headers.get("x-forwarded-for") ?? "anonymous").success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!sessionRateLimiter.check(`reservations:${data.user.id}`).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const result = fields
		.extend({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() })
		.refine((row) => new Date(row.endsAt) > new Date(row.startsAt), {
			message: "End time must be after start time.",
		})
		.safeParse(await request.json().catch(() => null));
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	await db.insert(reservations).values({
		teacherId: data.user.id,
		...result.data,
		startsAt: new Date(result.data.startsAt),
		endsAt: new Date(result.data.endsAt),
	});
	return NextResponse.json({ ok: true }, { status: 201 });
}
export async function PATCH(request: NextRequest) {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!sessionRateLimiter.check(`reservations:${data.user.id}`).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const result = fields
		.extend({
			sourceUri: z
				.string()
				.regex(
					/^https:\/\/api\.calendly\.com\/scheduled_events\/[A-Za-z0-9-]+\/invitees\/[A-Za-z0-9-]+$/,
				),
			startsAt: z.iso.datetime(),
			endsAt: z.iso.datetime(),
		})
		.safeParse(await request.json().catch(() => null));
	if (!result.success)
		return NextResponse.json({ error: "Check the reservation details." }, { status: 400 });
	const values = {
		...result.data,
		teacherId: data.user.id,
		source: "calendly",
		startsAt: new Date(result.data.startsAt),
		endsAt: new Date(result.data.endsAt),
	};
	await db
		.insert(reservations)
		.values(values)
		.onConflictDoUpdate({
			target: [reservations.teacherId, reservations.sourceUri],
			set: { learnerName: values.learnerName, subject: values.subject, topic: values.topic },
		});
	return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!sessionRateLimiter.check(`reservations:${data.user.id}`).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	const result = z.object({ id: z.uuid() }).safeParse(await request.json().catch(() => null));
	if (!result.success) return NextResponse.json({ error: "Invalid reservation" }, { status: 400 });
	await db
		.delete(reservations)
		.where(and(eq(reservations.id, result.data.id), eq(reservations.teacherId, data.user.id)));
	return NextResponse.json({ ok: true });
}
