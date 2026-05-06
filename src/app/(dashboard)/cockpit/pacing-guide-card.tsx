"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { YAAG_TOPICS } from "@/data/yaag-2025-2026";

type PacingEntry = {
	id: string;
	weekOf: string;
	standardCode: string;
	title: string;
};

export function PacingGuideCard() {
	const [entries, setEntries] = useState<PacingEntry[]>([]);
	const [weekOf, setWeekOf] = useState("");
	const [standardCode, setStandardCode] = useState("");
	const [title, setTitle] = useState("");
	const [saving, setSaving] = useState(false);
	const [topicOverride, setTopicOverride] = useState<number | "">("");
	const [savingOverride, setSavingOverride] = useState(false);

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/pacing-guide");
			if (res.ok) {
				const json = await res.json();
				setEntries(json.entries ?? []);
			}
		} catch {
			// non-fatal
		}
	}, []);

	useEffect(() => {
		fetch("/api/teacher-settings")
			.then((r) => (r.ok ? r.json() : { settings: {} }))
			.then((j) => {
				if (typeof j.settings?.currentTopicNumber === "number")
					setTopicOverride(j.settings.currentTopicNumber);
			})
			.catch(() => {});
	}, []);

	async function handleSaveOverride(val: number | "") {
		setTopicOverride(val);
		setSavingOverride(true);
		try {
			await fetch("/api/teacher-settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ currentTopicNumber: val === "" ? null : val }),
			});
			toast.success(val === "" ? "Using YAAG auto-schedule" : `Override set to Topic ${val}`);
		} catch {
			toast.error("Failed to save");
		} finally {
			setSavingOverride(false);
		}
	}

	useEffect(() => {
		load();
		const now = new Date();
		const day = now.getDay();
		const monday = new Date(now);
		monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
		setWeekOf(monday.toISOString().slice(0, 10));
	}, [load]);

	async function handleAdd() {
		if (!weekOf || !standardCode.trim()) return;
		setSaving(true);
		try {
			const res = await fetch("/api/pacing-guide", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ weekOf, standardCode: standardCode.trim().toUpperCase(), title }),
			});
			if (res.ok) {
				toast.success("Pacing guide entry saved");
				setStandardCode("");
				setTitle("");
				load();
			} else {
				toast.error("Failed to save");
			}
		} catch {
			toast.error("Network error");
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(id: string) {
		try {
			await fetch(`/api/pacing-guide/${id}`, { method: "DELETE" });
			setEntries((prev) => prev.filter((e) => e.id !== id));
		} catch {
			// non-fatal
		}
	}

	function formatWeek(weekOf: string) {
		const d = new Date(`${weekOf}T12:00:00`);
		return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	}

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
					Pacing Guide
				</h2>
				<p className="text-xs text-slate-400 mt-0.5">
					Tag which standard you plan to cover each week — enables cross-session intervention
					detection
				</p>
			</div>

			{/* Current topic override */}
			<div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-2">
				<div>
					<p className="text-xs font-semibold text-slate-300">Current Topic Override</p>
					<p className="text-[11px] text-slate-500 mt-0.5">
						If your class is ahead or behind the YAAG schedule, set your actual topic here. Leave
						blank to auto-detect from today&apos;s date.
					</p>
				</div>
				<select
					value={topicOverride}
					onChange={(e) => handleSaveOverride(e.target.value === "" ? "" : Number(e.target.value))}
					disabled={savingOverride}
					className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
				>
					<option value="">Auto (from YAAG dates)</option>
					{YAAG_TOPICS.map((t) => (
						<option key={t.number} value={t.number}>
							Topic {t.roman}: {t.title}
						</option>
					))}
				</select>
				{topicOverride !== "" && (
					<p className="text-[10px] text-amber-400">
						Override active — schedule sidebar and homework will use Topic {topicOverride}
					</p>
				)}
			</div>

			{/* Add entry */}
			<div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-3">
				<div className="grid grid-cols-3 gap-2">
					<div className="flex flex-col gap-1">
						<label htmlFor="pg-week" className="text-[10px] text-slate-500 uppercase tracking-wide">
							Week of (Monday)
						</label>
						<input
							id="pg-week"
							type="date"
							value={weekOf}
							onChange={(e) => setWeekOf(e.target.value)}
							className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label htmlFor="pg-std" className="text-[10px] text-slate-500 uppercase tracking-wide">
							Standard
						</label>
						<input
							id="pg-std"
							type="text"
							value={standardCode}
							onChange={(e) => setStandardCode(e.target.value)}
							placeholder="MA.5.FR.1.1"
							className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="pg-title"
							className="text-[10px] text-slate-500 uppercase tracking-wide"
						>
							Topic (optional)
						</label>
						<input
							id="pg-title"
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Adding fractions"
							className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleAdd}
					disabled={saving || !weekOf || !standardCode.trim()}
					className="w-full"
				>
					<PlusIcon className="h-3.5 w-3.5 mr-1" />
					{saving ? "Saving…" : "Add Entry"}
				</Button>
			</div>

			{/* Entry list */}
			{entries.length > 0 && (
				<div className="flex flex-col gap-1.5">
					{entries.map((e) => (
						<div
							key={e.id}
							className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2"
						>
							<span className="text-xs text-slate-500 w-16 shrink-0">
								Wk of {formatWeek(e.weekOf)}
							</span>
							<span className="font-mono text-xs text-amber-400 shrink-0">{e.standardCode}</span>
							{e.title && <span className="text-xs text-slate-400 flex-1 truncate">{e.title}</span>}
							<button
								type="button"
								onClick={() => handleDelete(e.id)}
								className="ml-auto text-slate-700 hover:text-slate-400 transition-colors"
							>
								<XIcon className="h-3.5 w-3.5" />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
