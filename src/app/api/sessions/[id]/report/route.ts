export const dynamic = "force-dynamic";

import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	classes,
	classSessions,
	comprehensionSignals,
	drawingAnalyses,
	masteryRecords,
	rosterEntries,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type StudentReport = {
	rosterId: string;
	display: string;
	studentId: string;
	signal: "got-it" | "almost" | "lost" | null;
	mastery: Array<{ standardCode: string; status: string; consecutiveCorrect: number }>;
	drawings: Array<{ standardCode: string; analysisType: string; analysisText: string }>;
};

export type DiffGroup = {
	label: "Extension" | "Practice" | "Reteach";
	emoji: string;
	color: string;
	students: string[]; // display names
	recommendation: string;
};

export type SessionReport = {
	sessionId: string;
	classLabel: string;
	date: string;
	totalStudents: number;
	signalSummary: { gotIt: number; almost: number; lost: number };
	students: StudentReport[];
	diffGroups: DiffGroup[];
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: sessionId } = await params;

	// Verify teacher owns this session
	const [session] = await db
		.select()
		.from(classSessions)
		.where(and(eq(classSessions.id, sessionId), eq(classSessions.teacherId, data.user.id)));

	if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const [cls] = await db.select().from(classes).where(eq(classes.id, session.classId));

	// Fetch all data in parallel
	const [roster, signals, mastery, drawings] = await Promise.all([
		db
			.select()
			.from(rosterEntries)
			.where(and(eq(rosterEntries.classId, session.classId), eq(rosterEntries.isActive, true))),
		db
			.select({ rosterId: comprehensionSignals.rosterId, signal: comprehensionSignals.signal })
			.from(comprehensionSignals)
			.where(eq(comprehensionSignals.sessionId, sessionId)),
		db.select().from(masteryRecords).where(eq(masteryRecords.sessionId, sessionId)),
		db.select().from(drawingAnalyses).where(eq(drawingAnalyses.sessionId, sessionId)),
	]);

	// Index signals and mastery by rosterId
	const signalByRoster = new Map(signals.map((s) => [s.rosterId, s.signal]));
	const masteryByRoster = new Map<string, typeof mastery>();
	for (const rec of mastery) {
		const arr = masteryByRoster.get(rec.rosterId) ?? [];
		arr.push(rec);
		masteryByRoster.set(rec.rosterId, arr);
	}
	const drawingsByRoster = new Map<string, typeof drawings>();
	for (const d of drawings) {
		const arr = drawingsByRoster.get(d.rosterId) ?? [];
		arr.push(d);
		drawingsByRoster.set(d.rosterId, arr);
	}

	// Build per-student report
	const students: StudentReport[] = roster.map((r) => ({
		rosterId: r.id,
		display: `${r.firstInitial}.${r.lastInitial}.`,
		studentId: r.studentId,
		signal: (signalByRoster.get(r.id) as StudentReport["signal"]) ?? null,
		mastery: (masteryByRoster.get(r.id) ?? []).map((m) => ({
			standardCode: m.standardCode,
			status: m.status,
			consecutiveCorrect: m.consecutiveCorrect,
		})),
		drawings: (drawingsByRoster.get(r.id) ?? []).map((d) => ({
			standardCode: d.standardCode,
			analysisType: d.analysisType,
			analysisText: d.analysisText,
		})),
	}));

	// Signal summary
	const signalSummary = { gotIt: 0, almost: 0, lost: 0 };
	for (const s of signals) {
		if (s.signal === "got-it") signalSummary.gotIt++;
		else if (s.signal === "almost") signalSummary.almost++;
		else if (s.signal === "lost") signalSummary.lost++;
	}

	// Assign each student to a diff group based on their data
	const extension: string[] = [];
	const practice: string[] = [];
	const reteach: string[] = [];

	for (const s of students) {
		const hasMisconception = s.drawings.some((d) => d.analysisType === "misconception");
		const masteredCount = s.mastery.filter((m) => m.status === "mastered").length;
		const hasAnyMastery = masteredCount > 0;

		if (hasMisconception || (s.signal === "lost" && !hasAnyMastery)) {
			reteach.push(s.display);
		} else if (hasAnyMastery && !hasMisconception && s.signal !== "lost") {
			extension.push(s.display);
		} else {
			practice.push(s.display);
		}
	}

	// Generate AI reteach recommendations for each group
	let diffGroups: DiffGroup[] = [
		{
			label: "Extension",
			emoji: "🚀",
			color: "green",
			students: extension,
			recommendation: "",
		},
		{
			label: "Practice",
			emoji: "📚",
			color: "blue",
			students: practice,
			recommendation: "",
		},
		{
			label: "Reteach",
			emoji: "🔁",
			color: "orange",
			students: reteach,
			recommendation: "",
		},
	];

	// Only call AI if there's meaningful data
	if (students.length > 0) {
		try {
			const standardCodes = [...new Set(mastery.map((m) => m.standardCode))].join(", ");
			const prompt = `A 5th grade math teacher just finished a lesson. Here is the class performance summary:

Standards practiced: ${standardCodes || "general math"}
Students mastered at least one standard: ${extension.length}
Students still working: ${practice.length}
Students with misconceptions or lost: ${reteach.length}
Total class: ${students.length}

Signal summary — Got it: ${signalSummary.gotIt}, Almost: ${signalSummary.almost}, Lost: ${signalSummary.lost}

Generate a brief, actionable reteach recommendation for each of the 3 differentiation groups. Each recommendation should be 1–2 sentences, specific to 5th grade FL BEST Math, and executable without extra materials.

Respond with ONLY valid JSON (no markdown):
{
  "extension": "recommendation for students who mastered",
  "practice": "recommendation for students still working",
  "reteach": "recommendation for students with misconceptions"
}`;

			const aiResponse = await client.messages.create({
				model: "claude-haiku-4-5-20251001",
				max_tokens: 300,
				messages: [{ role: "user", content: prompt }],
			});

			const raw = aiResponse.content[0];
			if (raw.type === "text") {
				const json = raw.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
				const recs = JSON.parse(json) as {
					extension: string;
					practice: string;
					reteach: string;
				};
				diffGroups = [
					{ ...diffGroups[0], recommendation: recs.extension },
					{ ...diffGroups[1], recommendation: recs.practice },
					{ ...diffGroups[2], recommendation: recs.reteach },
				];
			}
		} catch {
			// Non-critical — fall through with empty recommendations
		}
	}

	const report: SessionReport = {
		sessionId,
		classLabel: cls?.label ?? "",
		date: session.date,
		totalStudents: roster.length,
		signalSummary,
		students,
		diffGroups,
	};

	return NextResponse.json({ report });
}
