"use client";

import { ChevronDownIcon, ChevronUpIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { TodayResourceSection } from "@/app/api/resources/today/route";
import { cn } from "@/lib/utils";

const SECTION_META: Record<string, { label: string; color: string }> = {
	"bell-ringer": {
		label: "Bell Ringers",
		color: "text-violet-400 border-violet-700/40 bg-violet-900/20",
	},
	cfu: { label: "CFU Set", color: "text-sky-400 border-sky-700/40 bg-sky-900/20" },
	"exit-ticket": {
		label: "Exit Tickets",
		color: "text-amber-400 border-amber-700/40 bg-amber-900/20",
	},
};

function QuestionCard({
	q,
	index,
}: {
	q: TodayResourceSection["questions"][number];
	index: number;
}) {
	const [showAnswer, setShowAnswer] = useState(false);
	return (
		<div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5 space-y-1.5">
			<div className="flex items-start justify-between gap-2">
				<p className="text-xs font-semibold text-slate-300 leading-snug flex-1">
					<span className="text-slate-500 mr-1.5">#{index + 1}</span>
					{q.problem}
				</p>
				<div className="flex items-center gap-2 shrink-0 mt-0.5">
					{q.timeMinutes != null && (
						<span className="text-[10px] text-slate-500">⏱ {q.timeMinutes}m</span>
					)}
					{q.deliverAtMinute != null && (
						<span className="text-[10px] text-slate-500">@{q.deliverAtMinute}m</span>
					)}
					{q.isExitTicket && (
						<span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
							EXIT
						</span>
					)}
				</div>
			</div>
			<div className="flex items-center justify-between gap-2">
				<p className="text-[10px] text-slate-500">{q.standardCode}</p>
				<button
					type="button"
					onClick={() => setShowAnswer((v) => !v)}
					className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
				>
					{showAnswer ? (
						<>
							<EyeOffIcon className="h-3 w-3" /> Hide answer
						</>
					) : (
						<>
							<EyeIcon className="h-3 w-3" /> Reveal answer
						</>
					)}
				</button>
			</div>
			{showAnswer && (
				<div className="rounded-md bg-emerald-900/30 border border-emerald-700/40 px-2.5 py-1.5">
					<p className="text-xs font-semibold text-emerald-300">{q.answer}</p>
				</div>
			)}
		</div>
	);
}

function ResourceSection({ section }: { section: TodayResourceSection }) {
	const [open, setOpen] = useState(true);
	const meta = SECTION_META[section.resourceType] ?? {
		label: section.resourceType,
		color: "text-slate-400 border-slate-700 bg-slate-900/40",
	};

	return (
		<div className={cn("rounded-lg border", meta.color)}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center justify-between px-3 py-2.5 text-left"
			>
				<span className="text-xs font-semibold">
					{meta.label}
					<span className="ml-1.5 text-slate-500 font-normal">({section.questions.length})</span>
				</span>
				{open ? (
					<ChevronUpIcon className="h-3.5 w-3.5 text-slate-500" />
				) : (
					<ChevronDownIcon className="h-3.5 w-3.5 text-slate-500" />
				)}
			</button>
			{open && (
				<div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2">
					{section.questions.map((q, i) => (
						<QuestionCard key={`${q.standardCode}-${i}`} q={q} index={i} />
					))}
				</div>
			)}
		</div>
	);
}

export function TodaysQuestionsPanel({ date }: { date: string }) {
	const [sections, setSections] = useState<TodayResourceSection[]>([]);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		fetch(`/api/resources/today?date=${date}`)
			.then((r) => (r.ok ? r.json() : { sections: [] }))
			.then((j) => setSections(j.sections ?? []))
			.catch(() => setSections([]))
			.finally(() => setLoading(false));
	}, [date]);

	if (loading || sections.length === 0) return null;

	const totalQuestions = sections.reduce((n, s) => n + s.questions.length, 0);

	return (
		<div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
			>
				<div className="flex items-center gap-2.5">
					<span className="text-sm">📋</span>
					<span className="font-semibold text-slate-200 text-sm">Today&apos;s Questions</span>
					<span className="text-xs text-slate-500">
						{sections.length} set{sections.length !== 1 ? "s" : ""} · {totalQuestions} question
						{totalQuestions !== 1 ? "s" : ""}
					</span>
				</div>
				{open ? (
					<ChevronUpIcon className="h-4 w-4 text-slate-500" />
				) : (
					<ChevronDownIcon className="h-4 w-4 text-slate-500" />
				)}
			</button>
			{open && (
				<div className="border-t border-slate-700 px-5 py-4 space-y-3">
					{sections.map((section) => (
						<ResourceSection key={section.resourceType} section={section} />
					))}
				</div>
			)}
		</div>
	);
}
