import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import {
	BookOpen,
	ExternalLink,
	GraduationCap,
	MessageCircle,
	ShieldAlert,
	Siren,
	TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IXL_SKILL_MAP } from "@/data/ixl-skill-map";
import { db } from "@/lib/db";
import {
	behaviorProfiles,
	classAssignments,
	classes,
	classSessions,
	comprehensionSignals,
	interventionFlags,
	parentReportTokens,
	ramBuckAccounts,
	ramBuckTransactions,
	rosterEntries,
} from "@/lib/db/schema";
import { getTopicForDate } from "@/lib/pacing";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student Summary — Class Pulse" };

interface PageProps {
	params: Promise<{ token: string }>;
}

export default async function ReportPage({ params }: PageProps) {
	const { token } = await params;

	const [tokenRow] = await db
		.select({
			id: parentReportTokens.id,
			flagId: parentReportTokens.flagId,
			expiresAt: parentReportTokens.expiresAt,
			viewedAt: parentReportTokens.viewedAt,
		})
		.from(parentReportTokens)
		.where(eq(parentReportTokens.token, token));

	if (!tokenRow || tokenRow.expiresAt < new Date()) notFound();

	if (!tokenRow.viewedAt) {
		db.update(parentReportTokens)
			.set({ viewedAt: new Date() })
			.where(eq(parentReportTokens.id, tokenRow.id))
			.catch(() => {});
	}

	const [flag] = await db
		.select({
			tier: interventionFlags.tier,
			standardCode: interventionFlags.standardCode,
			sessionCount: interventionFlags.sessionCount,
			classId: interventionFlags.classId,
			rosterId: interventionFlags.rosterId,
			detectedAt: interventionFlags.detectedAt,
		})
		.from(interventionFlags)
		.where(eq(interventionFlags.id, tokenRow.flagId));

	if (!flag) notFound();

	const { classId, rosterId } = flag;

	const weekStart = new Date();
	weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
	weekStart.setHours(0, 0, 0, 0);

	const [lastSession] = await db
		.select({ id: classSessions.id })
		.from(classSessions)
		.where(and(eq(classSessions.classId, classId), eq(classSessions.status, "ended")))
		.orderBy(desc(classSessions.endedAt))
		.limit(1);

	const [roster, cls, behaviorRow, buckRow, assignmentRow, weekEarnedRow, signalRow] =
		await Promise.all([
			db
				.select({
					firstInitial: rosterEntries.firstInitial,
					lastInitial: rosterEntries.lastInitial,
					studentId: rosterEntries.studentId,
				})
				.from(rosterEntries)
				.where(eq(rosterEntries.id, rosterId))
				.then((r) => r[0]),
			db
				.select({ label: classes.label, gradeLevel: classes.gradeLevel })
				.from(classes)
				.where(eq(classes.id, classId))
				.then((r) => r[0]),
			db
				.select({ currentStep: behaviorProfiles.currentStep })
				.from(behaviorProfiles)
				.where(and(eq(behaviorProfiles.classId, classId), eq(behaviorProfiles.rosterId, rosterId)))
				.then((r) => r[0]),
			db
				.select({ balance: ramBuckAccounts.balance })
				.from(ramBuckAccounts)
				.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)))
				.then((r) => r[0]),
			db
				.select({ content: classAssignments.content })
				.from(classAssignments)
				.where(
					and(
						eq(classAssignments.classId, classId),
						eq(classAssignments.date, flag.detectedAt.toISOString().slice(0, 10)),
					),
				)
				.then((r) => r[0]),
			db
				.select({ total: sql<number>`coalesce(sum(${ramBuckTransactions.amount}), 0)` })
				.from(ramBuckTransactions)
				.where(
					and(
						eq(ramBuckTransactions.classId, classId),
						eq(ramBuckTransactions.rosterId, rosterId),
						gt(ramBuckTransactions.amount, 0),
						gte(ramBuckTransactions.createdAt, weekStart),
					),
				)
				.then((r) => r[0]),
			lastSession
				? db
						.select({ signal: comprehensionSignals.signal })
						.from(comprehensionSignals)
						.where(
							and(
								eq(comprehensionSignals.sessionId, lastSession.id),
								eq(comprehensionSignals.rosterId, rosterId),
							),
						)
						.then((r) => r[0])
				: Promise.resolve(undefined),
		]);

	const currentTopic = getTopicForDate(new Date().toISOString().slice(0, 10));
	const ixlSkill = IXL_SKILL_MAP[flag.standardCode];
	const topic = ixlSkill?.name ?? "Math";

	// Name: show first initial only if last initial is missing
	const initials = [roster?.firstInitial, roster?.lastInitial].filter(Boolean).join(".");
	const studentDisplay = initials ? `${initials}.` : "Student";
	const studentId = roster?.studentId ?? "";
	const dateStr = flag.detectedAt.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	const signal = signalRow?.signal as "got-it" | "almost" | "lost" | undefined;

	const compConfig = {
		"got-it": {
			emoji: "✅",
			headline: "Got it today",
			sub: "Your child signaled confidence during class.",
			border: "border-emerald-500",
			bg: "bg-emerald-500/10",
			label: "text-emerald-400",
		},
		almost: {
			emoji: "🟡",
			headline: "Getting there",
			sub: "Your child needed a little more support today.",
			border: "border-amber-500",
			bg: "bg-amber-500/10",
			label: "text-amber-400",
		},
		lost: {
			emoji: "🆘",
			headline: "Struggled today",
			sub: "Your child signaled they were lost in class.",
			border: "border-rose-500",
			bg: "bg-rose-500/10",
			label: "text-rose-400",
		},
	} as const;

	const comp = signal ? compConfig[signal] : null;
	const isUrgent = flag.tier === "tier3";

	const step = behaviorRow?.currentStep ?? 0;
	const balance = buckRow?.balance ?? 0;
	const weekEarned = Number(weekEarnedRow?.total ?? 0);
	const behaviorOk = step <= 2;
	const behaviorLabel =
		step === 0 ? "No incidents" : step <= 2 ? `Step ${step} of 8 — minor` : `Step ${step} of 8`;

	const conversationStarter =
		signal === "lost" || signal === "almost"
			? `"Can you show me one problem you worked on today? I want to practice ${topic} with you."`
			: `"What's one thing you learned about ${topic} today? Teach it to me!"`;

	return (
		<div className="min-h-screen bg-[#0c0c14]">
			<style>{`@media print { .no-print { display: none !important; } }`}</style>

			<div className="max-w-sm mx-auto px-4 pt-8 pb-10 space-y-3">
				{/* Identity */}
				<div className="pb-2">
					<p className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-semibold uppercase tracking-widest mb-2">
						<span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
						Class Pulse · {cls?.label}
					</p>
					<div className="flex items-end justify-between">
						<h1 className="text-3xl font-bold text-white">{studentDisplay}</h1>
						<p className="text-xs text-zinc-600 pb-1">{dateStr}</p>
					</div>
					{studentId && <p className="text-xs text-zinc-600 mt-0.5">ID {studentId}</p>}
				</div>

				{/* Homework — only when assigned */}
				{assignmentRow?.content && (
					<div className="rounded-2xl border border-violet-500 bg-violet-500/10 overflow-hidden">
						<div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
							<BookOpen size={13} className="text-violet-400 shrink-0" />
							<span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">
								Tonight's Homework
							</span>
						</div>
						<p className="px-4 pb-4 text-white text-lg font-semibold leading-snug">
							{assignmentRow.content}
						</p>
					</div>
				)}

				{/* Comprehension — only when student signalled */}
				{comp && (
					<div className={`rounded-2xl border ${comp.border} ${comp.bg} px-4 py-3.5`}>
						<p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${comp.label}`}>
							How They Did Today
						</p>
						<div className="flex items-start gap-3">
							<span className="text-2xl leading-none">{comp.emoji}</span>
							<div>
								<p className="text-white font-semibold">{comp.headline}</p>
								<p className="text-sm text-zinc-400 mt-0.5">{comp.sub}</p>
							</div>
						</div>
					</div>
				)}

				{/* Teacher flag */}
				<div
					className={`rounded-2xl border overflow-hidden ${isUrgent ? "border-rose-500 bg-rose-500/10" : "border-amber-500 bg-amber-500/10"}`}
				>
					<div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
						{isUrgent ? (
							<Siren size={13} className="text-rose-400 shrink-0" />
						) : (
							<TriangleAlert size={13} className="text-amber-400 shrink-0" />
						)}
						<span
							className={`text-[10px] font-bold uppercase tracking-widest ${isUrgent ? "text-rose-400" : "text-amber-400"}`}
						>
							Teacher Flag
						</span>
					</div>
					<div className="px-4 pb-4 space-y-1">
						<p className="text-white font-semibold text-lg leading-snug">
							{isUrgent ? "Struggling across multiple topics" : `Difficulty with ${topic}`}
						</p>
						<p className="text-sm text-zinc-300 leading-relaxed">
							{isUrgent
								? "A pattern across several math areas has been flagged. Extra support is recommended."
								: `Seen in ${flag.sessionCount} recent class session${flag.sessionCount !== 1 ? "s" : ""}. A little practice at home makes a big difference.`}
						</p>
						{currentTopic && (
							<p className="text-xs text-zinc-500 pt-1">
								Class is on: <span className="text-zinc-400">{currentTopic.title}</span>
							</p>
						)}
					</div>
				</div>

				{/* Actions */}
				<div className="space-y-2 pt-1">
					<p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
						What to do right now
					</p>

					<div className="grid grid-cols-2 gap-2">
						{ixlSkill && (
							<a
								href={ixlSkill.url}
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-xl border border-sky-500 bg-sky-500/10 px-3 py-3.5 flex flex-col gap-3 no-underline active:opacity-75"
							>
								<ExternalLink size={16} className="text-sky-400" />
								<div>
									<p className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">
										IXL Practice
									</p>
									<p className="text-sm font-bold text-white leading-snug mt-0.5">
										{ixlSkill.name}
									</p>
									<p className="text-[10px] text-sky-500 mt-1">Tap to open →</p>
								</div>
							</a>
						)}
						<a
							href={`https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(topic + " grade 5 math")}`}
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-xl border border-teal-500 bg-teal-500/10 px-3 py-3.5 flex flex-col gap-3 no-underline active:opacity-75"
						>
							<GraduationCap size={16} className="text-teal-400" />
							<div>
								<p className="text-[10px] font-bold text-teal-400 uppercase tracking-wide">
									Khan Academy
								</p>
								<p className="text-sm font-bold text-white leading-snug mt-0.5">{topic}</p>
								<p className="text-[10px] text-teal-500 mt-1">Free · Tap to open →</p>
							</div>
						</a>
					</div>

					<div className="rounded-xl border border-fuchsia-500 bg-fuchsia-500/10 px-4 py-3.5">
						<div className="flex items-center gap-2 mb-2">
							<MessageCircle size={13} className="text-fuchsia-400 shrink-0" />
							<p className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest">
								Ask them tonight
							</p>
						</div>
						<p className="text-sm text-zinc-100 leading-relaxed italic">{conversationStarter}</p>
					</div>
				</div>

				{/* Behavior strip */}
				<div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<span
							className={`w-2 h-2 rounded-full shrink-0 ${behaviorOk ? "bg-emerald-500" : step >= 5 ? "bg-rose-500" : "bg-amber-500"}`}
						/>
						<div>
							<p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
								Behavior
							</p>
							<p className="text-sm font-medium text-zinc-200">{behaviorLabel}</p>
						</div>
					</div>
					<div className="text-right">
						<p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">RAM Bucks</p>
						<p className="text-sm font-medium text-zinc-200">
							{balance} pts
							{weekEarned > 0 && (
								<span className="text-emerald-400 text-xs ml-1">+{weekEarned} wk</span>
							)}
						</p>
					</div>
				</div>

				<div className="no-print pt-1">
					<PrintButton />
				</div>

				<p className="text-[10px] text-zinc-700 text-center leading-relaxed">
					Class Pulse · Initials + ID only per FERPA · Link expires in 30 days
				</p>
			</div>
		</div>
	);
}
