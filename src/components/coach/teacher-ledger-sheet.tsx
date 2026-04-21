"use client";

import { BanknoteIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";

type LedgerEntry = {
	id: string;
	date: string;
	label: string;
	amount: number | null;
	kind: "credit" | "debit" | "pending" | "rejected";
};

const TYPE_LABELS: Record<string, string> = {
	"academic-correct": "Correct answer",
	"academic-mastery": "Mastery bonus",
	"academic-iready": "iReady goal",
	"behavior-positive": "Positive behavior",
	"behavior-fine": "Behavior fine",
	purchase: "Store purchase",
	"manual-award": "Teacher award",
	"manual-deduct": "Teacher deduction",
	reset: "Balance reset",
};

interface TeacherLedgerSheetProps {
	student: StudentOverview;
	classId: string;
	onClose: () => void;
}

export function TeacherLedgerSheet({ student, classId, onClose }: TeacherLedgerSheetProps) {
	const [entries, setEntries] = useState<LedgerEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function load() {
			setLoading(true);
			try {
				const res = await fetch(
					`/api/classes/${classId}/ram-bucks/transactions?rosterId=${student.rosterId}&limit=50`,
				);
				const json = res.ok ? await res.json() : { transactions: [] };
				const built: LedgerEntry[] = (json.transactions ?? []).map(
					(t: { id: string; createdAt: string; reason: string; type: string; amount: number }) => ({
						id: t.id,
						date: t.createdAt,
						label: t.reason || TYPE_LABELS[t.type] || t.type,
						amount: t.amount,
						kind: t.amount >= 0 ? "credit" : "debit",
					}),
				);
				setEntries(built);
			} catch {
				// non-fatal
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [classId, student.rosterId]);

	const kindStyle: Record<string, string> = {
		credit: "text-emerald-400",
		debit: "text-red-400",
		pending: "text-amber-400",
		rejected: "text-slate-500 line-through",
	};

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
			{/* Backdrop */}
			<button
				type="button"
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
				onKeyDown={(e) => e.key === "Escape" && onClose()}
				aria-label="Close"
			/>

			{/* Sheet */}
			<div className="relative z-10 w-full max-w-sm bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
				{/* Header */}
				<div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
					<div>
						<p className="text-sm font-semibold text-slate-100">{student.displayName}</p>
						<div className="flex items-center gap-1.5 mt-0.5">
							<BanknoteIcon className="h-3 w-3 text-emerald-400" />
							<span className="text-xs font-bold text-amber-400">{student.balance} RAM Bucks</span>
							<span className="text-[10px] text-slate-500">· ID {student.studentId}</span>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
					>
						<XIcon className="h-4 w-4" />
					</button>
				</div>

				{/* Transaction list */}
				<div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
					{loading ? (
						<div className="space-y-2">
							{["a", "b", "c", "d", "e", "f"].map((k) => (
								<div key={k} className="h-8 rounded bg-slate-800/60 animate-pulse" />
							))}
						</div>
					) : entries.length === 0 ? (
						<p className="text-center text-sm text-slate-500 py-8">No transactions yet</p>
					) : (
						<div className="flex flex-col gap-0.5">
							{entries.map((e) => (
								<div
									key={e.id}
									className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800/60 last:border-0"
								>
									<div className="flex-1 min-w-0">
										<p className="text-xs text-slate-300 truncate">{e.label}</p>
										<p className="text-[10px] text-slate-600">{formatDate(e.date)}</p>
									</div>
									<span className={`text-xs font-bold tabular-nums shrink-0 ${kindStyle[e.kind]}`}>
										{e.kind === "credit" && e.amount !== null && `+${e.amount}`}
										{e.kind === "debit" && e.amount !== null && e.amount}
										{e.kind === "pending" && "Pending"}
										{e.kind === "rejected" && "Denied"}
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
