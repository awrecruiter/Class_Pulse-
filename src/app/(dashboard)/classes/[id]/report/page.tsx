"use client";

import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import type { DiffGroup, SessionReport, StudentReport } from "@/app/api/sessions/[id]/report/route";
import { Button } from "@/components/ui/button";

// ─── Signal badge ─────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: StudentReport["signal"] }) {
	if (!signal) return <span className="text-xs text-muted-foreground">—</span>;
	const map = {
		"got-it": { label: "Got it", emoji: "✅", color: "text-green-700 bg-green-100" },
		almost: { label: "Almost", emoji: "🤔", color: "text-yellow-700 bg-yellow-100" },
		lost: { label: "Lost", emoji: "😕", color: "text-red-700 bg-red-100" },
	} as const;
	const s = map[signal];
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}
		>
			{s.emoji} {s.label}
		</span>
	);
}

// ─── Mastery pills ────────────────────────────────────────────────────────────

function MasteryPills({ mastery }: { mastery: StudentReport["mastery"] }) {
	if (mastery.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
	return (
		<div className="flex flex-wrap gap-1">
			{mastery.map((m) => (
				<span
					key={m.standardCode}
					className={`rounded px-1.5 py-0.5 text-xs font-medium ${
						m.status === "mastered"
							? "bg-green-100 text-green-700"
							: "bg-indigo-100 text-indigo-700"
					}`}
					title={`${m.consecutiveCorrect} consecutive correct`}
				>
					{m.standardCode.split(":")[0]}
					{m.status === "mastered" ? " ✓" : ""}
				</span>
			))}
		</div>
	);
}

// ─── Drawing badge ────────────────────────────────────────────────────────────

function DrawingBadge({ type }: { type: string }) {
	const map: Record<string, { label: string; color: string }> = {
		correct: { label: "Correct", color: "bg-green-100 text-green-700" },
		partial: { label: "Partial", color: "bg-yellow-100 text-yellow-700" },
		misconception: { label: "Misconception", color: "bg-red-100 text-red-700" },
	};
	const s = map[type] ?? { label: type, color: "bg-gray-100 text-gray-600" };
	return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>;
}

// ─── Comprehension SVG summary ────────────────────────────────────────────────

function ComprehensionSummary({
	summary,
	total,
}: {
	summary: SessionReport["signalSummary"];
	total: number;
}) {
	if (total === 0) {
		return (
			<div className="rounded-lg border border-dashed border-border p-6 text-center">
				<p className="text-sm text-muted-foreground">No signals recorded this session</p>
			</div>
		);
	}

	const signaled = summary.gotIt + summary.almost + summary.lost;
	if (signaled === 0) {
		return (
			<div className="rounded-lg border border-border bg-card p-4 text-center">
				<p className="text-sm text-muted-foreground">No students signaled during class</p>
			</div>
		);
	}

	const pct = (n: number) => Math.round((n / signaled) * 100);

	const segments = [
		{ label: "Got it", count: summary.gotIt, color: "#22c55e", emoji: "✅" },
		{ label: "Almost", count: summary.almost, color: "#eab308", emoji: "🤔" },
		{ label: "Lost", count: summary.lost, color: "#ef4444", emoji: "😕" },
	];

	// Build donut SVG segments
	const r = 40;
	const cx = 60;
	const cy = 60;
	const circumference = 2 * Math.PI * r;

	let offset = 0;
	const arcs = segments.map((s) => {
		const fraction = signaled > 0 ? s.count / signaled : 0;
		const dashLen = fraction * circumference;
		const arc = { ...s, dashLen, dashOffset: -offset };
		offset += dashLen;
		return arc;
	});

	return (
		<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
			<p className="text-sm font-semibold text-foreground">
				End-of-class signal ({signaled}/{total} responded)
			</p>
			<div className="flex items-center gap-6">
				{/* Donut */}
				<svg
					width={120}
					height={120}
					viewBox="0 0 120 120"
					className="shrink-0"
					aria-label="Comprehension signal donut chart"
					role="img"
				>
					<circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={18} />
					{arcs.map((arc) =>
						arc.count > 0 ? (
							<circle
								key={arc.label}
								cx={cx}
								cy={cy}
								r={r}
								fill="none"
								stroke={arc.color}
								strokeWidth={18}
								strokeDasharray={`${arc.dashLen} ${circumference - arc.dashLen}`}
								strokeDashoffset={arc.dashOffset}
								transform={`rotate(-90 ${cx} ${cy})`}
								strokeLinecap="butt"
							/>
						) : null,
					)}
					<text
						x={cx}
						y={cy - 4}
						textAnchor="middle"
						className="fill-foreground text-xs font-bold"
						fontSize={14}
					>
						{signaled}
					</text>
					<text
						x={cx}
						y={cy + 10}
						textAnchor="middle"
						className="fill-muted-foreground"
						fontSize={9}
					>
						students
					</text>
				</svg>
				{/* Legend */}
				<div className="flex flex-col gap-2 flex-1">
					{segments.map((s) => (
						<div key={s.label} className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<span
									className="h-3 w-3 rounded-full shrink-0"
									style={{ backgroundColor: s.color }}
								/>
								<span className="text-xs text-muted-foreground">
									{s.emoji} {s.label}
								</span>
							</div>
							<span className="text-xs font-bold text-foreground tabular-nums">
								{s.count}{" "}
								<span className="font-normal text-muted-foreground">({pct(s.count)}%)</span>
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Diff group card ──────────────────────────────────────────────────────────

function DiffGroupCard({ group }: { group: DiffGroup }) {
	const colorMap: Record<string, string> = {
		green: "border-green-200 bg-green-50/60",
		blue: "border-indigo-200 bg-indigo-50/60",
		orange: "border-orange-200 bg-orange-50/60",
	};
	const tagMap: Record<string, string> = {
		green: "bg-green-100 text-green-700",
		blue: "bg-indigo-100 text-indigo-700",
		orange: "bg-orange-100 text-orange-700",
	};
	const border = colorMap[group.color] ?? "border-border bg-card";
	const tag = tagMap[group.color] ?? "bg-gray-100 text-gray-600";

	return (
		<div className={`rounded-lg border p-4 flex flex-col gap-2 ${border}`}>
			<div className="flex items-center gap-2">
				<span className="text-lg">{group.emoji}</span>
				<span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tag}`}>{group.label}</span>
				<span className="text-xs text-muted-foreground ml-auto">
					{group.students.length} student{group.students.length !== 1 ? "s" : ""}
				</span>
			</div>

			{group.students.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{group.students.map((name) => (
						<span
							key={name}
							className="rounded-full bg-white/80 border border-border px-2 py-0.5 text-xs font-medium text-foreground"
						>
							{name}
						</span>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">No students in this group</p>
			)}

			{group.recommendation && (
				<p className="text-xs text-foreground leading-relaxed border-t border-black/5 pt-2">
					{group.recommendation}
				</p>
			)}
		</div>
	);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ session?: string }>;
}) {
	const { id: classId } = use(params);
	const { session: sessionId } = use(searchParams);

	const [report, setReport] = useState<SessionReport | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const loadReport = useCallback(async () => {
		if (!sessionId) return;
		setLoading(true);
		setError("");
		try {
			const res = await fetch(`/api/sessions/${sessionId}/report`);
			if (!res.ok) {
				const json = await res.json();
				throw new Error((json as { error?: string }).error ?? "Failed");
			}
			const json = await res.json();
			setReport((json as { report: SessionReport }).report);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load report");
		} finally {
			setLoading(false);
		}
	}, [sessionId]);

	useEffect(() => {
		loadReport();
	}, [loadReport]);

	if (!sessionId) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-8">
				<p className="text-sm text-muted-foreground">No session specified.</p>
				<Link
					href={`/classes/${classId}`}
					className="text-sm text-primary hover:underline mt-2 block"
				>
					← Back to class
				</Link>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Button variant="ghost" size="sm" asChild>
					<Link href={`/classes/${classId}`}>
						<ArrowLeftIcon className="h-4 w-4 mr-1" />
						Back
					</Link>
				</Button>
				<div className="flex-1">
					<h1 className="text-xl font-bold text-foreground">
						{report ? `${report.classLabel} — ${report.date}` : "Post-Class Report"}
					</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						{report ? `${report.totalStudents} students on roster` : "Loading..."}
					</p>
				</div>
				<Button variant="ghost" size="sm" onClick={loadReport} disabled={loading}>
					<RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
				</Button>
			</div>

			{loading && !report && (
				<div className="flex flex-col gap-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
					))}
				</div>
			)}

			{error && (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
					<p className="text-sm text-destructive">{error}</p>
				</div>
			)}

			{report && (
				<>
					{/* Comprehension summary */}
					<section>
						<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
							Comprehension Pulse
						</h2>
						<ComprehensionSummary summary={report.signalSummary} total={report.totalStudents} />
					</section>

					{/* Differentiation groups */}
					<section>
						<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
							Differentiation Groups
						</h2>
						<div className="flex flex-col gap-3">
							{report.diffGroups.map((group) => (
								<DiffGroupCard key={group.label} group={group} />
							))}
						</div>
					</section>

					{/* Student mastery grid */}
					<section>
						<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
							Student Detail
						</h2>
						{report.students.length === 0 ? (
							<div className="rounded-lg border border-dashed border-border p-6 text-center">
								<p className="text-sm text-muted-foreground">No students on roster</p>
							</div>
						) : (
							<div className="rounded-lg border border-border overflow-hidden">
								{report.students.map((student, i) => (
									<div
										key={student.rosterId}
										className={`px-3 py-3 flex flex-col gap-2 ${
											i !== report.students.length - 1 ? "border-b border-border" : ""
										}`}
									>
										{/* Student header row */}
										<div className="flex items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
													{student.display.replace(/\./g, "")}
												</span>
												<p className="text-sm font-medium text-foreground">{student.display}</p>
											</div>
											<SignalBadge signal={student.signal} />
										</div>

										{/* Mastery */}
										{student.mastery.length > 0 && (
											<div className="flex items-start gap-2 ml-9">
												<span className="text-xs text-muted-foreground shrink-0 w-12 mt-0.5">
													Standards
												</span>
												<MasteryPills mastery={student.mastery} />
											</div>
										)}

										{/* Drawings */}
										{student.drawings.length > 0 && (
											<div className="flex items-start gap-2 ml-9">
												<span className="text-xs text-muted-foreground shrink-0 w-12 mt-0.5">
													Drawing
												</span>
												<div className="flex flex-wrap gap-1">
													{student.drawings.map((d, di) => (
														// biome-ignore lint/suspicious/noArrayIndexKey: stable drawing indices
														<div key={di} className="flex flex-col gap-0.5">
															<DrawingBadge type={d.analysisType} />
															<p className="text-xs text-muted-foreground leading-snug max-w-xs">
																{d.analysisText}
															</p>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</section>
				</>
			)}
		</div>
	);
}
