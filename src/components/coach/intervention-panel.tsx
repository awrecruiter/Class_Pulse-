"use client";

import { AlertTriangleIcon, CheckIcon, SendIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { InterventionFlagRow } from "@/app/api/intervention-flags/route";

export function InterventionPanel() {
	const [flags, setFlags] = useState<InterventionFlagRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState<string | null>(null);
	const [sentLinks, setSentLinks] = useState<Record<string, string>>({});

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/intervention-flags");
			if (res.ok) {
				const json = await res.json();
				setFlags(json.flags ?? []);
			}
		} catch {
			// non-fatal
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	async function handleAction(flagId: string, action: "send" | "dismiss") {
		setSending(flagId);
		try {
			const res = await fetch(`/api/intervention-flags/${flagId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});
			const json = await res.json().catch(() => ({}));
			if (res.ok) {
				if (action === "send") {
					toast.success("Parent message sent");
					if (json.reportUrl) {
						setSentLinks((prev) => ({ ...prev, [flagId]: json.reportUrl }));
					}
				} else {
					toast.success("Flag dismissed");
				}
				setFlags((prev) => prev.filter((f) => f.id !== flagId));
			} else if (res.status === 422) {
				toast.error("No parent contact on file for this student");
			} else {
				toast.error(json.error ?? "Something went wrong");
			}
		} catch {
			toast.error("Network error");
		} finally {
			setSending(null);
		}
	}

	if (loading) return null;
	if (flags.length === 0 && Object.keys(sentLinks).length === 0) return null;

	return (
		<div className="px-6 pb-4">
			<div className="flex items-center gap-2 mb-2">
				<AlertTriangleIcon className="h-3.5 w-3.5 text-amber-400" />
				<p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
					Intervention Alerts
				</p>
				{flags.length > 0 && (
					<span className="ml-auto flex items-center justify-center h-4.5 w-4.5 min-w-[1.1rem] rounded-full bg-amber-500 text-[9px] font-bold text-black px-1">
						{flags.length}
					</span>
				)}
			</div>

			<div className="flex flex-col gap-2">
				{flags.map((flag) => (
					<div
						key={flag.id}
						className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5"
					>
						<div className="flex items-start justify-between gap-2">
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-1.5 flex-wrap">
									<span className="text-xs font-semibold text-slate-200">
										{flag.studentDisplay}
									</span>
									<span
										className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
											flag.tier === "tier3"
												? "bg-red-500/20 text-red-300"
												: "bg-amber-500/20 text-amber-300"
										}`}
									>
										{flag.tier === "tier3" ? "Persistent" : "Repeated"}
									</span>
								</div>
								<div className="flex items-center gap-1.5 mt-0.5">
									<span className="font-mono text-[10px] text-slate-400">{flag.standardCode}</span>
									<span className="text-[10px] text-slate-500">· {flag.sessionCount} sessions</span>
									{flag.classLabel && (
										<span className="text-[10px] text-slate-600">· {flag.classLabel}</span>
									)}
								</div>
							</div>
							<div className="flex items-center gap-1 shrink-0">
								<button
									type="button"
									title="Dismiss"
									onClick={() => handleAction(flag.id, "dismiss")}
									disabled={sending === flag.id}
									className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
								>
									<XIcon className="h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									title="Send parent report"
									onClick={() => handleAction(flag.id, "send")}
									disabled={sending === flag.id}
									className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-amber-600/30 text-amber-300 hover:bg-amber-600/50 transition-colors disabled:opacity-50"
								>
									{sending === flag.id ? (
										"…"
									) : (
										<>
											<SendIcon className="h-3 w-3" />
											Send
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				))}

				{/* Sent report links */}
				{Object.entries(sentLinks).map(([, url]) => (
					<div
						key={url}
						className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2"
					>
						<div className="flex items-center gap-1.5">
							<CheckIcon className="h-3 w-3 text-emerald-400 shrink-0" />
							<span className="text-[10px] text-emerald-300">Sent. </span>
							<button
								type="button"
								onClick={() => {
									navigator.clipboard.writeText(url);
									toast.success("Report link copied");
								}}
								className="text-[10px] text-slate-400 hover:text-slate-200 underline transition-colors truncate"
							>
								Copy report link
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
