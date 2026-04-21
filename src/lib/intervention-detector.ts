/**
 * Cross-session comprehension pattern detector.
 *
 * Runs after a session ends. Scans comprehensionSignals across sessions for this
 * class to find students who are repeatedly "lost" on the same standard.
 *
 * Tier 2: student had signal "lost" in 2+ sessions for the same standardCode
 * Tier 3: tier-2 pattern persists across standards (3+) OR spans 2+ calendar weeks
 *
 * Only creates flags with status "draft" — teacher reviews before sending.
 * Skips students who already have a draft or sent flag for the same standard.
 */

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	classSessions,
	comprehensionSignals,
	interventionFlags,
	rosterEntries,
} from "@/lib/db/schema";

export async function detectInterventions(classId: string, _teacherId: string): Promise<void> {
	// 1. Get all ended sessions for this class that have a standardCode, last 90 days
	const sessions = await db
		.select({
			id: classSessions.id,
			standardCode: classSessions.standardCode,
			date: classSessions.date,
		})
		.from(classSessions)
		.where(
			and(
				eq(classSessions.classId, classId),
				eq(classSessions.status, "ended"),
				isNotNull(classSessions.standardCode),
			),
		)
		.orderBy(desc(classSessions.startedAt))
		.limit(60);

	const taggedSessions = sessions.filter((s) => s.standardCode != null);
	if (taggedSessions.length === 0) return;

	const sessionIds = taggedSessions.map((s) => s.id);

	// 2. Fetch all "lost" signals for these sessions
	const lostSignals = await db
		.select({
			sessionId: comprehensionSignals.sessionId,
			rosterId: comprehensionSignals.rosterId,
		})
		.from(comprehensionSignals)
		.where(
			and(
				inArray(comprehensionSignals.sessionId, sessionIds),
				eq(comprehensionSignals.signal, "lost"),
			),
		);

	if (lostSignals.length === 0) return;

	// 3. Build map: rosterId → { standardCode → sessions[] }
	const sessionMap = new Map(taggedSessions.map((s) => [s.id, s]));
	const byStudent = new Map<string, Map<string, { date: string }[]>>();

	for (const sig of lostSignals) {
		const session = sessionMap.get(sig.sessionId);
		if (!session?.standardCode) continue;

		if (!byStudent.has(sig.rosterId)) byStudent.set(sig.rosterId, new Map());
		const byStd = byStudent.get(sig.rosterId)!;
		if (!byStd.has(session.standardCode)) byStd.set(session.standardCode, []);
		byStd.get(session.standardCode)!.push({ date: session.date });
	}

	// 4. Fetch existing draft/sent flags to avoid duplicates
	const rosterIds = [...byStudent.keys()];
	if (rosterIds.length === 0) return;

	const existingFlags = await db
		.select({
			rosterId: interventionFlags.rosterId,
			standardCode: interventionFlags.standardCode,
			status: interventionFlags.status,
		})
		.from(interventionFlags)
		.where(
			and(
				eq(interventionFlags.classId, classId),
				inArray(interventionFlags.rosterId, rosterIds),
				inArray(interventionFlags.status, ["draft", "sent"]),
			),
		);

	const alreadyFlagged = new Set(existingFlags.map((f) => `${f.rosterId}::${f.standardCode}`));

	// 5. Detect and insert
	const toInsert: {
		classId: string;
		rosterId: string;
		tier: string;
		standardCode: string;
		sessionCount: number;
	}[] = [];

	for (const [rosterId, byStd] of byStudent) {
		const tier2Standards: string[] = [];

		for (const [standardCode, sessions] of byStd) {
			if (sessions.length < 2) continue;
			const key = `${rosterId}::${standardCode}`;
			if (alreadyFlagged.has(key)) continue;

			tier2Standards.push(standardCode);
		}

		if (tier2Standards.length === 0) continue;

		// Check for tier 3: 3+ distinct standards flagged OR weeks span 2+
		const allFlaggedStdCount = tier2Standards.length;
		const tier3ByCount = allFlaggedStdCount >= 3;

		// Check week spread: earliest and latest session dates across flagged standards
		let earliest = "9999";
		let latest = "0000";
		for (const std of tier2Standards) {
			for (const s of byStd.get(std)!) {
				if (s.date < earliest) earliest = s.date;
				if (s.date > latest) latest = s.date;
			}
		}
		const weekMs = 7 * 24 * 60 * 60 * 1000;
		const spanMs = new Date(latest).getTime() - new Date(earliest).getTime();
		const tier3ByWeeks = spanMs >= weekMs * 2;

		const tier = tier3ByCount || tier3ByWeeks ? "tier3" : "tier2";

		// For tier 3 — flag the primary standard (most sessions lost)
		// For tier 2 — flag each qualifying standard individually
		if (tier === "tier3") {
			// Pick the standard with most lost sessions as the primary
			let primaryStd = tier2Standards[0];
			let maxSessions = 0;
			for (const std of tier2Standards) {
				const cnt = byStd.get(std)!.length;
				if (cnt > maxSessions) {
					maxSessions = cnt;
					primaryStd = std;
				}
			}
			const key = `${rosterId}::${primaryStd}`;
			if (!alreadyFlagged.has(key)) {
				toInsert.push({
					classId,
					rosterId,
					tier: "tier3",
					standardCode: primaryStd,
					sessionCount: maxSessions,
				});
			}
		} else {
			for (const std of tier2Standards) {
				toInsert.push({
					classId,
					rosterId,
					tier: "tier2",
					standardCode: std,
					sessionCount: byStd.get(std)!.length,
				});
			}
		}
	}

	if (toInsert.length === 0) return;

	// Insert new flags — ignore conflicts (unique index on rosterId+standardCode+status)
	await db.insert(interventionFlags).values(toInsert).onConflictDoNothing();

	// Log roster IDs for debugging (no student names — FERPA)
	const rosterIdsWithFlags = [...new Set(toInsert.map((f) => f.rosterId))];
	const rosterRows = await db
		.select({
			id: rosterEntries.id,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
			studentId: rosterEntries.studentId,
		})
		.from(rosterEntries)
		.where(inArray(rosterEntries.id, rosterIdsWithFlags));

	const _rosterDisplay = rosterRows.map(
		(r) => `${r.studentId} (${r.firstInitial}.${r.lastInitial}.)`,
	);
}
