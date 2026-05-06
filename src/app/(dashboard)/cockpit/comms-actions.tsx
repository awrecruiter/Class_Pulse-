"use client";

import { MessageCircleIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CommsCardProps {
	flagId: string;
	studentInitials: string;
	standardCode: string;
	tier: string;
	sessionCount: number;
	classId: string;
}

export function CommsActions({
	flagId,
	studentInitials,
	standardCode,
	tier,
	sessionCount,
}: CommsCardProps) {
	const [dismissed, setDismissed] = useState(false);
	const [loading, setLoading] = useState<"send" | "dismiss" | null>(null);

	const handleDismiss = async () => {
		setLoading("dismiss");
		try {
			const res = await fetch(`/api/intervention-flags/${flagId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "dismiss" }),
			});
			if (!res.ok) throw new Error("Failed to dismiss");
			setDismissed(true);
			toast.success(`Dismissed flag for ${studentInitials}`);
		} catch {
			toast.error("Failed to dismiss flag");
		} finally {
			setLoading(null);
		}
	};

	const handleSend = async () => {
		setLoading("send");
		try {
			const res = await fetch(`/api/intervention-flags/${flagId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "send" }),
			});
			if (!res.ok) {
				const json: { error?: string } = await res.json();
				throw new Error(json.error ?? "Failed to send");
			}
			const json: { reportUrl?: string } = await res.json();
			toast.success(`Sent to parent for ${studentInitials}`);
			if (json.reportUrl) window.open(json.reportUrl, "_blank");
			setDismissed(true);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to send");
		} finally {
			setLoading(null);
		}
	};

	if (dismissed) return null;

	return (
		<div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3">
			<div className="flex items-start justify-between gap-2">
				<div>
					<p className="font-semibold text-slate-200 text-sm">{studentInitials}</p>
					<p className="text-xs text-slate-400 mt-0.5">
						{standardCode} · {tier === "tier2" ? "Tier 2" : "Tier 3"} · {sessionCount} sessions lost
					</p>
				</div>
				<span
					className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
						tier === "tier3" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"
					}`}
				>
					{tier === "tier3" ? "Tier 3" : "Tier 2"}
				</span>
			</div>

			<div className="flex gap-2 flex-wrap">
				<button
					type="button"
					onClick={handleSend}
					disabled={loading !== null}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 text-xs font-medium transition-colors disabled:opacity-50"
				>
					<MessageCircleIcon className="h-3.5 w-3.5" />
					{loading === "send" ? "Sending…" : "Send to Parent"}
				</button>
				<button
					type="button"
					onClick={handleDismiss}
					disabled={loading !== null}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
				>
					<XIcon className="h-3.5 w-3.5" />
					{loading === "dismiss" ? "Dismissing…" : "Dismiss"}
				</button>
			</div>
		</div>
	);
}
