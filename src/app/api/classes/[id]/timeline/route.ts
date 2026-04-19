export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	behaviorIncidents,
	cfuEntries,
	classes,
	drawingAnalyses,
	masteryRecords,
	ramBuckTransactions,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return !!cls;
}

export type TimelineEvent = {
	id: string;
	type: "behavior" | "ram-buck" | "mastery" | "cfu" | "drawing";
	title: string;
	detail: string;
	date: string; // ISO
	severity?: "positive" | "neutral" | "negative";
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const owns = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const { searchParams } = new URL(request.url);
	const rosterId = searchParams.get("rosterId");

	const rosterResult = z.string().uuid().safeParse(rosterId);
	if (!rosterResult.success)
		return NextResponse.json({ error: "rosterId required" }, { status: 400 });

	const rid = rosterResult.data;

	const [incidents, transactions, mastery, cfus, drawings] = await Promise.all([
		db
			.select()
			.from(behaviorIncidents)
			.where(and(eq(behaviorIncidents.classId, classId), eq(behaviorIncidents.rosterId, rid)))
			.orderBy(desc(behaviorIncidents.createdAt)),
		db
			.select()
			.from(ramBuckTransactions)
			.where(and(eq(ramBuckTransactions.classId, classId), eq(ramBuckTransactions.rosterId, rid)))
			.orderBy(desc(ramBuckTransactions.createdAt)),
		db
			.select()
			.from(masteryRecords)
			.where(eq(masteryRecords.rosterId, rid))
			.orderBy(desc(masteryRecords.updatedAt)),
		db
			.select()
			.from(cfuEntries)
			.where(and(eq(cfuEntries.classId, classId), eq(cfuEntries.rosterId, rid)))
			.orderBy(desc(cfuEntries.createdAt)),
		db
			.select()
			.from(drawingAnalyses)
			.where(eq(drawingAnalyses.rosterId, rid))
			.orderBy(desc(drawingAnalyses.createdAt)),
	]);

	const events: TimelineEvent[] = [
		...incidents.map((i) => ({
			id: i.id,
			type: "behavior" as const,
			title: `Step ${i.step}: ${i.label}`,
			detail: i.notes || `−${i.ramBuckDeduction} RAM Bucks`,
			date: i.createdAt.toISOString(),
			severity: "negative" as const,
		})),
		...transactions.map((t) => ({
			id: t.id,
			type: "ram-buck" as const,
			title: t.amount > 0 ? `+${t.amount} RAM Bucks` : `${t.amount} RAM Bucks`,
			detail: t.reason,
			date: t.createdAt.toISOString(),
			severity: (t.amount > 0 ? "positive" : "negative") as "positive" | "negative",
		})),
		...mastery
			.filter((m) => m.status === "mastered")
			.map((m) => ({
				id: m.id,
				type: "mastery" as const,
				title: `Mastered ${m.standardCode}`,
				detail: `${m.consecutiveCorrect} consecutive correct`,
				date: (m.achievedAt ?? m.updatedAt).toISOString(),
				severity: "positive" as const,
			})),
		...cfus.map((c) => ({
			id: c.id,
			type: "cfu" as const,
			title: `CFU: ${c.standardCode}`,
			detail: `Score ${c.score}/4 — ${c.date}`,
			date: c.createdAt.toISOString(),
			severity: (c.score >= 3 ? "positive" : c.score >= 2 ? "neutral" : "negative") as
				| "positive"
				| "neutral"
				| "negative",
		})),
		...drawings.map((d) => ({
			id: d.id,
			type: "drawing" as const,
			title: `Drawing: ${d.analysisType}`,
			detail: d.studentFeedback,
			date: d.createdAt.toISOString(),
			severity: (d.analysisType === "correct"
				? "positive"
				: d.analysisType === "misconception"
					? "negative"
					: "neutral") as "positive" | "neutral" | "negative",
		})),
	];

	events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	return NextResponse.json({ events });
}
