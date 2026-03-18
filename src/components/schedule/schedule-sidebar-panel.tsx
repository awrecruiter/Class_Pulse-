"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ScheduleDocLink } from "@/hooks/use-schedule-today";
import { useScheduleToday } from "@/hooks/use-schedule-today";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 130; // px per hour — zoomed in
const VIEWPORT_HOURS = 2; // visible hours at a time
const GRID_START = 7 * 60; // 7 AM
const GRID_END = 18 * 60; // 6 PM
const TOTAL_HOURS = (GRID_END - GRID_START) / 60;

// ─── Color map (solid, vivid — matches iPhone Calendar) ───────────────────────

// Glow/border color (vivid)
const COLOR_SOLID: Record<string, string> = {
	blue: "#3b82f6",
	indigo: "#6366f1",
	violet: "#8b5cf6",
	purple: "#a855f7",
	green: "#22c55e",
	emerald: "#10b981",
	teal: "#14b8a6",
	cyan: "#06b6d4",
	sky: "#0ea5e9",
	red: "#ef4444",
	orange: "#f97316",
	amber: "#f59e0b",
	yellow: "#eab308",
	pink: "#ec4899",
	rose: "#f43f5e",
	slate: "#94a3b8",
};

// Light text color for dark backgrounds (pastel/bright variant)
const COLOR_TEXT: Record<string, string> = {
	blue: "#93c5fd",
	indigo: "#a5b4fc",
	violet: "#c4b5fd",
	purple: "#d8b4fe",
	green: "#86efac",
	emerald: "#6ee7b7",
	teal: "#5eead4",
	cyan: "#67e8f9",
	sky: "#7dd3fc",
	red: "#fca5a5",
	orange: "#fdba74",
	amber: "#fcd34d",
	yellow: "#fde68a",
	pink: "#f9a8d4",
	rose: "#fda4af",
	slate: "#cbd5e1",
};

function resolveColor(color: string): string {
	return COLOR_SOLID[color] ?? COLOR_SOLID.blue;
}

