"use client";

import {
	AlertTriangleIcon,
	ChevronDownIcon,
	ClipboardListIcon,
	GraduationCapIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type GroupRow = { id: string; name: string; emoji: string | null };
type GroupMastery = Record<string, { mastered: number; total: number }>;
type SessionRow = { id: string; label: string | null; date: string; type: string };

export function CockpitInfoStrip({
	alerts,
	groupRows,
	groupMastery,
	recentActivity,
}: {
	alerts: { pacing: boolean; resourcesMissing: number };
	groupRows: GroupRow[];
	groupMastery: GroupMastery;
	recentActivity: SessionRow[];
}) {
	const [open, setOpen] = useState<"proficiency" | "sessions" | null>(null);

	const hasAlerts = alerts.pacing || alerts.resourcesMissing > 0;
	const alertMsg = [
		alerts.pacing && "Pacing late",
		alerts.resourcesMissing > 0 &&
			`${alerts.resourcesMissing} resource${alerts.resourcesMissing > 1 ? "s" : ""} missing`,
	]
		.filter(Boolean)
		.join(" · ");

	function toggle(panel: "proficiency" | "sessions") {
		setOpen((prev) => (prev === panel ? null : panel));
	}

	return (
		<section className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
			<div className="flex flex-wrap items-stretch divide-x divide-slate-700/60">
				{hasAlerts && (
					<div className="flex items-center gap-2 px-4 py-2.5 text-yellow-300 text-xs font-medium shrink-0">
						<AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
						{alertMsg}
					</div>
				)}

				{groupRows.length > 0 && (
					<button
						type="button"
						onClick={() => toggle("proficiency")}
						className={cn(
							"flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors",
							open === "proficiency"
								? "bg-slate-700/50 text-slate-200"
								: "text-slate-400 hover:text-slate-200",
						)}
					>
						<GraduationCapIcon className="h-3.5 w-3.5 text-slate-500" />
						Proficiency Snapshot
						<ChevronDownIcon
							className={cn(
								"h-3 w-3 text-slate-500 transition-transform",
								open === "proficiency" && "rotate-180",
							)}
						/>
					</button>
				)}

				<button
					type="button"
					onClick={() => toggle("sessions")}
					className={cn(
						"flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors",
						open === "sessions"
							? "bg-slate-700/50 text-slate-200"
							: "text-slate-400 hover:text-slate-200",
					)}
				>
					<ClipboardListIcon className="h-3.5 w-3.5 text-slate-500" />
					Recent Sessions
					<ChevronDownIcon
						className={cn(
							"h-3 w-3 text-slate-500 transition-transform",
							open === "sessions" && "rotate-180",
						)}
					/>
				</button>
			</div>

			{open === "proficiency" && (
				<div className="border-t border-slate-700 px-5 py-4">
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
											{mastery ? `${mastery.mastered}/${mastery.total}` : "—"}
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
				</div>
			)}

			{open === "sessions" && (
				<div className="border-t border-slate-700 px-5 py-4">
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
				</div>
			)}
		</section>
	);
}
