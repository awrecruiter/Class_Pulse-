import { and, desc, eq, inArray } from "drizzle-orm";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	BookOpenIcon,
	CalendarDaysIcon,
	CalendarIcon,
	CheckCircleIcon,
	ClipboardListIcon,
	FolderOpenIcon,
	GraduationCapIcon,
	MessageSquareIcon,
	ShoppingBagIcon,
	UsersIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	classes,
	classSessions,
	groupMemberships,
	interventionFlags,
	lessonResources,
	masteryRecords,
	rosterEntries,
	studentGroups,
} from "@/lib/db/schema";
import { getTodayPacing } from "@/lib/pacing";
import { CollapsibleSection } from "./collapsible-section";
import { CommsActions } from "./comms-actions";
import { PacingGuideCard } from "./pacing-guide-card";
import { ScheduleManager } from "./schedule-manager";
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

	// ── Pacing ────────────────────────────────────────────────────────────────
	const pacing = getTodayPacing();

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

	const [groupRows, recentActivity, proficiencyRows] = await Promise.all([
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

					{/* Today's Resources Card */}
					<section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
								<FolderOpenIcon className="h-4 w-4 text-slate-500" />
								Today&apos;s Resources
							</h2>
							<span className="text-xs text-slate-500">{today}</span>
						</div>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{(
								[
									{ key: "bell-ringer", label: "Bell Ringer" },
									{ key: "cfu", label: "CFU Set" },
									{ key: "exit-ticket", label: "Exit Ticket" },
									{ key: "pacing", label: "Pacing Guide" },
								] as { key: ResourceTypeKey; label: string }[]
							).map(({ key, label }) => {
								const loaded = resourceReadiness[key];
								return (
									<div
										key={key}
										className={`rounded-lg border p-3 text-center ${
											loaded
												? "border-emerald-700/40 bg-emerald-900/20"
												: "border-slate-700 bg-slate-900/40"
										}`}
									>
										{loaded ? (
											<CheckCircleIcon className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
										) : (
											<XCircleIcon className="h-5 w-5 text-slate-600 mx-auto mb-1" />
										)}
										<p className="text-xs font-medium text-slate-300">{label}</p>
										{!loaded && (
											<a
												href="#upload-panel"
												className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 block"
											>
												Upload
											</a>
										)}
									</div>
								);
							})}
						</div>
					</section>

					{/* Upload Panel */}
					<UploadPanel classId={primaryClass?.id ?? null} />
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

			{/* ── Alerts strip ──────────────────────────────────────────────────── */}
			{(pacingStatus === "behind" || approvedResourceCount < 4) && (
				<section className="rounded-xl border border-yellow-700/40 bg-yellow-900/10 px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
					<div className="flex items-center gap-2 text-yellow-300 text-sm font-medium shrink-0">
						<AlertTriangleIcon className="h-4 w-4" />
						Action Needed
					</div>
					<ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
						{pacingStatus === "behind" && <li>⚠ Pacing is running late — check your calendar</li>}
						{approvedResourceCount < 4 && (
							<li>
								⚠ {4 - approvedResourceCount} resource{4 - approvedResourceCount > 1 ? "s" : ""} not
								yet uploaded for today
							</li>
						)}
					</ul>
				</section>
			)}

			{/* ── Proficiency Snapshot (full width) ─────────────────────────────── */}
			{groupRows.length > 0 && (
				<CollapsibleSection
					title={
						<>
							Proficiency Snapshot
							<span className="text-xs text-slate-500 font-normal">(last 5 sessions)</span>
						</>
					}
					icon={<GraduationCapIcon className="h-4 w-4 text-slate-500" />}
				>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{groupRows.map((group) => {
							const mastery = groupMastery[group.name];
							const pct =
								mastery && mastery.total > 0
									? Math.round((mastery.mastered / mastery.total) * 100)
									: 0;
							const barColor =
								pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
							return (
								<div key={group.id} className="space-y-1">
									<div className="flex items-center justify-between text-xs">
										<span className="font-medium text-slate-300">
											{group.emoji} {group.name}
										</span>
										<span className="text-slate-500">
											{mastery ? `${mastery.mastered}/${mastery.total} mastered` : "No data"}
										</span>
									</div>
									<div className="h-2 rounded-full bg-slate-700 overflow-hidden">
										<div
											className={`h-full rounded-full transition-all ${barColor}`}
											style={{ width: `${pct}%` }}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</CollapsibleSection>
			)}

			{/* ── Recent Sessions (full width) ──────────────────────────────────── */}
			<CollapsibleSection
				title="Recent Sessions"
				icon={<ClipboardListIcon className="h-4 w-4 text-slate-500" />}
			>
				{recentActivity.length === 0 ? (
					<p className="text-sm text-slate-500">No sessions yet</p>
				) : (
					<ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
						{recentActivity.map((session) => (
							<li
								key={session.id}
								className="flex items-center justify-between text-xs text-slate-400 py-1.5 border-b border-slate-700/50 last:border-0"
							>
								<span className="font-mono text-slate-300">{session.label}</span>
								<div className="flex items-center gap-3">
									<span>{session.date}</span>
									<span
										className={`px-2 py-0.5 rounded-full font-medium ${
											session.type === "active"
												? "bg-emerald-500/20 text-emerald-300"
												: "bg-slate-700 text-slate-400"
										}`}
									>
										{session.type}
									</span>
								</div>
							</li>
						))}
					</ul>
				)}
			</CollapsibleSection>

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