function resolveTextColor(color: string): string {
	return COLOR_TEXT[color] ?? COLOR_TEXT.blue;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
	const [h, m] = hhmm.split(":").map(Number);
	return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToPx(minutes: number): number {
	return ((minutes - GRID_START) / 60) * HOUR_HEIGHT;
}

function formatHourLabel(hour: number): string {
	if (hour === 0) return "12 AM";
	if (hour < 12) return `${hour} AM`;
	if (hour === 12) return "12 PM";
	return `${hour - 12} PM`;
}

function formatTime(t: string): string {
	const [h, m] = t.split(":").map(Number);
	if (Number.isNaN(h)) return t;
	const ampm = h >= 12 ? "PM" : "AM";
	const hour = h % 12 || 12;
	return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextWeekday(from: Date): Date {
	const d = new Date(from);
	d.setDate(d.getDate() + 1);
	while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
	return d;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleSidebarPanel({ onShowDiGroups }: { onShowDiGroups?: () => void }) {
	const { blocks, loading } = useScheduleToday();
	const [scheduleDocOpenMode, setScheduleDocOpenMode] = useState<"toast" | "new-tab">("toast");
	const scrollRef = useRef<HTMLDivElement>(null);
	const [tomorrowBlocks, setTomorrowBlocks] = useState<typeof blocks>([]);
	const [tomorrowLoading, setTomorrowLoading] = useState(false);

	const [nowMinutes, setNowMinutes] = useState(() => {
		const d = new Date();
		return d.getHours() * 60 + d.getMinutes();
	});

	useEffect(() => {
		const t = setInterval(() => {
			const d = new Date();
			setNowMinutes(d.getHours() * 60 + d.getMinutes());
		}, 60_000);
		return () => clearInterval(t);
	}, []);

	// Determine if the school day is over (past last block or past 3 PM)
	const lastBlockEnd =
		blocks.length > 0
			? Math.max(
					...blocks.map((b) => {
						const [h, m] = b.endTime.split(":").map(Number);
						return h * 60 + m;
					}),
				)
			: GRID_END;
	const dayIsOver = !loading && nowMinutes >= Math.min(lastBlockEnd, GRID_END);

	// Fetch tomorrow's schedule when today is over
	useEffect(() => {
		if (!dayIsOver) return;
		const tomorrow = nextWeekday(new Date());
		const day = tomorrow.getDay();
		const date = tomorrow.toISOString().slice(0, 10);
		setTomorrowLoading(true);
		fetch(`/api/schedule?day=${day}&date=${date}`)
			.then((r) => (r.ok ? r.json() : { blocks: [] }))
			.then((j) => setTomorrowBlocks(j.blocks ?? []))
			.catch(() => {})
			.finally(() => setTomorrowLoading(false));
	}, [dayIsOver]); // eslint-disable-line react-hooks/exhaustive-deps

	const showingBlocks = dayIsOver ? tomorrowBlocks : blocks;
	const showingLoading = dayIsOver ? tomorrowLoading : loading;
	const label = dayIsOver ? "Tomorrow" : "Today";

	// Auto-scroll: today → current time centered in viewport; tomorrow → top
	// Runs when blocks load or day flips — viewStart is derived from showingBlocks
	const didScrollRef = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional ref reset on day change
	useEffect(() => {
		didScrollRef.current = false;
	}, [dayIsOver]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll-once on block load
	useEffect(() => {
		if (!scrollRef.current || didScrollRef.current) return;
		if (showingBlocks.length === 0) return;
		didScrollRef.current = true;
		if (dayIsOver) {
			scrollRef.current.scrollTop = 0;
		} else {
			const blockStarts = showingBlocks.map((b) => timeToMinutes(b.startTime));
			const vs = Math.max(GRID_START, Math.min(...blockStarts) - 30);
			const viewport = VIEWPORT_HOURS * HOUR_HEIGHT;
			const nowY = ((nowMinutes - vs) / 60) * HOUR_HEIGHT;
			scrollRef.current.scrollTop = Math.max(0, nowY - viewport / 2);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showingBlocks, dayIsOver]);

	useEffect(() => {
		fetch("/api/teacher-settings")
			.then((r) => (r.ok ? r.json() : { settings: {} }))
			.then((j) => {
				if (j.settings?.scheduleDocOpenMode)
					setScheduleDocOpenMode(j.settings.scheduleDocOpenMode as "toast" | "new-tab");
			})
			.catch(() => {});
	}, []);

	function handleDocTap(doc: ScheduleDocLink) {
		if (scheduleDocOpenMode === "new-tab") {
			if (doc.linkType === "internal") window.location.href = doc.url;
			else window.open(doc.url, "_blank");
		} else {
			if (doc.linkType === "internal") {
				toast.success(`Go to ${doc.label}?`, {
					duration: 8000,
					action: {
						label: "Go",
						onClick: () => {
							window.location.href = doc.url;
						},
					},
				});
			} else {
				toast.success(`Open ${doc.label}?`, {
					duration: 8000,
					action: { label: "Open", onClick: () => window.open(doc.url, "_blank") },
				});
			}
		}
	}

	if (showingLoading) {
		return (
			<div className="flex flex-col gap-1.5 px-4 py-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="h-10 rounded-lg bg-slate-800/40 animate-pulse" />
				))}
			</div>
		);
	}

	// Trim grid to actual block range ± 30 min padding
	const blockStartMins = showingBlocks.map((b) => timeToMinutes(b.startTime));
	const blockEndMins = showingBlocks.map((b) => timeToMinutes(b.endTime));
	const viewStart = showingBlocks.length > 0 ? Math.min(...blockStartMins) : GRID_START;
	const viewEnd =
		showingBlocks.length > 0 ? Math.min(GRID_END, Math.max(...blockEndMins) + 30) : GRID_END;
	const viewHours = (viewEnd - viewStart) / 60;
	const toY = (mins: number) => ((mins - viewStart) / 60) * HOUR_HEIGHT;

	const showNowLine = !dayIsOver && nowMinutes >= viewStart && nowMinutes <= viewEnd;
	const totalHeight = viewHours * HOUR_HEIGHT;

	// Hour labels within the trimmed view
	const firstHour = Math.ceil(viewStart / 60);
	const lastHour = Math.floor(viewEnd / 60);

	const viewportHeight = VIEWPORT_HOURS * HOUR_HEIGHT;

	return (
		<div>
			{/* Day label */}
			<div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none">
				{label}
			</div>
			{/* Fixed-height scroll window — hides scrollbar track */}
			<div
				ref={scrollRef}
				style={{ height: `${viewportHeight}px`, overflowY: "scroll", scrollbarWidth: "none" }}
				className="[&::-webkit-scrollbar]:hidden"
			>
				<div className="relative flex" style={{ height: `${totalHeight}px`, minWidth: 0 }}>
					{/* Hour grid lines */}
					<div className="absolute inset-0 pointer-events-none">
						{Array.from({ length: lastHour - firstHour + 1 }, (_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static grid lines
								key={i}
								className="absolute inset-x-0 border-t border-slate-700/50"
								style={{ top: `${toY((firstHour + i) * 60)}px` }}
							/>
						))}
						{/* Half-hour lines */}
						{Array.from({ length: lastHour - firstHour }, (_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static grid lines
								key={`half-${i}`}
								className="absolute inset-x-0 border-t border-slate-800/60"
								style={{ top: `${toY((firstHour + i) * 60 + 30)}px` }}
							/>
						))}
					</div>

					{/* Time gutter */}
					<div className="w-12 shrink-0 relative select-none">
						{Array.from({ length: lastHour - firstHour + 1 }, (_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static grid lines
								key={i}
								className="absolute right-2 text-[10px] text-slate-500 tabular-nums leading-none"
								style={{ top: `${toY((firstHour + i) * 60) - 5}px` }}
							>
								{formatHourLabel(firstHour + i)}
							</div>
						))}

						{/* Now circle — sits in gutter at current time */}
						{showNowLine && (
							<div
								className="absolute right-0 z-20 pointer-events-none"
								style={{ top: `${toY(nowMinutes) - 4}px` }}
							>
								<div className="w-2 h-2 rounded-full bg-red-500 ml-auto mr-0" />
							</div>
						)}
					</div>

					{/* Day column */}
					<div className="flex-1 relative border-l border-slate-700/50 min-w-0">
						{/* Blocks */}
						{showingBlocks.map((block) => {
							const startMins = timeToMinutes(block.startTime);
							const endMins = timeToMinutes(block.endTime);
							const top = toY(Math.max(startMins, viewStart));
							const bottom = toY(Math.min(endMins, viewEnd));
							const height = Math.max(bottom - top, 20);
							const color = resolveColor(block.color);
							const textColor = resolveTextColor(block.color);

							return (
								<button
									key={block.id}
									type="button"
									onClick={() => {
										if (block.docs.length === 1) handleDocTap(block.docs[0]);
									}}
									className="absolute rounded-md overflow-hidden text-left focus:outline-none group transition-all"
									style={{
										top: `${top + 1}px`,
										height: `${height - 2}px`,
										left: "3px",
										right: "3px",
										backgroundColor: `${color}18`,
										borderLeft: `2px solid ${color}`,
										boxShadow: `0 0 8px 0 ${color}40`,
									}}
								>
									<div className="px-1.5 pt-1 pb-0.5 min-w-0">
										<p
											className="text-[11px] font-semibold leading-tight truncate"
											style={{ color: textColor }}
										>
											{block.title}
										</p>
										{height >= 36 && (
											<p className="text-[10px] text-slate-400 tabular-nums leading-tight">
												{formatTime(block.startTime)}
											</p>
										)}
									</div>
									{/* DI Groups button — only on DI blocks */}
									{onShowDiGroups &&
										height >= 40 &&
										/\bdi\b|differentiat|small.?group/i.test(block.title) && (
											<div className="absolute bottom-1 right-1.5 hidden group-hover:block">
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														onShowDiGroups();
													}}
													className="rounded-full bg-indigo-600/80 hover:bg-indigo-500 px-2 py-0.5 text-[9px] font-semibold text-white transition-colors"
												>
													DI Groups
												</button>
											</div>
										)}
									{/* Doc pills shown on hover if multiple docs */}
									{block.docs.length > 1 && (
										<div className="absolute inset-x-1.5 bottom-1 hidden group-hover:flex flex-wrap gap-0.5">
											{block.docs.map((doc) => (
												<button
													key={doc.id}
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleDocTap(doc);
													}}
													className="rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] text-white/70 hover:bg-black/60 transition-colors"
												>
													{doc.label}
												</button>
											))}
										</div>
									)}
								</button>
							);
						})}

						{/* Now line — full width */}
						{showNowLine && (
							<div
								className="absolute inset-x-0 z-20 pointer-events-none"
								style={{ top: `${toY(nowMinutes)}px` }}
							>
								<div className="h-px bg-red-500" />
							</div>
						)}

						{/* Empty state */}
						{showingBlocks.length === 0 && !showingLoading && (
							<p className="absolute inset-0 flex items-center justify-center text-xs text-slate-600">
								No schedule for {label.toLowerCase()}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
