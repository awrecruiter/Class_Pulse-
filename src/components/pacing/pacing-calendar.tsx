"use client";

import {
	AlertTriangle,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	LayoutGrid,
	Lock,
	RotateCcw,
	Unlock,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CalendarDay, CascadeMode, LessonRef, PlacedLesson } from "@/lib/pacing-calendar";
import { cn } from "@/lib/utils";

// ─── Topic color map ─────────────────────────────────────────────────────────
// Complete strings so Tailwind JIT scans them
const TOPIC_BG: Record<string, string> = {
	blue: "bg-blue-500/20 border-blue-500/40 text-blue-300",
	emerald: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
	violet: "bg-violet-500/20 border-violet-500/40 text-violet-300",
	amber: "bg-amber-500/20 border-amber-500/40 text-amber-300",
	rose: "bg-rose-500/20 border-rose-500/40 text-rose-300",
	cyan: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
	orange: "bg-orange-500/20 border-orange-500/40 text-orange-300",
	teal: "bg-teal-500/20 border-teal-500/40 text-teal-300",
	fuchsia: "bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300",
	lime: "bg-lime-500/20 border-lime-500/40 text-lime-300",
	sky: "bg-sky-500/20 border-sky-500/40 text-sky-300",
	red: "bg-red-500/20 border-red-500/40 text-red-300",
	indigo: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300",
	yellow: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
	pink: "bg-pink-500/20 border-pink-500/40 text-pink-300",
	green: "bg-green-500/20 border-green-500/40 text-green-300",
	purple: "bg-purple-500/20 border-purple-500/40 text-purple-300",
	slate: "bg-slate-500/20 border-slate-500/40 text-slate-300",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function parseLocal(s: string): Date {
	const [y, m, d] = s.split("-").map(Number);
	return new Date(y ?? 2025, (m ?? 1) - 1, d ?? 1);
}

function addMonths(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function rangeForMonth(year: number, month: number): { start: string; end: string } {
	const first = new Date(year, month, 1);
	const last = new Date(year, month + 1, 0);
	return { start: formatDate(first), end: formatDate(last) };
}

function rangeForWeek(anchor: Date): { start: string; end: string } {
	const dow = anchor.getDay();
	const monday = new Date(anchor);
	monday.setDate(anchor.getDate() - ((dow + 6) % 7));
	const friday = new Date(monday);
	friday.setDate(monday.getDate() + 4);
	return { start: formatDate(monday), end: formatDate(friday) };
}

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// ─── Lesson chip ─────────────────────────────────────────────────────────────

function LessonChip({
	lesson,
	compact,
	selected,
	onSelect,
	draggable,
}: {
	lesson: PlacedLesson;
	compact?: boolean;
	selected?: boolean;
	onSelect?: (lesson: PlacedLesson, multi: boolean) => void;
	draggable?: boolean;
}) {
	const cls = TOPIC_BG[lesson.topicColor] ?? TOPIC_BG.slate;
	return (
		<div
			className={cn(
				"rounded border px-1 py-0.5 cursor-pointer select-none transition-opacity",
				cls,
				selected && "ring-2 ring-white/50",
				draggable && "cursor-grab active:cursor-grabbing",
				compact ? "text-[9px] leading-tight" : "text-[10px] leading-tight",
			)}
			role="button"
			tabIndex={0}
			onClick={(e) => onSelect?.(lesson, e.metaKey || e.ctrlKey || e.shiftKey)}
			onKeyDown={(e) => e.key === "Enter" && onSelect?.(lesson, false)}
			title={`${lesson.topicRoman}.${lesson.lessonNumber} — ${lesson.lessonTitle}`}
		>
			<span className="font-bold">{lesson.lessonNumber}</span>
			{!compact && <span className="ml-1 opacity-80 truncate">{lesson.lessonTitle}</span>}
		</div>
	);
}

// ─── Conflict modal ───────────────────────────────────────────────────────────

function ConflictModal({
	rescheduledCount,
	onResolve,
	onCancel,
}: {
	rescheduledCount: number;
	onResolve: (mode: CascadeMode) => void;
	onCancel: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
				<div className="flex items-center gap-2 mb-3">
					<AlertTriangle className="size-5 text-amber-400 shrink-0" />
					<p className="font-semibold text-slate-100">Scheduling Conflict</p>
				</div>
				<p className="text-sm text-slate-400 mb-5">
					You are rescheduling{" "}
					<span className="font-semibold text-slate-200">
						{rescheduledCount} lesson{rescheduledCount !== 1 ? "s" : ""}
					</span>
					. How should conflicts be handled?
				</p>

				<div className="flex flex-col gap-2">
					<button
						type="button"
						onClick={() => onResolve("stack")}
						className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-3 text-left transition-colors"
					>
						<p className="text-sm font-semibold text-slate-100">Stack lessons</p>
						<p className="text-xs text-slate-400 mt-0.5">Teach multiple lessons on the same day</p>
					</button>

					<button
						type="button"
						onClick={() => onResolve("push_forward")}
						className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-3 text-left transition-colors"
					>
						<p className="text-sm font-semibold text-slate-100">Push forward</p>
						<p className="text-xs text-slate-400 mt-0.5">Displaced lessons move to later dates</p>
					</button>

					<button
						type="button"
						onClick={() => onResolve("push_back")}
						className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-3 text-left transition-colors"
					>
						<p className="text-sm font-semibold text-slate-100">Push back</p>
						<p className="text-xs text-slate-400 mt-0.5">
							Dropped lessons move after the displaced block
						</p>
					</button>
				</div>

				<button
					type="button"
					onClick={onCancel}
					className="mt-4 w-full text-sm text-slate-500 hover:text-slate-300 transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

// ─── Monthly grid ────────────────────────────────────────────────────────────

function MonthView({
	year,
	month,
	days,
	selected,
	blockMode,
	onCellClick,
	onLessonSelect,
	onDrop,
}: {
	year: number;
	month: number;
	days: CalendarDay[];
	selected: Set<string>; // "topic|lesson" keys
	blockMode: boolean;
	onCellClick: (date: string) => void;
	onLessonSelect: (lesson: PlacedLesson, multi: boolean) => void;
	onDrop: (targetDate: string) => void;
}) {
	const dayMap = new Map(days.map((d) => [d.date, d]));

	// Grid: pad from Monday of the week containing the 1st of the month
	const firstDay = new Date(year, month, 1);
	const startDow = firstDay.getDay(); // 0=Sun
	const padStart = (startDow + 6) % 7; // days to pad before Mon
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	// Build cells: padded blanks + Mon–Fri days only
	const cells: Array<{ date: string | null; day: CalendarDay | null }> = [];

	// Pad leading blanks (only Mon–Fri matter)
	for (let i = 0; i < padStart && i < 5; i++) {
		cells.push({ date: null, day: null });
	}

	for (let d = 1; d <= daysInMonth; d++) {
		const date = new Date(year, month, d);
		const dow = date.getDay();
		if (dow === 0 || dow === 6) continue; // skip weekends
		const ds = formatDate(date);
		cells.push({ date: ds, day: dayMap.get(ds) ?? null });
	}

	// Chunk into weeks of 5
	const weeks: Array<Array<{ date: string | null; day: CalendarDay | null }>> = [];
	for (let i = 0; i < cells.length; i += 5) {
		weeks.push(cells.slice(i, i + 5));
	}

	const [dragOver, setDragOver] = useState<string | null>(null);

	return (
		<div className="flex flex-col gap-px">
			{/* Day headers */}
			<div className="grid grid-cols-5 gap-px mb-1">
				{DAY_LABELS.map((l) => (
					<div
						key={l}
						className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center py-1"
					>
						{l}
					</div>
				))}
			</div>

			{weeks.map((week, wi) => (
				<div key={`week-${wi}`} className="grid grid-cols-5 gap-px">
					{week.map((cell, ci) => {
						if (!cell.date) {
							return <div key={`blank-${wi}-${ci}`} className="h-20 rounded bg-slate-900/30" />;
						}

						const cd = cell.day;
						const isToday = cd?.isToday;
						const isBlocked = cd?.isBlocked;
						const isFast = cd?.isFastWindow;
						const lessons = cd?.lessons ?? [];
						const isDragOver = dragOver === cell.date;

						return (
							<div
								key={cell.date}
								role={blockMode ? "button" : undefined}
								tabIndex={blockMode ? 0 : undefined}
								className={cn(
									"h-20 rounded p-1 flex flex-col gap-0.5 overflow-hidden transition-colors",
									"bg-slate-900/60 border border-slate-800",
									isToday && "border-indigo-500/60 bg-indigo-950/30",
									isBlocked && "bg-red-950/20 border-red-900/40",
									isFast && !isBlocked && "border-amber-700/30 bg-amber-950/10",
									blockMode && !isBlocked && "cursor-pointer hover:bg-red-950/20",
									blockMode && isBlocked && "cursor-pointer hover:bg-slate-900/60",
									isDragOver && "ring-2 ring-indigo-400/50 bg-indigo-950/20",
								)}
								onClick={() => blockMode && cell.date && onCellClick(cell.date)}
								onKeyDown={(e) =>
									e.key === "Enter" && blockMode && cell.date && onCellClick(cell.date)
								}
								onDragOver={(e) => {
									e.preventDefault();
									setDragOver(cell.date);
								}}
								onDragLeave={() => setDragOver(null)}
								onDrop={(e) => {
									e.preventDefault();
									setDragOver(null);
									if (cell.date) onDrop(cell.date);
								}}
							>
								{/* Date number row */}
								<div className="flex items-center justify-between shrink-0">
									<span
										className={cn(
											"text-[10px] font-bold",
											isToday ? "text-indigo-400" : "text-slate-500",
										)}
									>
										{parseLocal(cell.date).getDate()}
									</span>
									{isBlocked && <Lock className="size-2.5 text-red-400/70" />}
									{isFast && !isBlocked && (
										<span className="text-[8px] text-amber-400 font-bold">FAST</span>
									)}
								</div>

								{/* Lesson chips — compact mode */}
								{!isBlocked &&
									lessons
										.slice(0, 3)
										.map((l) => (
											<LessonChip
												key={`${l.topicNumber}|${l.lessonNumber}`}
												lesson={l}
												compact
												selected={selected.has(`${l.topicNumber}|${l.lessonNumber}`)}
												onSelect={onLessonSelect}
												draggable
											/>
										))}
								{!isBlocked && lessons.length > 3 && (
									<span className="text-[8px] text-slate-500">+{lessons.length - 3} more</span>
								)}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
}

// ─── Weekly detail view ──────────────────────────────────────────────────────

function WeekView({
	anchor,
	days,
	selected,
	blockMode,
	onCellClick,
	onLessonSelect,
	onDrop,
}: {
	anchor: Date;
	days: CalendarDay[];
	selected: Set<string>;
	blockMode: boolean;
	onCellClick: (date: string) => void;
	onLessonSelect: (lesson: PlacedLesson, multi: boolean) => void;
	onDrop: (targetDate: string) => void;
}) {
	const dayMap = new Map(days.map((d) => [d.date, d]));
	const [dragOver, setDragOver] = useState<string | null>(null);

	// Get Mon–Fri for this week
	const dow = anchor.getDay();
	const monday = new Date(anchor);
	monday.setDate(anchor.getDate() - ((dow + 6) % 7));

	const weekDays = Array.from({ length: 5 }, (_, i) => {
		const d = new Date(monday);
		d.setDate(monday.getDate() + i);
		return d;
	});

	return (
		<div className="flex flex-col gap-2">
			<div className="grid grid-cols-5 gap-2">
				{weekDays.map((wd, i) => {
					const ds = formatDate(wd);
					const cd = dayMap.get(ds);
					const isToday = cd?.isToday;
					const isBlocked = cd?.isBlocked;
					const isFast = cd?.isFastWindow;
					const lessons = cd?.lessons ?? [];
					const isDragOver = dragOver === ds;

					return (
						<div key={ds} className="flex flex-col gap-1">
							{/* Day header */}
							<div
								className={cn(
									"text-center py-1.5 rounded-lg",
									isToday ? "bg-indigo-600/20" : "bg-slate-800/60",
								)}
							>
								<p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
									{DAY_LABELS[i]}
								</p>
								<p
									className={cn(
										"text-lg font-bold",
										isToday ? "text-indigo-400" : "text-slate-300",
									)}
								>
									{wd.getDate()}
								</p>
								{isBlocked && <p className="text-[9px] text-red-400">Blocked</p>}
								{isFast && !isBlocked && (
									<p className="text-[9px] text-amber-400 font-bold">FAST</p>
								)}
							</div>

							{/* Drop zone */}
							<div
								role={blockMode ? "button" : undefined}
								tabIndex={blockMode ? 0 : undefined}
								className={cn(
									"min-h-24 rounded-xl border border-slate-800 p-1.5 flex flex-col gap-1 transition-colors",
									isBlocked ? "bg-red-950/10" : "bg-slate-900/40",
									blockMode && "cursor-pointer hover:bg-red-950/20",
									isDragOver && "ring-2 ring-indigo-400/50 bg-indigo-950/20",
								)}
								onClick={() => blockMode && onCellClick(ds)}
								onKeyDown={(e) => e.key === "Enter" && blockMode && onCellClick(ds)}
								onDragOver={(e) => {
									e.preventDefault();
									setDragOver(ds);
								}}
								onDragLeave={() => setDragOver(null)}
								onDrop={(e) => {
									e.preventDefault();
									setDragOver(null);
									onDrop(ds);
								}}
							>
								{!isBlocked &&
									lessons.map((l) => (
										<div
											key={`${l.topicNumber}|${l.lessonNumber}`}
											role="button"
											tabIndex={0}
											draggable
											onKeyDown={() => {}}
											onDragStart={(e) => {
												e.dataTransfer.setData(
													"application/json",
													JSON.stringify({
														topicNumber: l.topicNumber,
														lessonNumber: l.lessonNumber,
													}),
												);
											}}
										>
											<LessonChip
												lesson={l}
												selected={selected.has(`${l.topicNumber}|${l.lessonNumber}`)}
												onSelect={onLessonSelect}
												draggable
											/>
										</div>
									))}
								{isBlocked && (
									<div className="flex items-center gap-1 mt-2">
										<Lock className="size-3 text-red-400/50" />
										<span className="text-[10px] text-red-400/50">
											{cd?.blockReason ?? "Blocked"}
										</span>
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

type ViewMode = "month" | "week";
type ToolMode = "select" | "block";

export function PacingCalendar() {
	const today = new Date();
	const [viewMode, setViewMode] = useState<ViewMode>("month");
	const [toolMode, setToolMode] = useState<ToolMode>("select");
	const [anchor, setAnchor] = useState(today);
	const [days, setDays] = useState<CalendarDay[]>([]);
	const [loading, setLoading] = useState(true);
	const [selected, setSelected] = useState<Set<string>>(new Set()); // "topic|lesson" keys
	const [pendingDrop, setPendingDrop] = useState<{
		targetDate: string;
		rescheduledCount: number;
	} | null>(null);
	const dragRef = useRef<LessonRef[]>([]);

	const year = anchor.getFullYear();
	const month = anchor.getMonth();

	const { start, end } = viewMode === "month" ? rangeForMonth(year, month) : rangeForWeek(anchor);

	const fetchDays = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/pacing/calendar?start=${start}&end=${end}`);
			if (!res.ok) throw new Error("Failed to load");
			const json = (await res.json()) as { days: CalendarDay[] };
			setDays(json.days);
		} catch {
			toast.error("Failed to load pacing calendar");
		} finally {
			setLoading(false);
		}
	}, [start, end]);

	useEffect(() => {
		void fetchDays();
	}, [fetchDays]);

	function handleLessonSelect(lesson: PlacedLesson, multi: boolean) {
		if (toolMode !== "select") return;
		const key = `${lesson.topicNumber}|${lesson.lessonNumber}`;
		setSelected((prev) => {
			const next = new Set(prev);
			if (multi) {
				if (next.has(key)) next.delete(key);
				else next.add(key);
			} else {
				if (next.has(key) && next.size === 1) next.clear();
				else {
					next.clear();
					next.add(key);
				}
			}
			return next;
		});
	}

	async function handleCellClick(date: string) {
		if (toolMode !== "block") return;
		const day = days.find((d) => d.date === date);
		try {
			if (day?.isBlocked) {
				await fetch(`/api/pacing/blocked-days?date=${date}`, { method: "DELETE" });
			} else {
				await fetch("/api/pacing/blocked-days", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ date }),
				});
			}
			await fetchDays();
		} catch {
			toast.error("Failed to update blocked day");
		}
	}

	function handleDrop(targetDate: string) {
		// Determine which lessons to drag: selected set OR the single dragged lesson
		const dragging: LessonRef[] =
			selected.size > 0
				? [...selected].map((key) => {
						const [t, l] = key.split("|");
						return { topicNumber: Number(t), lessonNumber: l ?? "" };
					})
				: dragRef.current;

		if (dragging.length === 0) return;

		// Check conflict count from current days
		const targetDay = days.find((d) => d.date === targetDate);
		const existingOnTarget = (targetDay?.lessons ?? []).filter(
			(l) =>
				!dragging.some((d) => d.topicNumber === l.topicNumber && d.lessonNumber === l.lessonNumber),
		);

		const rescheduledCount = dragging.length + existingOnTarget.length;

		if (existingOnTarget.length > 0) {
			// Show conflict modal
			dragRef.current = dragging;
			setPendingDrop({ targetDate, rescheduledCount });
		} else {
			void commitDrop(dragging, targetDate, "push_forward");
		}
	}

	async function commitDrop(lessons: LessonRef[], targetDate: string, cascadeMode: CascadeMode) {
		setPendingDrop(null);
		try {
			const res = await fetch("/api/pacing/placements", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ lessons, targetDate, cascadeMode, viewStart: start, viewEnd: end }),
			});
			if (!res.ok) throw new Error("Failed");
			const json = (await res.json()) as { days: CalendarDay[]; rescheduledCount: number };
			setDays(json.days);
			setSelected(new Set());
			toast.success(
				`Rescheduled ${json.rescheduledCount} lesson${json.rescheduledCount !== 1 ? "s" : ""}`,
			);
		} catch {
			toast.error("Failed to save placement");
		}
	}

	async function handleResetPlacements() {
		try {
			await fetch("/api/pacing/placements", { method: "DELETE" });
			await fetchDays();
			toast.success("Placements reset to YAAG schedule");
		} catch {
			toast.error("Failed to reset");
		}
	}

	// Navigation labels
	const navLabel =
		viewMode === "month"
			? `${MONTH_NAMES[month]} ${year}`
			: (() => {
					const { start: ws, end: we } = rangeForWeek(anchor);
					const s = parseLocal(ws);
					const e = parseLocal(we);
					return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
				})();

	function navigate(dir: -1 | 1) {
		if (viewMode === "month") {
			setAnchor((prev) => addMonths(prev, dir));
		} else {
			setAnchor((prev) => {
				const d = new Date(prev);
				d.setDate(d.getDate() + dir * 7);
				return d;
			});
		}
	}

	const hasExplicitPlacements = days.some((d) => d.lessons.some((l) => l.isExplicit));

	return (
		<div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-slate-950 text-slate-100">
			{/* Top bar */}
			<div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
					>
						<ChevronLeft className="size-4 text-slate-400" />
					</button>
					<span className="text-sm font-semibold text-slate-200 w-52 text-center">{navLabel}</span>
					<button
						type="button"
						onClick={() => navigate(1)}
						className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
					>
						<ChevronRight className="size-4 text-slate-400" />
					</button>
					<button
						type="button"
						onClick={() => setAnchor(today)}
						className="ml-1 px-2 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
					>
						Today
					</button>
				</div>

				{/* Tool mode */}
				<div className="flex items-center gap-1 rounded-xl bg-slate-800/60 p-1">
					<button
						type="button"
						onClick={() => setToolMode("select")}
						className={cn(
							"px-3 py-1 rounded-lg text-xs font-medium transition-colors",
							toolMode === "select"
								? "bg-indigo-600 text-white"
								: "text-slate-400 hover:text-slate-200",
						)}
					>
						Move
					</button>
					<button
						type="button"
						onClick={() => setToolMode("block")}
						className={cn(
							"flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors",
							toolMode === "block"
								? "bg-red-700/60 text-red-200"
								: "text-slate-400 hover:text-slate-200",
						)}
					>
						{toolMode === "block" ? <Lock className="size-3" /> : <Unlock className="size-3" />}
						Block
					</button>
				</div>

				{/* View toggle + reset */}
				<div className="flex items-center gap-2">
					{hasExplicitPlacements && (
						<button
							type="button"
							onClick={() => void handleResetPlacements()}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-amber-400 hover:bg-amber-950/30 transition-colors border border-amber-700/40"
						>
							<RotateCcw className="size-3" />
							Reset to YAAG
						</button>
					)}
					<div className="flex items-center gap-1 rounded-xl bg-slate-800/60 p-1">
						<button
							type="button"
							onClick={() => setViewMode("month")}
							className={cn(
								"p-1.5 rounded-lg transition-colors",
								viewMode === "month"
									? "bg-slate-700 text-slate-100"
									: "text-slate-500 hover:text-slate-300",
							)}
							title="Monthly overview"
						>
							<LayoutGrid className="size-4" />
						</button>
						<button
							type="button"
							onClick={() => setViewMode("week")}
							className={cn(
								"p-1.5 rounded-lg transition-colors",
								viewMode === "week"
									? "bg-slate-700 text-slate-100"
									: "text-slate-500 hover:text-slate-300",
							)}
							title="Weekly detail"
						>
							<CalendarDays className="size-4" />
						</button>
					</div>
				</div>
			</div>

			{/* Selection bar */}
			{selected.size > 0 && (
				<div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-indigo-950/40 border-b border-indigo-800/30">
					<span className="text-xs text-indigo-300 font-medium">
						{selected.size} lesson{selected.size !== 1 ? "s" : ""} selected — drag to reschedule
					</span>
					<button
						type="button"
						onClick={() => setSelected(new Set())}
						className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors"
					>
						Clear
					</button>
				</div>
			)}

			{/* Calendar body */}
			<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
				{loading ? (
					<div className="flex items-center justify-center h-48 text-slate-500 text-sm">
						Loading...
					</div>
				) : viewMode === "month" ? (
					<MonthView
						year={year}
						month={month}
						days={days}
						selected={selected}
						blockMode={toolMode === "block"}
						onCellClick={handleCellClick}
						onLessonSelect={handleLessonSelect}
						onDrop={handleDrop}
					/>
				) : (
					<WeekView
						anchor={anchor}
						days={days}
						selected={selected}
						blockMode={toolMode === "block"}
						onCellClick={handleCellClick}
						onLessonSelect={handleLessonSelect}
						onDrop={handleDrop}
					/>
				)}
			</div>

			{/* FAST legend */}
			<div className="shrink-0 flex items-center gap-4 px-4 py-2 border-t border-slate-800 text-[9px] text-slate-600">
				<span className="flex items-center gap-1">
					<span className="size-2 rounded-sm bg-indigo-500 inline-block" /> Today
				</span>
				<span className="flex items-center gap-1">
					<span className="size-2 rounded-sm bg-amber-700/50 inline-block" /> FAST Window (May 1–29)
				</span>
				<span className="flex items-center gap-1">
					<span className="size-2 rounded-sm bg-red-900/50 inline-block" /> Blocked day
				</span>
				{hasExplicitPlacements && (
					<span className="text-amber-500/70">✦ Calendar has custom placements</span>
				)}
			</div>

			{/* Conflict modal */}
			{pendingDrop && (
				<ConflictModal
					rescheduledCount={pendingDrop.rescheduledCount}
					onResolve={(mode) => void commitDrop(dragRef.current, pendingDrop.targetDate, mode)}
					onCancel={() => setPendingDrop(null)}
				/>
			)}
		</div>
	);
}
