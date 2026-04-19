export const dynamic = "force-dynamic";

import { and, between, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	cfuEntries,
	classes,
	ramBuckAccounts,
	ramBuckTransactions,
	rosterEntries,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const batchPostSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	standardCode: z.string().min(1).max(50),
	sessionId: z.string().uuid().optional(),
	entries: z
		.array(
			z.object({
				rosterId: z.string().uuid(),
				score: z.number().int().min(0).max(4),
				notes: z.string().max(200).default(""),
			}),
		)
		.min(1),
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
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const url = new URL(request.url);
	const date = url.searchParams.get("date");
	const from = url.searchParams.get("from");
	const to = url.searchParams.get("to");

	// Range mode: ?from=YYYY-MM-DD&to=YYYY-MM-DD — returns class average per day
	if (from && to) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
			return NextResponse.json({ error: "from/to must be YYYY-MM-DD" }, { status: 400 });
		}
		const rows = await db
			.select({ date: cfuEntries.date, score: cfuEntries.score })
			.from(cfuEntries)
			.where(and(eq(cfuEntries.classId, classId), between(cfuEntries.date, from, to)))
			.orderBy(cfuEntries.date);
		// Aggregate: average score per date (exclude absent=0 from average)
		const byDate: Record<string, { sum: number; count: number; dist: number[] }> = {};
		for (const r of rows) {
			if (!byDate[r.date]) byDate[r.date] = { sum: 0, count: 0, dist: [0, 0, 0, 0, 0] };
			byDate[r.date].dist[r.score] = (byDate[r.date].dist[r.score] ?? 0) + 1;
			if (r.score > 0) {
				byDate[r.date].sum += r.score;
				byDate[r.date].count += 1;
			}
		}
		const trend = Object.entries(byDate)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([d, { sum, count, dist }]) => ({
				date: d,
				average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
				count,
				dist,
			}));
		return NextResponse.json({ trend, from, to });
	}

	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return NextResponse.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
	}

	const entries = await db
		.select({
			id: cfuEntries.id,
			rosterId: cfuEntries.rosterId,
			standardCode: cfuEntries.standardCode,
			score: cfuEntries.score,
			notes: cfuEntries.notes,
			date: cfuEntries.date,
			createdAt: cfuEntries.createdAt,
			studentId: rosterEntries.studentId,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(cfuEntries)
		.innerJoin(rosterEntries, eq(cfuEntries.rosterId, rosterEntries.id))
		.where(and(eq(cfuEntries.classId, classId), eq(cfuEntries.date, date)));

	return NextResponse.json({ entries, date });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = batchPostSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { date, standardCode, sessionId, entries } = result.data;

	// Batch upsert CFU entries
	const values = entries.map((entry) => ({
		classId,
		rosterId: entry.rosterId,
		standardCode,
		score: entry.score,
		notes: entry.notes,
		date,
		sessionId: sessionId ?? null,
	}));

	const inserted = await db
		.insert(cfuEntries)
		.values(values)
		.onConflictDoUpdate({
			target: [cfuEntries.classId, cfuEntries.rosterId, cfuEntries.date, cfuEntries.standardCode],
			set: {
				score: cfuEntries.score,
				notes: cfuEntries.notes,
				sessionId: cfuEntries.sessionId,
			},
		})
		.returning();

	// Auto-award RAM bucks for score = 4 (Exceeding)
	const exceedingStudents = entries.filter((e) => e.score === 4);
	for (const student of exceedingStudents) {
		// Upsert account first (may not exist yet)
		const [account] = await db
			.insert(ramBuckAccounts)
			.values({ classId, rosterId: student.rosterId })
			.onConflictDoUpdate({
				target: [ramBuckAccounts.classId, ramBuckAccounts.rosterId],
				set: { updatedAt: new Date() },
			})
			.returning();

		if (account) {
			const AWARD_AMOUNT = 5;
			await db
				.update(ramBuckAccounts)
				.set({
					balance: account.balance + AWARD_AMOUNT,
					lifetimeEarned: account.lifetimeEarned + AWARD_AMOUNT,
					updatedAt: new Date(),
				})
				.where(
					and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, student.rosterId)),
				);

			await db.insert(ramBuckTransactions).values({
				classId,
				rosterId: student.rosterId,
				sessionId: sessionId ?? null,
				type: "academic-correct",
				amount: AWARD_AMOUNT,
				reason: `Exceeding score on ${standardCode} (${date})`,
			});
		}
	}

	return NextResponse.json({ entries: inserted, count: inserted.length });
}
