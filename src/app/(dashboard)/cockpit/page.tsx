import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import {
	ArrowRightIcon,
	BookOpenIcon,
	CalendarDaysIcon,
	CalendarIcon,
	CheckCircleIcon,
	FolderOpenIcon,
	MessageSquareIcon,
	ShoppingBagIcon,
	UsersIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { QuestionBankPanel } from "@/components/cockpit/question-bank-panel";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	behaviorProfiles,
	classes,
	classSessions,
	groupMemberships,
	interventionFlags,
	lessonResources,
	masteryRecords,
	rosterEntries,
	studentGroups,
	teacherSettings,
} from "@/lib/db/schema";
import { getTodayPacing } from "@/lib/pacing";
import { CommsActions } from "./comms-actions";
import { CockpitInfoStrip } from "./info-strip";
import { PacingGuideCard } from "./pacing-guide-card";
import { ScheduleManager } from "./schedule-manager";
import { TodaysQuestionsPanel } from "./todays-questions-panel";
import { UploadPanel } from "./upload-panel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function statusDot(color: "green" | "yellow" | "red") {
	const map = {
		green: "bg-emerald-400",
		yellow: "bg-yellow-400",
		red: "bg-red-400",
	};
	return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${map[color]}`} />;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CockpitPage() {
	const { data } = await auth.getSession();
	if (!data?.user) redirect("/login");

	const teacherId = data.user.id;
	const today = todayStr();

	// ── Parallel data fetches ──────────────────────────────────────────────────

	const [teacherClasses, todayResourceRows, draftFlags] = await Promise.all([
		// All active classes for this teacher
		db
			.select()
			.from(classes)
			.where(and(eq(classes.teacherId, teacherId), eq(classes.isArchived, false))),

		// Today's lesson resources (imported for today or topicNumber=0 with importDate=today)
		db
			.select()
			.from(lessonResources)
			.where(and(eq(lessonResources.teacherId, teacherId), eq(lessonResources.importDate, today))),

		// Draft intervention flags (parent comms queue)
		db
			.select({
				id: interventionFlags.id,
				classId: interventionFlags.classId,
				rosterId: interventionFlags.rosterId,
				tier: interventionFlags.tier,
				standardCode: interventionFlags.standardCode,
				sessionCount: interventionFlags.sessionCount,
				detectedAt: interventionFlags.detectedAt,
				firstInitial: rosterEntries.firstInitial,
				lastInitial: rosterEntries.lastInitial,
			})
			.from(interventionFlags)
			.innerJoin(rosterEntries, eq(interventionFlags.rosterId, rosterEntries.id))
			.where(eq(interventionFlags.status, "draft"))
			.orderBy(desc(interventionFlags.detectedAt))
			.limit(20),
	]);

	// ── Teacher settings (topic override + behavior reset schedule) ─────────
	let settingsRow: { currentTopicNumber: number | null; behaviorResetSchedule: string } | null =
		null;
	try {
		settingsRow = await db
			.select({
				currentTopicNumber: teacherSettings.currentTopicNumber,
				behaviorResetSchedule: teacherSettings.behaviorResetSchedule,
			})
			.from(teacherSettings)
			.where(eq(teacherSettings.userId, teacherId))
			.limit(1)
			.then((r) => r[0] ?? null);
	} catch {
		// DB schema may be behind — use defaults and continue
	}
	const topicOverride = settingsRow?.currentTopicNumber ?? null;

	// ── Auto-reset behavior profiles if schedule requires it ─────────────────
	// Uses teacherClasses[0] directly — primaryClass is declared later in this component
	const behaviorResetSchedule = settingsRow?.behaviorResetSchedule ?? "manual";
	const autoResetClass = teacherClasses[0] ?? null;
	if (autoResetClass && behaviorResetSchedule !== "manual") {
		try {
			const now = new Date();
			let cutoff: Date | null = null;
			if (behaviorResetSchedule === "daily") {
				cutoff = new Date(now);
				cutoff.setHours(0, 0, 0, 0);
			} else if (behaviorResetSchedule === "weekly") {
				cutoff = new Date(now);
				cutoff.setDate(cutoff.getDate() - 7);
			} else if (behaviorResetSchedule === "monthly") {
				cutoff = new Date(now);
				cutoff.setMonth(cutoff.getMonth() - 1);
			} else if (behaviorResetSchedule === "quarterly") {
				cutoff = new Date(now);
				cutoff.setDate(cutoff.getDate() - 90);
			}
			if (cutoff) {
				await db
					.update(behaviorProfiles)
					.set({ currentStep: 0, lastResetAt: now, updatedAt: now })
					.where(
						and(
							eq(behaviorProfiles.classId, autoResetClass.id),
							or(isNull(behaviorProfiles.lastResetAt), lt(behaviorProfiles.lastResetAt, cutoff)),
						),
					);
			}
		} catch {
			// Auto-reset must never crash the cockpit page
		}
	}

	// ── Pacing ────────────────────────────────────────────────────────────────
	const pacing = getTodayPacing(undefined, topicOverride);

	// ── Resource readiness ───────────────────────────────────────────────────
	const resourceTypes = ["bell-ringer", "cfu", "exit-ticket", "pacing"] as const;
	type ResourceTypeKey = (typeof resourceTypes)[number];
	const resourceReadiness: Record<ResourceTypeKey, boolean> = {
		"bell-ringer": false,
		cfu: false,
		"exit-ticket": false,
		pacing: false,
	};
	for (const row of todayResourceRows) {
		if ((resourceTypes as readonly string[]).includes(row.resourceType)) {
			resourceReadiness[row.resourceType as ResourceTypeKey] = true;
		}
	}
	const approvedResourceCount = Object.values(resourceReadiness).filter(Boolean).length;

	// ── Groups per class ──────────────────────────────────────────────────────
	// Fetch groups for the first class (primary class)
	const primaryClass = teacherClasses[0] ?? null;

	const [groupRows, recentActivity, proficiencyRows, activeSessionRow] = await Promise.all([
		primaryClass
			? db.select().from(studentGroups).where(eq(studentGroups.classId, primaryClass.id))
			: Promise.resolve([]),

		// Recent activity: last 20 events across sessions, RAM transactions, CFU entries
		primaryClass
			? db
					.select({
						id: classSessions.id,
						type: classSessions.status,
						date: classSessions.date,
						label: classSessions.joinCode,
						createdAt: classSessions.startedAt,
					})
					.from(classSessions)
					.where(eq(classSessions.teacherId, teacherId))
					.orderBy(desc(classSessions.startedAt))
					.limit(10)
			: Promise.resolve([]),

		// Proficiency snapshot: mastery records for last 5 sessions per class
		primaryClass
			? db
					.select({
						rosterId: masteryRecords.rosterId,
						standardCode: masteryRecords.standardCode,
						status: masteryRecords.status,
						consecutiveCorrect: masteryRecords.consecutiveCorrect,
					})
					.from(masteryRecords)
					.innerJoin(classSessions, eq(masteryRecords.sessionId, classSessions.id))
					.where(eq(classSessions.classId, primaryClass.id))
					.limit(200)
			: Promise.resolve([]),

		// Active (live) session for the primary class
		primaryClass
			? db
					.select({ id: classSessions.id })
					.from(classSessions)
					.where(
						and(eq(classSessions.classId, primaryClass.id), eq(classSessions.status, "active")),
					)
					.limit(1)
					.then((r) => r[0] ?? null)
			: Promise.resolve(null),
	]);

	// ── Group membership counts ───────────────────────────────────────────────
	const groupMemberCounts: Record<string, number> = {};
	if (groupRows.length > 0) {
		const groupIds = groupRows.map((g) => g.id);
		const memberships = await db
			.select({ groupId: groupMemberships.groupId })
			.from(groupMemberships)
			.where(inArray(groupMemberships.groupId, groupIds));
		for (const m of memberships) {
			groupMemberCounts[m.groupId] = (groupMemberCounts[m.groupId] ?? 0) + 1;
		}
	}

	// ── Proficiency per group ─────────────────────────────────────────────────
	// Map rosterId → groupName
	const rosterGroupMap: Record<string, string> = {};
	if (groupRows.length > 0) {
		const groupIds = groupRows.map((g) => g.id);
		const allMemberships = await db
			.select({
				rosterId: groupMemberships.rosterId,
				groupId: groupMemberships.groupId,
			})
			.from(groupMemberships)
			.where(inArray(groupMemberships.groupId, groupIds));

		const groupNameById: Record<string, string> = {};
		for (const g of groupRows) groupNameById[g.id] = g.name;
		for (const m of allMemberships) {
			rosterGroupMap[m.rosterId] = groupNameById[m.groupId] ?? "Unknown";
		}
	}

	// Aggregate mastery by group
	const groupMastery: Record<string, { mastered: number; total: number }> = {};
	for (const rec of proficiencyRows) {
		const group = rosterGroupMap[rec.rosterId] ?? "Ungrouped";
		if (!groupMastery[group]) groupMastery[group] = { mastered: 0, total: 0 };
		groupMastery[group].total++;
		if (rec.status === "mastered") groupMastery[group].mastered++;
	}

	// ── Pacing status ─────────────────────────────────────────────────────────
	const pacingStatus = pacing
		? pacing.daysLeft <= 2 && !pacing.topic.isReview
			? "behind"
			: "on-track"
		: "no-data";

	const pacingColor =
		pacingStatus === "on-track" ? "green" : pacingStatus === "behind" ? "red" : "yellow";
	const resourceColor: "green" | "yellow" | "red" =
		approvedResourceCount === 4 ? "green" : approvedResourceCount > 0 ? "yellow" : "red";
	const commsColor: "green" | "yellow" | "red" =
		draftFlags.length === 0 ? "green" : draftFlags.length <= 3 ? "yellow" : "red";

	// ── Render ────────────────────────────────────────────────────────────────

	if (teacherClasses.length === 0) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-16 flex flex-col items-center justify-center gap-6 text-center">
				<div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
					<UsersIcon className="h-8 w-8 text-indigo-400" />
				</div>
				<div>
					<h1 className="text-2xl font-bold text-slate-200">Welcome to Class Pulse</h1>
					<p className="text-slate-400 mt-2 max-w-md">
						Create your first class to start tracking students, running sessions, and using the AI
						coach.
					</p>
				</div>
				<Link
					href="/classes"
					className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 text-sm font-bold text-white transition-colors shadow-lg"
				>
					Create Your First Class
					<ArrowRightIcon className="h-4 w-4" />
				</Link>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
			{/* ── Status Bar ──────────────────────────────────────────────────── */}
			<section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
				<h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
					Today&apos;s Status
				</h2>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{/* Pacing */}
					<div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3 space-y-1.5">
						<div className="flex items-center gap-1.5">
							{statusDot(pacingColor)}
							<span className="text-xs font-medium text-slate-400">Pacing</span>
						</div>
						{pacing ? (
							<>
								<p className="text-sm font-semibold text-slate-200 leading-tight">
									Topic {pacing.topic.number}
								</p>
								{pacing.topic.title && (
									<p className="text-xs text-slate-500 truncate">{pacing.topic.title}</p>
								)}
								<p className="text-xs text-slate-500">
									{pacingStatus === "behind"
										? `${pacing.daysLeft}d left — running late`
										: `${pacing.daysLeft}d left — on track`}
								</p>
							</>
						) : (
							<p className="text-xs text-slate-500">No pacing data for today</p>
						)}
					</div>

					{/* Current Lesson */}
					<div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3 space-y-1.5">
						<div className="flex items-center gap-1.5">
							{statusDot("green")}
							<span className="text-xs font-medium text-slate-400">Lesson</span>
						</div>
						<p className="text-sm font-semibold text-slate-200 leading-tight">
							{pacing?.currentLesson
								? `Lesson ${pacing.currentLesson.number}`
								: pacing?.topic.isReview
									? "FAST Review"
									: "—"}
						</p>
						{pacing?.currentLesson?.title && (
							<p className="text-xs text-slate-400 truncate">{pacing.currentLesson.title}</p>
						)}
						{pacing?.isFastWindow && <p className="text-xs text-yellow-400">FAST window active</p>}
					</div>

					{/* Resources */}
					<div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3 space-y-1.5">
						<div className="flex items-center gap-1.5">
							{statusDot(resourceColor)}
							<span className="text-xs font-medium text-slate-400">Resources</span>
						</div>
						<p className="text-sm font-semibold text-slate-200 leading-tight">
							{approvedResourceCount}/4 uploaded
						</p>
						<p className="text-xs text-slate-500">for today</p>
					</div>

					{/* Parent Comms */}
					<div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3 space-y-1.5">
						<div className="flex items-center gap-1.5">
							{statusDot(commsColor)}
							<span className="text-xs font-medium text-slate-400">Parent Comms</span>
						</div>
						<p className="text-sm font-semibold text-slate-200 leading-tight">
							{draftFlags.length} pending
						</p>
						<p className="text-xs text-slate-500">intervention flags</p>
					</div>
				</div>
			</section>

			{/* ── Info strip (alerts · proficiency · sessions) ─────────────────── */}
			<CockpitInfoStrip
				alerts={{
					pacing: pacingStatus === "behind",
					resourcesMissing: 4 - approvedResourceCount,
				}}
				groupRows={groupRows}
				groupMastery={groupMastery}
				recentActivity={recentActivity}
			/>

			{/* ── Main grid ───────────────────────────────────────────────────── */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
				{/* Left column (2/3) */}
				<div className="lg:col-span-2 space-y-6">
					{/* Class Selector */}
					<section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
								<UsersIcon className="h-4 w-4 text-slate-500" />
								Your Classes
							</h2>
							<Link
								href="/classes"
								className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
							>
								Manage <ArrowRightIcon className="h-3 w-3" />
							</Link>
						</div>
						{teacherClasses.length === 0 ? (
							<p className="text-sm text-slate-500">
								No classes yet.{" "}
								<Link href="/classes" className="text-indigo-400 hover:text-indigo-300">
									Create one
								</Link>
							</p>
						) : (
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{teacherClasses.map((cls, i) => (
									<Link
										key={cls.id}
										href={`/classes/${cls.id}`}
										className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
											i === 0
												? "border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/15"
												: "border-slate-700 bg-slate-900/40 hover:bg-slate-700/30"
										}`}
									>
										<div>
											<p className="text-sm font-semibold text-slate-200">{cls.label}</p>
											{cls.periodTime && <p className="text-xs text-slate-500">{cls.periodTime}</p>}
										</div>
										<div className="text-xs text-slate-500 text-right">
											{i === 0 && groupRows.length > 0 && (
												<span className="text-indigo-400">{groupRows.length} groups</span>
											)}
										</div>
									</Link>
								))}
							</div>
						)}
					</section>

					{/* Upload Panel */}
					<UploadPanel classId={primaryClass?.id ?? null} />
					<TodaysQuestionsPanel date={today} />
					<QuestionBankPanel activeSessionId={activeSessionRow?.id ?? null} />
				</div>

				{/* Right column (1/3) */}
				<div className="space-y-6">
					{/* Quick Actions */}
					<section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
						<h2 className="text-sm font-semibold text-slate-300 mb-3">Quick Actions</h2>
						<nav className="space-y-1.5">
							{[
								{ href: "/pacing", label: "Pacing Calendar", icon: CalendarDaysIcon },
								{ href: "/classes", label: "Classes & Roster", icon: UsersIcon },
								{ href: "/parent-comms", label: "Parent Comms", icon: MessageSquareIcon },
								{ href: "/store", label: "Privilege Store", icon: ShoppingBagIcon },
								{ href: "/gradebook", label: "Gradebook", icon: BookOpenIcon },
								{ href: "/resources", label: "Resources", icon: FolderOpenIcon },
							].map(({ href, label, icon: Icon }) => (
								<Link
									key={href}
									href={href}
									className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
								>
									<Icon className="h-4 w-4 text-slate-500" />
									{label}
								</Link>
							))}
						</nav>
					</section>

					{/* Parent Comms Queue */}
					<section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
								<MessageSquareIcon className="h-4 w-4 text-slate-500" />
								Parent Comms Queue
							</h2>
							{draftFlags.length > 0 && (
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-300 text-xs font-bold">
									{draftFlags.length}
								</span>
							)}
						</div>

						{draftFlags.length === 0 ? (
							<div className="flex items-center gap-2 text-sm text-emerald-400">
								<CheckCircleIcon className="h-4 w-4" />
								All caught up!
							</div>
						) : (
							<div className="space-y-2">
								{draftFlags.slice(0, 5).map((flag) => (
									<CommsActions
										key={flag.id}
										flagId={flag.id}
										studentInitials={`${flag.firstInitial}.${flag.lastInitial}.`}
										standardCode={flag.standardCode}
										tier={flag.tier}
										sessionCount={flag.sessionCount}
										classId={flag.classId}
									/>
								))}
								{draftFlags.length > 5 && (
									<Link
										href="/parent-comms"
										className="flex items-center justify-center gap-1 py-2 text-xs text-indigo-400 hover:text-indigo-300"
									>
										+{draftFlags.length - 5} more <ArrowRightIcon className="h-3 w-3" />
									</Link>
								)}
							</div>
						)}
					</section>
				</div>
			</div>

			{/* ── Schedule (full width) ──────────────────────────────────────── */}
			<section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
				<h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
					<CalendarIcon className="h-4 w-4 text-slate-500" />
					Schedule
				</h2>
				<ScheduleManager />
			</section>

			{/* ── Pacing Guide (full width) ───────────────────────────────────── */}
			<section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
				<PacingGuideCard />
			</section>
		</div>
	);
}
