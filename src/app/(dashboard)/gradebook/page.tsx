"use client";

import { BarChart2Icon, DownloadIcon, LineChartIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ClassOption = {
	id: string;
	label: string;
	periodTime: string;
};

type RosterEntry = {
	id: string;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
};

type CfuEntry = {
	rosterId: string;
	score: number;
	notes: string;
};

const SCORE_OPTIONS = [
	{ value: 0, label: "0 - Absent" },
	{ value: 1, label: "1 - Below" },
	{ value: 2, label: "2 - Approaching" },
	{ value: 3, label: "3 - Meeting" },
	{ value: 4, label: "4 - Exceeding" },
] as const;

const SCORE_COLORS: Record<number, string> = {
	0: "bg-slate-800 text-slate-400",
	1: "bg-red-500/20 text-red-300",
	2: "bg-orange-500/20 text-orange-300",
	3: "bg-blue-500/20 text-blue-300",
	4: "bg-emerald-500/20 text-emerald-300",
};

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

// ─── SVG Trend Chart ──────────────────────────────────────────────────────────
const SCORE_LINE_COLORS = ["#64748b", "#ef4444", "#f97316", "#3b82f6", "#10b981"];
const SCORE_BAR_COLORS = [
	"bg-slate-600",
	"bg-red-500",
	"bg-orange-500",
	"bg-blue-500",
	"bg-emerald-500",
];
const DIST_LABELS = ["Absent", "Below", "Approaching", "Meeting", "Exceeding"];

function TrendChart({
	data,
	mode,
}: {
	data: { date: string; average: number; count: number; dist: number[] }[];
	mode: "line" | "bar";
}) {
	if (data.length === 0) {
		return (
			<div className="h-32 flex items-center justify-center text-xs text-slate-500">
				No data for the last 30 days
			</div>
		);
	}

	const W = 480;
	const H = 120;
	const PAD = { top: 12, right: 12, bottom: 28, left: 28 };
	const chartW = W - PAD.left - PAD.right;
	const chartH = H - PAD.top - PAD.bottom;

	const maxAvg = 4;
	const minAvg = 0;

	function xPos(i: number) {
		return PAD.left + (data.length <= 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
	}
	function yPos(v: number) {
		return PAD.top + chartH - ((v - minAvg) / (maxAvg - minAvg)) * chartH;
	}

	const linePath = data
		.map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(i)} ${yPos(d.average)}`)
		.join(" ");
	const areaPath = `${linePath} L ${xPos(data.length - 1)} ${PAD.top + chartH} L ${xPos(0)} ${PAD.top + chartH} Z`;

	const barW = Math.max(4, Math.min(24, chartW / data.length - 4));

	if (mode === "line") {
		return (
			<div className="flex flex-col gap-2">
				<svg
					viewBox={`0 0 ${W} ${H}`}
					className="w-full"
					style={{ height: H }}
					aria-label="Score trend line chart"
				>
					<title>Score trend line chart</title>
					{/* Grid lines */}
					{[0, 1, 2, 3, 4].map((v) => (
						<line
							key={v}
							x1={PAD.left}
							y1={yPos(v)}
							x2={W - PAD.right}
							y2={yPos(v)}
							stroke="#1e293b"
							strokeWidth={1}
						/>
					))}
					{/* Y-axis labels */}
					{[0, 1, 2, 3, 4].map((v) => (
						<text
							key={v}
							x={PAD.left - 4}
							y={yPos(v) + 4}
							textAnchor="end"
							fontSize={8}
							fill="#475569"
						>
							{v}
						</text>
					))}
					{/* Area fill */}
					<path d={areaPath} fill="#6366f1" fillOpacity={0.08} />
					{/* Line */}
					<path
						d={linePath}
						fill="none"
						stroke="#6366f1"
						strokeWidth={1.5}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					{/* Data points */}
					{data.map((d, i) => (
						<g key={d.date}>
							<circle cx={xPos(i)} cy={yPos(d.average)} r={3} fill="#6366f1" />
							{/* Date label — show every Nth label to avoid crowding */}
							{(i === 0 ||
								i === data.length - 1 ||
								data.length <= 7 ||
								i % Math.ceil(data.length / 6) === 0) && (
								<text x={xPos(i)} y={H - 4} textAnchor="middle" fontSize={7} fill="#475569">
									{d.date.slice(5)}
								</text>
							)}
						</g>
					))}
				</svg>
				{/* Score legend */}
				<div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
					<span className="text-[10px] text-slate-500">Avg score (1–4, excludes absent)</span>
					<span className="text-[10px] text-indigo-400 font-medium">
						Latest: {data[data.length - 1]?.average.toFixed(2)} / 4.00
					</span>
				</div>
			</div>
		);
	}

	// Bar chart — stacked distribution per day
	return (
		<div className="flex flex-col gap-2">
			<svg
				viewBox={`0 0 ${W} ${H}`}
				className="w-full"
				style={{ height: H }}
				aria-label="Score distribution bar chart"
			>
				<title>Score distribution bar chart</title>
				{data.map((d, i) => {
					const total = d.dist.reduce((a, b) => a + b, 0);
					if (total === 0) return null;
					const x = xPos(i) - barW / 2;
					let cumY = PAD.top + chartH;
					return (
						<g key={d.date}>
							{d.dist.map((cnt, scoreIdx) => {
								if (cnt === 0) return null;
								const barH = (cnt / total) * chartH;
								cumY -= barH;
								const fill = SCORE_LINE_COLORS[scoreIdx] ?? "#64748b";
								const scoreLabel = DIST_LABELS[scoreIdx] ?? String(scoreIdx);
								return (
									<rect
										key={`${d.date}-${scoreLabel}`}
										x={x}
										y={cumY}
										width={barW}
										height={barH}
										fill={fill}
										fillOpacity={0.8}
									/>
								);
							})}
							{(i === 0 ||
								i === data.length - 1 ||
								data.length <= 7 ||
								i % Math.ceil(data.length / 6) === 0) && (
								<text x={xPos(i)} y={H - 4} textAnchor="middle" fontSize={7} fill="#475569">
									{d.date.slice(5)}
								</text>
							)}
						</g>
					);
				})}
			</svg>
			{/* Legend */}
			<div className="flex flex-wrap gap-x-3 gap-y-0.5">
				{DIST_LABELS.map((label, idx) => (
					<span key={label} className="flex items-center gap-1 text-[10px] text-slate-400">
						<span className={`inline-block h-2 w-2 rounded-sm ${SCORE_BAR_COLORS[idx]}`} />
						{label}
					</span>
				))}
			</div>
		</div>
	);
}

export default function GradebookPage() {
	const [classes, setClasses] = useState<ClassOption[]>([]);
	const [selectedClassId, setSelectedClassId] = useState<string>("");
	const [roster, setRoster] = useState<RosterEntry[]>([]);
	const [date, setDate] = useState<string>(today());
	const [standardCode, setStandardCode] = useState<string>("");
	const [scores, setScores] = useState<Record<string, { score: number; notes: string }>>({});
	const [_existingEntries, setExistingEntries] = useState<CfuEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [exportFrom, setExportFrom] = useState<string>(today());
	const [exportTo, setExportTo] = useState<string>(today());
	// Chart state
	const [chartMode, setChartMode] = useState<"line" | "bar">("line");
	const [trend, setTrend] = useState<
		{ date: string; average: number; count: number; dist: number[] }[]
	>([]);
	const [trendLoading, setTrendLoading] = useState(false);

	// Fetch class list
	useEffect(() => {
		fetch("/api/classes")
			.then((r) => r.json())
			.then((json) => {
				const cls: ClassOption[] = (json.classes ?? []).filter(
					(c: ClassOption & { isArchived: boolean }) => !c.isArchived,
				);
				setClasses(cls);
				if (cls.length === 0) {
					setSelectedClassId("");
					setRoster([]);
					setScores({});
					setExistingEntries([]);
					return;
				}
				const savedClassId =
					typeof window !== "undefined" ? localStorage.getItem("activeClassId") : null;
				const preferred = cls.find((c) => c.id === savedClassId) ?? cls[0];
				setSelectedClassId(preferred?.id ?? "");
			})
			.catch(() => toast.error("Failed to load classes"));
	}, []);

	// Fetch roster when class changes
	useEffect(() => {
		if (!selectedClassId) {
			setRoster([]);
			setScores({});
			setExistingEntries([]);
			return;
		}
		localStorage.setItem("activeClassId", selectedClassId);
		fetch(`/api/classes/${selectedClassId}`)
			.then((r) => r.json())
			.then((json) => {
				const rosterData: RosterEntry[] = (json.roster ?? []).filter(
					(s: RosterEntry & { isActive: boolean }) => s.isActive,
				);
				setRoster(rosterData);
				// Initialize scores to 0 for all students
				const initial: Record<string, { score: number; notes: string }> = {};
				for (const s of rosterData) {
					initial[s.id] = { score: 0, notes: "" };
				}
				setScores(initial);
			})
			.catch(() => toast.error("Failed to load roster"));
	}, [selectedClassId]);

	// Fetch trend data for charts (last 30 days)
	const fetchTrend = useCallback(async () => {
		if (!selectedClassId) {
			setTrend([]);
			return;
		}
		setTrendLoading(true);
		try {
			const toDate = today();
			const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
			const res = await fetch(
				`/api/classes/${selectedClassId}/gradebook?from=${fromDate}&to=${toDate}`,
			);
			if (!res.ok) return;
			const json = await res.json();
			setTrend(json.trend ?? []);
		} catch {
			// Silently fail
		} finally {
			setTrendLoading(false);
		}
	}, [selectedClassId]);

	useEffect(() => {
		fetchTrend();
	}, [fetchTrend]);

	// Fetch existing entries when class + date change
	const fetchExisting = useCallback(async () => {
		if (!selectedClassId || !date) {
			setExistingEntries([]);
			return;
		}
		setLoading(true);
		try {
			const res = await fetch(`/api/classes/${selectedClassId}/gradebook?date=${date}`);
			if (!res.ok) throw new Error("Failed to fetch");
			const json = await res.json();
			setExistingEntries(json.entries ?? []);

			// Pre-fill scores from existing entries
			setScores((prev) => {
				const updated = { ...prev };
				for (const entry of json.entries ?? []) {
					updated[entry.rosterId] = { score: entry.score, notes: entry.notes };
				}
				return updated;
			});

			// Set standard code if entries exist
			if (json.entries?.length > 0 && !standardCode) {
				setStandardCode(json.entries[0].standardCode);
			}
		} catch {
			// Silently fail — no entries yet
		} finally {
			setLoading(false);
		}
	}, [selectedClassId, date, standardCode]);

	useEffect(() => {
		fetchExisting();
	}, [fetchExisting]);

	function setScore(rosterId: string, score: number) {
		setScores((prev) => ({
			...prev,
			[rosterId]: { notes: prev[rosterId]?.notes ?? "", score },
		}));
	}

	function setNotes(rosterId: string, notes: string) {
		setScores((prev) => ({
			...prev,
			[rosterId]: { score: prev[rosterId]?.score ?? 0, notes },
		}));
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedClassId || !date || !standardCode) {
			toast.error("Select a class, date, and standard code");
			return;
		}

		setSubmitting(true);
		try {
			const entries = roster.map((s) => ({
				rosterId: s.id,
				score: scores[s.id]?.score ?? 0,
				notes: scores[s.id]?.notes ?? "",
			}));

			const res = await fetch(`/api/classes/${selectedClassId}/gradebook`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ date, standardCode, entries }),
			});

			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Failed to save");
			}

			const json = await res.json();
			toast.success(`Saved ${json.count} entries`);
			fetchExisting();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSubmitting(false);
		}
	}

	function handleExport() {
		if (!selectedClassId) return;
		const url = `/api/classes/${selectedClassId}/gradebook/export?from=${exportFrom}&to=${exportTo}`;
		window.open(url, "_blank");
	}

	useEffect(() => {
		function handleVoiceExportGradebook(e: Event) {
			if (!selectedClassId) {
				toast.error("Select a class before exporting the gradebook");
				return;
			}
			const detail = (e as CustomEvent<{ from?: string; to?: string }>).detail;
			const from = detail.from?.trim() || exportFrom;
			const to = detail.to?.trim() || exportTo;
			const url = `/api/classes/${selectedClassId}/gradebook/export?from=${from}&to=${to}`;
			window.open(url, "_blank");
			toast.success("Exporting gradebook CSV");
		}

		window.addEventListener("voice-export_gradebook", handleVoiceExportGradebook);
		return () => window.removeEventListener("voice-export_gradebook", handleVoiceExportGradebook);
	}, [selectedClassId, exportFrom, exportTo]);

	const selectedClass = classes.find((c) => c.id === selectedClassId);

	return (
		<div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-bold text-slate-200">Gradebook</h1>
				<p className="text-sm text-slate-400 mt-0.5">Record daily CFU scores per standard</p>
			</div>

			{/* Controls */}
			<div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{/* Class selector */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-slate-400" htmlFor="class-select">
							Class
						</label>
						<select
							id="class-select"
							value={selectedClassId}
							onChange={(e) => setSelectedClassId(e.target.value)}
							className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						>
							{classes.map((c) => (
								<option key={c.id} value={c.id}>
									{c.label}
									{c.periodTime ? ` (${c.periodTime})` : ""}
								</option>
							))}
						</select>
					</div>

					{/* Date picker */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-slate-400" htmlFor="date-picker">
							Date
						</label>
						<input
							id="date-picker"
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>

					{/* Standard code */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-slate-400" htmlFor="standard-code">
							Standard Code
						</label>
						<input
							id="standard-code"
							type="text"
							placeholder="e.g. MA.5.FR.1.1"
							value={standardCode}
							onChange={(e) => setStandardCode(e.target.value.toUpperCase())}
							className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
				</div>
			</div>

			{/* Student score grid */}
			{selectedClassId && roster.length === 0 && !loading && (
				<div className="rounded-lg border border-dashed border-slate-800 p-6 text-center">
					<p className="text-sm text-slate-400">
						No students in this class. Add students from the Classes page.
					</p>
				</div>
			)}

			{roster.length > 0 && (
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<p className="text-sm font-semibold text-slate-200">
							{selectedClass?.label} — {date}
						</p>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={fetchExisting}
							disabled={loading}
						>
							<RefreshCwIcon className="h-3.5 w-3.5 mr-1.5" />
							Refresh
						</Button>
					</div>

					{/* Score legend */}
					<div className="flex flex-wrap gap-2">
						{SCORE_OPTIONS.map((opt) => (
							<span
								key={opt.value}
								className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SCORE_COLORS[opt.value]}`}
							>
								{opt.label}
							</span>
						))}
					</div>

					<div className="rounded-lg border border-slate-800 overflow-hidden">
						{/* Table header */}
						<div className="grid grid-cols-[1fr,auto,1fr] gap-2 px-3 py-2 bg-slate-800/30 border-b border-slate-800">
							<span className="text-xs font-medium text-slate-400">Student</span>
							<span className="text-xs font-medium text-slate-400 text-center">Score</span>
							<span className="text-xs font-medium text-slate-400">Notes</span>
						</div>

						{roster.map((student, i) => {
							const currentScore = scores[student.id]?.score ?? 0;
							const currentNotes = scores[student.id]?.notes ?? "";

							return (
								<div
									key={student.id}
									className={`grid grid-cols-[1fr,auto,1fr] gap-2 items-center px-3 py-2.5 ${
										i !== roster.length - 1 ? "border-b border-slate-800" : ""
									}`}
								>
									{/* Student */}
									<div className="flex items-center gap-2">
										<span
											className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${SCORE_COLORS[currentScore]}`}
										>
											{student.firstInitial}
											{student.lastInitial}
										</span>
										<div>
											<p className="text-sm font-medium text-slate-200">
												{student.firstInitial}.{student.lastInitial}.
											</p>
											<p className="text-xs text-slate-400">ID: {student.studentId}</p>
										</div>
									</div>

									{/* Score select */}
									<select
										value={currentScore}
										onChange={(e) => setScore(student.id, Number(e.target.value))}
										className={`rounded border border-slate-800 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring ${SCORE_COLORS[currentScore]}`}
									>
										{SCORE_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.value}
											</option>
										))}
									</select>

									{/* Notes */}
									<input
										type="text"
										placeholder="Notes..."
										value={currentNotes}
										onChange={(e) => setNotes(student.id, e.target.value)}
										className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
									/>
								</div>
							);
						})}
					</div>

					<Button type="submit" disabled={submitting || !standardCode}>
						{submitting ? "Saving..." : `Save ${roster.length} Entries`}
					</Button>
				</form>
			)}

			{/* Class Trend Charts */}
			{selectedClassId && (trend.length > 0 || trendLoading) && (
				<section className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
							Class Trend — Last 30 Days
						</h2>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => setChartMode("line")}
								className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${chartMode === "line" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-slate-500 hover:text-slate-300"}`}
							>
								<LineChartIcon className="h-3.5 w-3.5" />
								Line
							</button>
							<button
								type="button"
								onClick={() => setChartMode("bar")}
								className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${chartMode === "bar" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-slate-500 hover:text-slate-300"}`}
							>
								<BarChart2Icon className="h-3.5 w-3.5" />
								Bar
							</button>
						</div>
					</div>
					<div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
						{trendLoading ? (
							<div className="h-32 flex items-center justify-center text-xs text-slate-500">
								Loading trend data…
							</div>
						) : (
							<TrendChart data={trend} mode={chartMode} />
						)}
					</div>
				</section>
			)}

			{/* Export section */}
			<section className="flex flex-col gap-3">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Export CSV</h2>
				<div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
					<div className="flex flex-col gap-1.5">
						<label className="text-xs text-slate-400" htmlFor="export-from">
							From
						</label>
						<input
							id="export-from"
							type="date"
							value={exportFrom}
							onChange={(e) => setExportFrom(e.target.value)}
							className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label className="text-xs text-slate-400" htmlFor="export-to">
							To
						</label>
						<input
							id="export-to"
							type="date"
							value={exportTo}
							onChange={(e) => setExportTo(e.target.value)}
							className="rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={handleExport}
						disabled={!selectedClassId}
					>
						<DownloadIcon className="h-3.5 w-3.5 mr-1.5" />
						Export CSV
					</Button>
				</div>
			</section>
		</div>
	);
}
