import { and, desc, eq } from "drizzle-orm";
import {
	AlertTriangle,
	BookOpen,
	Check,
	ExternalLink,
	GraduationCap,
	MessageCircle,
	ShieldAlert,
	Siren,
	TriangleAlert,
	X,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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

	const [roster, cls, behaviorRow, assignmentRow, signalRow] = await Promise.all([
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
			.select({ content: classAssignments.content })
			.from(classAssignments)
			.where(
				and(
					eq(classAssignments.classId, classId),
					eq(classAssignments.date, flag.detectedAt.toISOString().slice(0, 10)),
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

	if (!tokenRow.viewedAt) {
		async function confirmReceipt() {
			"use server";
			await db
				.update(parentReportTokens)
				.set({ viewedAt: new Date() })
				.where(eq(parentReportTokens.id, tokenRow.id));
			redirect(`/report/${token}`);
		}

		return (
			<div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6">
				<div className="w-full max-w-sm space-y-6">
					<div className="text-center space-y-1">
						<p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-widest">
							Class Pulse
						</p>
						<h1 className="text-2xl font-bold text-[#1D1D1F]">You have a school update</h1>
						<p className="text-sm text-[#86868B] leading-relaxed pt-1">
							Your child's teacher sent you a report. Tap below to view it and confirm receipt.
						</p>
					</div>

					<div className="rounded-2xl bg-white shadow-sm border border-black/5 px-5 py-4 flex items-center justify-between">
						<div>
							<p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-widest">
								Student
							</p>
							<p className="text-lg font-bold text-[#1D1D1F]">{studentDisplay}</p>
						</div>
						{cls?.label && (
							<div className="text-right">
								<p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-widest">
									Class
								</p>
								<p className="text-sm font-semibold text-[#1D1D1F]">{cls.label}</p>
							</div>
						)}
					</div>

					<form action={confirmReceipt}>
						<button
							type="submit"
							className="w-full py-4 rounded-2xl bg-[#1D1D1F] text-white text-base font-semibold tracking-tight active:opacity-80 transition-opacity"
						>
							View Report
						</button>
					</form>

					<p className="text-[10px] text-[#86868B] text-center leading-relaxed">
						Class Pulse · Initials + ID only per FERPA · Link expires in 30 days
					</p>
				</div>
			</div>
		);
	}
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

	const behaviorColor = step <= 2 ? "bg-emerald-500" : step >= 5 ? "bg-rose-500" : "bg-amber-400";
	const behaviorStatus = step <= 2 ? "Good standing" : step >= 5 ? "Needs attention" : "Monitor";
	const behaviorIcon =
		step <= 2 ? (
			<Check size={32} strokeWidth={3} className="text-white" />
		) : step >= 5 ? (
			<X size={32} strokeWidth={3} className="text-white" />
		) : (
			<AlertTriangle size={28} strokeWidth={2.5} className="text-white" />
		);

	const academicColor =
		signal === "got-it"
			? "bg-emerald-500"
			: signal === "lost" || isUrgent
				? "bg-rose-500"
				: "bg-amber-400";
	const academicStatus =
		signal === "got-it"
			? "On track"
			: signal === "lost" || isUrgent
				? "Needs support"
				: signal === "almost"
					? "Getting there"
					: "Flagged";
	const academicIcon =
		signal === "got-it" ? (
			<Check size={32} strokeWidth={3} className="text-white" />
		) : signal === "lost" || isUrgent ? (
			<X size={32} strokeWidth={3} className="text-white" />
		) : (
			<AlertTriangle size={28} strokeWidth={2.5} className="text-white" />
		);

	const conversationStarter =
		signal === "lost" || signal === "almost"
			? `"Can you show me one problem you worked on today? I want to practice ${topic} with you."`
			: `"What's one thing you learned about ${topic} today? Teach it to me!"`;

	return (
		<div className="min-h-screen bg-[#F5F5F7]">
			<style>{`@media print { .no-print { display: none !important; } }`}</style>

			<div className="max-w-sm mx-auto px-4 pt-8 pb-10 space-y-3">
				{/* Identity */}
				<div className="pb-2">
					<p className="flex items-center gap-1.5 text-[10px] text-[#86868B] font-semibold uppercase tracking-widest mb-2">
						<span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
						Class Pulse · {cls?.label}
					</p>
					<div className="flex items-end justify-between">
						<h1 className="text-3xl font-bold text-[#1D1D1F]">{studentDisplay}</h1>
						<p className="text-xs text-[#86868B] pb-1">{dateStr}</p>
					</div>
					{studentId && <p className="text-xs text-[#86868B] mt-0.5">ID {studentId}</p>}
				</div>

				{/* Status tiles */}
				<div className="grid grid-cols-2 gap-3">
					{/* Behavior tile */}
					<div className="rounded-2xl bg-white shadow-sm border border-black/5 py-5 flex flex-col items-center gap-3">
						<div
							role="img"
							aria-label={`Behavior: ${behaviorStatus}`}
							className={`w-16 h-16 rounded-full ${behaviorColor} flex items-center justify-center shadow-sm`}
						>
							{behaviorIcon}
						</div>
						<div className="flex items-center gap-1.5">
							<ShieldAlert size={13} className="text-[#86868B] shrink-0" />
							<p className="text-sm font-semibold text-[#1D1D1F]">Behavior</p>
						</div>
					</div>
					{/* Academics tile */}
					<div className="rounded-2xl bg-white shadow-sm border border-black/5 py-5 flex flex-col items-center gap-3">
						<div
							role="img"
							aria-label={`Academics: ${academicStatus}`}
							className={`w-16 h-16 rounded-full ${academicColor} flex items-center justify-center shadow-sm`}
						>
							{academicIcon}
						</div>
						<div className="flex items-center gap-1.5">
							<GraduationCap size={13} className="text-[#86868B] shrink-0" />
							<p className="text-sm font-semibold text-[#1D1D1F]">Academics</p>
						</div>
					</div>
				</div>

				{/* Homework — only when assigned */}
				{assignmentRow?.content && (
					<div className="rounded-2xl bg-white shadow-sm border border-black/5 overflow-hidden">
						<div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
							<BookOpen size={13} className="text-violet-500 shrink-0" />
							<span className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest">
								Tonight's Homework
							</span>
						</div>
						<p className="px-4 pb-4 text-[#1D1D1F] text-lg font-semibold leading-snug">
							{assignmentRow.content}
						</p>
					</div>
				)}

				{/* Comprehension — only when student signalled */}
				{comp && (
					<div className={`rounded-2xl bg-white shadow-sm border border-black/5 px-4 py-3.5`}>
						<p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${comp.label}`}>
							How They Did Today
						</p>
						<div className="flex items-start gap-3">
							<span className="text-2xl leading-none">{comp.emoji}</span>
							<div>
								<p className="text-[#1D1D1F] font-semibold">{comp.headline}</p>
								<p className="text-sm text-[#86868B] mt-0.5">{comp.sub}</p>
							</div>
						</div>
					</div>
				)}

				{/* Teacher flag */}
				<div className="rounded-2xl bg-white shadow-sm border border-black/5 overflow-hidden">
					<div className={`flex items-center gap-2 px-4 pt-3.5 pb-1.5`}>
						{isUrgent ? (
							<Siren size={13} className="text-rose-500 shrink-0" />
						) : (
							<TriangleAlert size={13} className="text-amber-500 shrink-0" />
						)}
						<span
							className={`text-[10px] font-semibold uppercase tracking-widest ${isUrgent ? "text-rose-500" : "text-amber-500"}`}
						>
							Teacher Flag
						</span>
					</div>
					<div className="px-4 pb-4 space-y-1">
						<p className="text-[#1D1D1F] font-semibold text-lg leading-snug">
							{isUrgent ? "Struggling across multiple topics" : `Difficulty with ${topic}`}
						</p>
						<p className="text-sm text-[#86868B] leading-relaxed">
							{isUrgent
								? "A pattern across several math areas has been flagged. Extra support is recommended."
								: `Seen in ${flag.sessionCount} recent class session${flag.sessionCount !== 1 ? "s" : ""}. A little practice at home makes a big difference.`}
						</p>
						{currentTopic && (
							<p className="text-xs text-[#86868B] pt-1">
								Class is on: <span className="text-[#1D1D1F]">{currentTopic.title}</span>
							</p>
						)}
					</div>
				</div>

				{/* Actions */}
				<div className="space-y-2 pt-1">
					<p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-widest">
						What to do right now
					</p>

					<div className="grid grid-cols-2 gap-2">
						{ixlSkill && (
							<a
								href={ixlSkill.url}
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-2xl bg-white shadow-sm border border-black/5 px-3 py-3.5 flex flex-col gap-3 no-underline active:opacity-75"
							>
								<ExternalLink size={16} className="text-sky-500" />
								<div>
									<p className="text-[10px] font-semibold text-sky-500 uppercase tracking-wide">
										IXL Practice
									</p>
									<p className="text-sm font-semibold text-[#1D1D1F] leading-snug mt-0.5">
										{ixlSkill.name}
									</p>
									<p className="text-[10px] text-[#86868B] mt-1">Tap to open →</p>
								</div>
							</a>
						)}
						<a
							href={`https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(`${topic} grade 5 math`)}`}
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-2xl bg-white shadow-sm border border-black/5 px-3 py-3.5 flex flex-col gap-3 no-underline active:opacity-75"
						>
							<GraduationCap size={16} className="text-teal-500" />
							<div>
								<p className="text-[10px] font-semibold text-teal-500 uppercase tracking-wide">
									Khan Academy
								</p>
								<p className="text-sm font-semibold text-[#1D1D1F] leading-snug mt-0.5">{topic}</p>
								<p className="text-[10px] text-[#86868B] mt-1">Free · Tap to open →</p>
							</div>
						</a>
					</div>

					<div className="rounded-2xl bg-white shadow-sm border border-black/5 px-4 py-3.5">
						<div className="flex items-center gap-2 mb-2">
							<MessageCircle size={13} className="text-fuchsia-500 shrink-0" />
							<p className="text-[10px] font-semibold text-fuchsia-500 uppercase tracking-widest">
								Ask them tonight
							</p>
						</div>
						<p className="text-sm text-[#1D1D1F] leading-relaxed italic">{conversationStarter}</p>
					</div>
				</div>

				<div className="no-print pt-1">
					<PrintButton />
				</div>

				<p className="text-[10px] text-[#86868B] text-center leading-relaxed">
					Class Pulse · Initials + ID only per FERPA · Link expires in 30 days
				</p>
			</div>
		</div>
	);
}
