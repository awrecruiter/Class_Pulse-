"use client";

import { CheckIcon, FileTextIcon, MessageCircleIcon, XIcon } from "lucide-react";
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
	classId,
}: CommsCardProps) {
	const [dismissed, setDismissed] = useState(false);
	const [loading, setLoading] = useState<"report" | "sms" | "dismiss" | null>(null);

	const handleDismiss = async () => {
		setLoading("dismiss");
		try {
			const res = await fetch(`/api/parent-comms/flags/${flagId}/dismiss`, { method: "POST" });
			if (!res.ok) throw new Error("Failed to dismiss");
			setDismissed(true);
			toast.success(`Dismissed flag for ${studentInitials}`);
		} catch {
			toast.error("Failed to dismiss flag");
		} finally {
			setLoading(null);
		}
	};

	const handleGenerateReport = async () => {
		setLoading("report");
		try {
			const res = await fetch(`/api/parent-comms/flags/${flagId}/report`, { method: "POST" });
			if (!res.ok) throw new Error("Failed to generate");
			const json: { url?: string } = await res.json();
			if (json.url) {
				window.open(json.url, "_blank");
			} else {
				toast.success("Report generated — check Parent Comms");
			}
		} catch {
			toast.error("Failed to generate report");
		} finally {
			setLoading(null);
		}
	};

	const handleSendSms = async () => {
		setLoading("sms");
		try {
			const res = await fetch(`/api/parent-comms/flags/${flagId}/sms`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ classId }),
			});
			if (!res.ok) throw new Error("Failed to send");
			toast.success(`SMS sent for ${studentInitials}`);
		} catch {
			toast.error("Failed to send SMS");
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
					onClick={handleGenerateReport}
					disabled={loading !== null}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 text-xs font-medium transition-colors disabled:opacity-50"
				>
					<FileTextIcon className="h-3.5 w-3.5" />
					{loading === "report" ? "Generating…" : "Generate Report"}
				</button>
				<button
					type="button"
					onClick={handleSendSms}
					disabled={loading !== null}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 text-xs font-medium transition-colors disabled:opacity-50"
				>
					<MessageCircleIcon className="h-3.5 w-3.5" />
					{loading === "sms" ? "Sending…" : "Send SMS"}
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
