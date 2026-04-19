"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type MasteryData = { mastered: number; working: number; total: number };
type CfuEntry = { rosterId: string; score: number; notes: string };
type CfuDay = { date: string; standardCode: string; entries: CfuEntry[] };
type PulseData = { gotIt: number; almost: number; lost: number; total: number };
export type SignalMap = Record<string, "got-it" | "almost" | "lost">;

interface Props {
	classId: string;
	activeSessionId?: string;
	onConfusionEvent?: (timestamp: number) => void;
	onSignalUpdate?: (signals: SignalMap) => void;
}

// ─── Score helpers ──────────────────────────────────────────────────────────────

const SCORE_LABEL = ["Absent", "Below", "Approaching", "Meeting", "Exceeding"] as const;
const SCORE_COLOR = [
	"bg-slate-600 text-slate-300",
	"bg-red-500/80 text-white",
	"bg-orange-500/80 text-white",
	"bg-blue-500/80 text-white",
	"bg-emerald-500/80 text-white",
] as const;
const SCORE_BAR = [
	"bg-slate-600",
	"bg-red-500",
	"bg-orange-500",
	"bg-blue-500",
	"bg-emerald-500",
] as const;

function scorePercent(score: number) {
	return score === 0 ? 0 : Math.round((score / 4) * 100);
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function PulseBar({ data }: { data: PulseData }) {
	const { gotIt, almost, lost, total } = data;
	if (total === 0) return <p className="text-xs text-slate-500 text-center py-2">No signals yet</p>;
	const pGot = Math.round((gotIt / total) * 100);
	const pAlmost = Math.round((almost / total) * 100);
	const pLost = Math.round((lost / total) * 100);
	return (
		<div className="flex flex-col gap-2">
			<div className="flex rounded-full overflow-hidden h-3">
				{pGot > 0 && (
					<div className="bg-emerald-500 transition-all" style={{ width: `${pGot}%` }} />
				)}
				{pAlmost > 0 && (
					<div className="bg-amber-400 transition-all" style={{ width: `${pAlmost}%` }} />
				)}
				{pLost > 0 && <div className="bg-red-500 transition-all" style={{ width: `${pLost}%` }} />}
			</div>
			<div className="flex items-center gap-3 text-[11px]">
				<span className="flex items-center gap-1 text-emerald-400">
					<span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
					{gotIt} got it
				</span>
				<span className="flex items-center gap-1 text-amber-300">
					<span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
					{almost} almost
				</span>
				<span className="flex items-center gap-1 text-red-400">
					<span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
					{lost} lost
				</span>
			</div>
		</div>
	);
}

function MasteryRing({ mastered, total }: { mastered: number; total: number }) {
	if (total === 0) return null;
	const pct = Math.round((mastered / total) * 100);
	const circumference = 2 * Math.PI * 20;
	const offset = circumference - (pct / 100) * circumference;
	return (
		<div className="flex items-center gap-3">
			<svg width="52" height="52" className="-rotate-90" aria-label="Mastery progress">
				<title>Mastery progress</title>
				<circle cx="26" cy="26" r="20" fill="none" stroke="#334155" strokeWidth="5" />
				<circle
					cx="26"
					cy="26"
					r="20"
					fill="none"
					stroke="#818CF8"
					strokeWidth="5"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					className="transition-all duration-700"
				/>
			</svg>
			<div>
				<p className="text-lg font-bold text-slate-100 leading-none">
					{mastered}
					<span className="text-slate-500 font-normal text-sm">/{total}</span>
				</p>
				<p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Mastered</p>
			</div>
		</div>
	);
}

function CfuScoreRow({ entry, rosterId }: { entry: CfuEntry; rosterId: string }) {
	const pct = scorePercent(entry.score);
	return (
		<div className="flex items-center gap-2">
			<span className="text-[10px] text-slate-400 w-8 shrink-0 font-mono">
				{rosterId.slice(-4)}
			</span>
			<div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
				<div
					className={cn("h-full rounded-full transition-all duration-500", SCORE_BAR[entry.score])}
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span
				className={cn(
					"text-[9px] font-bold rounded px-1 py-0.5 shrink-0",
					SCORE_COLOR[entry.score],
				)}
			>
				{entry.score === 0 ? "—" : entry.score}
			</span>
		</div>
	);
}

// inline cn to avoid extra import issues
function cn(...classes: (string | false | undefined | null)[]) {
	return classes.filter(Boolean).join(" ");
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function ComprehensionPanel({ classId, activeSessionId, onSignalUpdate }: Props) {
	const [view, setView] = useState<"live" | "past">("live");
	const [mastery, setMastery] = useState<MasteryData | null>(null);
	const [pulse, setPulse] = useState<PulseData | null>(null);
	const [cfuDays, setCfuDays] = useState<CfuDay[]>([]);
	const [cfuIdx, setCfuIdx] = useState(0);
	const [loading, setLoading] = useState(false);
	const [confusionTotal, setConfusionTotal] = useState(0);
	const [confusionStudents, setConfusionStudents] = useState(0);
	const prevLostRef = useRef<number>(0);
	const prevConfusionRef = useRef<number>(0);
	const prevGotItRef = useRef<number>(0);
	const prevAlmostRef = useRef<number>(0);

	// Fetch live mastery for active session
	const fetchMastery = useCallback(async () => {
		if (!activeSessionId) return;
		try {
			const res = await fetch(`/api/sessions/${activeSessionId}/mastery`);
			if (res.ok) setMastery(await res.json());
		} catch {
			/* noop */
		}
	}, [activeSessionId]);

	// onSignalUpdate ref — stable reference so the SSE effect doesn't re-run when the callback changes
	const onSignalUpdateRef = useRef(onSignalUpdate);
	onSignalUpdateRef.current = onSignalUpdate;

	// Fetch confusion marks for active session
	const fetchConfusion = useCallback(async () => {
		if (!activeSessionId) return;
		try {
			const res = await fetch(`/api/sessions/${activeSessionId}/confusion-mark`);
			if (res.ok) {
				const data = await res.json();
				setConfusionTotal(data.totalMarks ?? 0);
				setConfusionStudents(data.uniqueStudents ?? 0);
				if ((data.totalMarks ?? 0) > prevConfusionRef.current) {
					const delta = data.totalMarks - prevConfusionRef.current;
					toast(`📌 ${delta} confusion mark${delta > 1 ? "s" : ""} added`, {
						duration: 4000,
						style: { background: "#1c1107", border: "1px solid #d97706", color: "#fcd34d" },
					});
				}
				prevConfusionRef.current = data.totalMarks ?? 0;
			}
		} catch {
			/* noop */
		}
	}, [activeSessionId]);

	// Fetch recent CFU entries (last 7 days)
	const fetchCfu = useCallback(async () => {
		if (!classId) return;
		setLoading(true);
		try {
			const days: CfuDay[] = [];
			const today = new Date();
			for (let i = 0; i < 7; i++) {
				const d = new Date(today);
				d.setDate(d.getDate() - i);
				const dateStr = d.toISOString().slice(0, 10);
				const res = await fetch(`/api/classes/${classId}/gradebook?date=${dateStr}`);
				if (res.ok) {
					const json = await res.json();
					if (json.entries?.length > 0) {
						days.push({
							date: dateStr,
							standardCode: json.standardCode ?? "",
							entries: json.entries,
						});
					}
				}
			}
			setCfuDays(days);
		} catch {
			/* noop */
		} finally {
			setLoading(false);
		}
	}, [classId]);

	// Live: SSE for instant comprehension pulse updates
	useEffect(() => {
		if (!activeSessionId) return;
		const es = new EventSource(`/api/sessions/${activeSessionId}/comprehension-feed`);
		es.onmessage = (e) => {
			try {
				const data = JSON.parse(e.data as string) as {
					gotIt: number;
					almost: number;
					lost: number;
					total: number;
					signals: { rosterId: string; signal: string }[];
				};
				const newGotIt = data.gotIt ?? 0;
				const newAlmost = data.almost ?? 0;
				const newLost = data.lost ?? 0;
				if (newGotIt > prevGotItRef.current) {
					const delta = newGotIt - prevGotItRef.current;
					toast(`✅ ${delta} student${delta > 1 ? "s" : ""} got it`, {
						duration: 4000,
						style: { background: "#052e16", border: "1px solid #16a34a", color: "#86efac" },
					});
				}
				if (newAlmost > prevAlmostRef.current) {
					const delta = newAlmost - prevAlmostRef.current;
					toast(`🤔 ${delta} student${delta > 1 ? "s" : ""} almost there`, {
						duration: 4000,
						style: { background: "#1c1917", border: "1px solid #d97706", color: "#fcd34d" },
					});
				}
				if (newLost > prevLostRef.current) {
					const delta = newLost - prevLostRef.current;
					toast(`🙋 ${delta} student${delta > 1 ? "s" : ""} need${delta === 1 ? "s" : ""} help`, {
						duration: 6000,
						style: { background: "#1e1b4b", border: "1px solid #6d28d9", color: "#c4b5fd" },
					});
				}
				prevGotItRef.current = newGotIt;
				prevAlmostRef.current = newAlmost;
				prevLostRef.current = newLost;
				setPulse({ gotIt: newGotIt, almost: newAlmost, lost: newLost, total: data.total });
				// Build per-student signal map and propagate up
				const map: SignalMap = {};
				for (const s of data.signals) {
					map[s.rosterId] = s.signal as "got-it" | "almost" | "lost";
				}
				onSignalUpdateRef.current?.(map);
			} catch {
				/* ignore malformed event */
			}
		};
		return () => es.close();
	}, [activeSessionId]);

	// Live: poll mastery + confusion every 10s
	useEffect(() => {
		if (!activeSessionId) return;
		fetchMastery();
		fetchConfusion();
		const id = setInterval(() => {
			fetchMastery();
			fetchConfusion();
		}, 10_000);
		return () => clearInterval(id);
	}, [activeSessionId, fetchMastery, fetchConfusion]);

	useEffect(() => {
		fetchCfu();
	}, [fetchCfu]);

	const currentCfu = cfuDays[cfuIdx];
	const hasLive = !!activeSessionId;

	return (
		<div className="flex flex-col gap-4">
			{/* Header + toggle */}
			<div className="flex items-center justify-between">
				<h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
					Student Understanding
				</h2>
				<div className="flex rounded-lg overflow-hidden border border-slate-700 text-[11px] font-semibold">
					<button
						type="button"
						onClick={() => setView("live")}
						className={cn(
							"px-3 py-1.5 transition-colors",
							view === "live"
								? "bg-indigo-600 text-white"
								: "bg-slate-800 text-slate-400 hover:text-slate-200",
						)}
					>
						Live
					</button>
					<button
						type="button"
						onClick={() => setView("past")}
						className={cn(
							"px-3 py-1.5 transition-colors",
							view === "past"
								? "bg-indigo-600 text-white"
								: "bg-slate-800 text-slate-400 hover:text-slate-200",
						)}
					>
						History
					</button>
				</div>
			</div>

			{view === "live" ? (
				<div className="flex flex-col gap-4">
					{!hasLive ? (
						<p className="text-xs text-slate-500 text-center py-4">
							Start a session to see live data
						</p>
					) : (
						<>
							{/* Comprehension pulse */}
							<div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 flex flex-col gap-2">
								<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
									Comprehension Pulse
								</p>
								{pulse ? (
									<PulseBar data={pulse} />
								) : (
									<p className="text-xs text-slate-500">Waiting for signals…</p>
								)}
							</div>

							{/* Mastery */}
							<div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3">
								<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
									Mastery Loop
								</p>
								{mastery ? (
									<MasteryRing mastered={mastery.mastered} total={mastery.total} />
								) : (
									<p className="text-xs text-slate-500">No check questions yet</p>
								)}
							</div>

							{/* Confusion marks */}
							{confusionTotal > 0 && (
								<div className="rounded-xl bg-amber-500/8 border border-amber-500/25 p-3 flex items-center gap-3">
									<span className="text-xl">📌</span>
									<div>
										<p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70">
											Confusion Marks
										</p>
										<p className="text-sm font-bold text-amber-300 leading-tight">
											{confusionTotal} tap{confusionTotal !== 1 ? "s" : ""}
											<span className="text-amber-500/60 font-normal text-xs ml-1">
												from {confusionStudents} student{confusionStudents !== 1 ? "s" : ""}
											</span>
										</p>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{loading && <p className="text-xs text-slate-500 text-center py-2">Loading…</p>}
					{!loading && cfuDays.length === 0 && (
						<p className="text-xs text-slate-500 text-center py-4">
							No CFU entries in the last 7 days
						</p>
					)}
					{cfuDays.length > 0 && (
						<>
							{/* Date tabs */}
							<div className="flex gap-1.5 flex-wrap">
								{cfuDays.map((day, i) => (
									<button
										key={day.date}
										type="button"
										onClick={() => setCfuIdx(i)}
										className={cn(
											"rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors",
											cfuIdx === i
												? "bg-indigo-600 text-white"
												: "bg-slate-800 text-slate-400 hover:bg-slate-700",
										)}
									>
										{day.date.slice(5)}
										{day.standardCode ? ` · ${day.standardCode}` : ""}
									</button>
								))}
							</div>

							{/* Score bars */}
							{currentCfu && (
								<div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 flex flex-col gap-2">
									<div className="flex items-center justify-between mb-1">
										<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
											{currentCfu.standardCode || currentCfu.date}
										</p>
										<div className="flex gap-1.5 text-[9px]">
											{([1, 2, 3, 4] as const).map((s) => (
												<span
													key={s}
													className={cn("rounded px-1 py-0.5 font-bold", SCORE_COLOR[s])}
												>
													{SCORE_LABEL[s][0]}
												</span>
											))}
										</div>
									</div>
									<div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
										{currentCfu.entries.map((e) => (
											<CfuScoreRow key={e.rosterId} entry={e} rosterId={e.rosterId} />
										))}
									</div>
									{/* Class average */}
									{(() => {
										const scored = currentCfu.entries.filter((e) => e.score > 0);
										if (scored.length === 0) return null;
										const avg = scored.reduce((sum, e) => sum + e.score, 0) / scored.length;
										return (
											<p className="text-[10px] text-slate-400 border-t border-slate-700 pt-2 mt-1">
												Class avg <span className="font-bold text-slate-200">{avg.toFixed(1)}</span>
												/4 · {scored.length} students
											</p>
										);
									})()}
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
