"use client";

import { BellIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useVoiceQueue } from "@/contexts/voice-queue";
import type { ScheduleDocLink } from "@/hooks/use-schedule-today";
import { useScheduleToday } from "@/hooks/use-schedule-today";

const COLOR_MAP: Record<string, string> = {
	blue: "#6366f1",
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
	slate: "#64748b",
};

function resolveColor(color: string): string {
	return COLOR_MAP[color] ?? color;
}

function formatTime(t: string): string {
	const [h, m] = t.split(":").map(Number);
	if (Number.isNaN(h)) return t;
	const ampm = h >= 12 ? "PM" : "AM";
	const hour = h % 12 || 12;
	return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function ScheduleOverlay() {
	const { scheduleOverlayOpen, setScheduleOverlayOpen } = useVoiceQueue();
	const { blocks, loading, activeBlockId } = useScheduleToday();
	const [scheduleDocOpenMode, setScheduleDocOpenMode] = useState<"toast" | "new-tab">("toast");

	useEffect(() => {
		fetch("/api/teacher-settings")
			.then((r) => (r.ok ? r.json() : { settings: {} }))
			.then((j) => {
				if (j.settings?.scheduleDocOpenMode) {
					setScheduleDocOpenMode(j.settings.scheduleDocOpenMode as "toast" | "new-tab");
				}
			})
			.catch(() => {});
	}, []);

	function handleDocTap(doc: ScheduleDocLink) {
		if (scheduleDocOpenMode === "new-tab") {
			if (doc.linkType === "internal") {
				window.location.href = doc.url;
			} else {
				window.open(doc.url, "_blank");
			}
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

	const today = new Date();
	const todayLabel = today.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	});

	return (
		<>
			{/* Backdrop — only visible when open */}
			{scheduleOverlayOpen && (
				<button
					type="button"
					aria-label="Close schedule"
					className="fixed inset-0 bg-black/40 z-40"
					onClick={() => setScheduleOverlayOpen(false)}
				/>
			)}

			{/* Panel — always in DOM, slides in/out */}
			<div
				className="fixed inset-y-0 left-0 z-50 w-80 flex flex-col bg-[#0d1525] border-r border-slate-700/60 shadow-2xl transition-transform duration-300 ease-in-out"
				style={{
					transform: scheduleOverlayOpen ? "translateX(0)" : "translateX(-100%)",
				}}
			>
				{/* Header */}
				<div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
					<div>
						<h2 className="text-sm font-semibold text-slate-100">Schedule</h2>
						<p className="text-xs text-slate-500">{todayLabel}</p>
					</div>
					<button
						type="button"
						onClick={() => setScheduleOverlayOpen(false)}
						className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
					>
						<XIcon className="h-4 w-4" />
					</button>
				</div>

				{/* Block list */}
				<div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
					{loading ? (
						<div className="flex flex-col gap-2">
							{[1, 2, 3].map((i) => (
								<div key={i} className="h-16 rounded-lg bg-slate-800/30 animate-pulse" />
							))}
						</div>
					) : blocks.length === 0 ? (
						<p className="text-xs text-slate-500 px-1 py-4 text-center">
							No blocks scheduled for today.
						</p>
					) : (
						<>
							{blocks.filter((b) => b.blockType === "reminder").length > 0 && (
								<div className="flex flex-col gap-1.5 mb-3">
									<p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-500/70 px-1">
										Reminders
									</p>
									{blocks
										.filter((b) => b.blockType === "reminder")
										.map((rb) => (
											<div
												key={rb.id}
												className="flex items-start gap-2.5 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2"
											>
												<BellIcon className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
												<p className="text-xs text-slate-200 leading-snug flex-1">{rb.title}</p>
												<button
													type="button"
													aria-label="Dismiss reminder"
													onClick={async () => {
														await fetch(`/api/schedule/${rb.id}`, { method: "DELETE" });
														window.dispatchEvent(new CustomEvent("reminder-created"));
													}}
													className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
												>
													<XIcon className="h-3 w-3" />
												</button>
											</div>
										))}
								</div>
							)}
							{blocks
								.filter((b) => b.blockType !== "reminder")
								.map((block) => {
									const isActive = block.id === activeBlockId;
									const accentColor = resolveColor(block.color);
									return (
										<div
											key={block.id}
											className={`relative rounded-lg border bg-slate-800/60 overflow-hidden ${
												isActive
													? "border-indigo-400/60 ring-1 ring-indigo-400/40"
													: "border-slate-700/50"
											}`}
										>
											{/* Left color accent */}
											<div
												className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
												style={{ backgroundColor: accentColor }}
											/>

											<div className="pl-3 pr-3 py-2.5">
												<div className="flex items-center gap-2 mb-1">
													<span className="text-xs text-slate-400 tabular-nums">
														{formatTime(block.startTime)} – {formatTime(block.endTime)}
													</span>
													{isActive && (
														<span className="flex items-center gap-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300 animate-pulse">
															NOW
														</span>
													)}
												</div>
												<p className="text-sm font-semibold text-slate-100 leading-tight">
													{block.title}
												</p>

												{block.docs.length > 0 && (
													<div className="flex flex-wrap gap-1.5 mt-2">
														{block.docs.map((doc) => (
															<button
																key={doc.id}
																type="button"
																onClick={() => handleDocTap(doc)}
																className="rounded-full bg-slate-700/60 border border-slate-600/50 hover:bg-slate-600/60 hover:border-slate-500 px-2.5 py-0.5 text-[11px] text-slate-300 hover:text-white transition-colors"
															>
																{doc.label}
															</button>
														))}
													</div>
												)}
											</div>
										</div>
									);
								})}
						</>
					)}
				</div>

				{/* Footer */}
				<div className="shrink-0 border-t border-slate-700/60 px-4 py-3">
					<Link
						href="/settings#schedule"
						className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
						onClick={() => setScheduleOverlayOpen(false)}
					>
						Edit Schedule →
					</Link>
				</div>
			</div>
		</>
	);
}
