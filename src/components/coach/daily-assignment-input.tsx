"use client";

import { CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getTodayPacing } from "@/lib/pacing";

interface Props {
	classId: string;
}

export function DailyAssignmentInput({ classId }: Props) {
	const [value, setValue] = useState("");
	const [saved, setSaved] = useState(false);
	const [saving, setSaving] = useState(false);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const today = new Date().toISOString().slice(0, 10);

	// Derive pacing suggestion once (client-safe — uses local date)
	const pacingSuggestion = getTodayPacing()?.homeworkSuggestion ?? null;

	useEffect(() => {
		fetch(`/api/classes/${classId}/assignment?date=${today}`)
			.then((r) => (r.ok ? r.json() : { assignment: null }))
			.then((j) => {
				if (j.assignment?.content) setValue(j.assignment.content);
			})
			.catch(() => {});
	}, [classId, today]);

	async function save(content: string) {
		if (!content.trim()) return;
		setSaving(true);
		try {
			await fetch(`/api/classes/${classId}/assignment`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ date: today, content: content.trim() }),
			});
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} catch {
			// non-fatal
		} finally {
			setSaving(false);
		}
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		setValue(e.target.value);
		setSaved(false);
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => save(e.target.value), 1500);
	}

	return (
		<div className="px-1 pb-1">
			<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 px-0.5">
				Tonight&apos;s Practice
			</p>
			<div className="flex items-center gap-1.5">
				<input
					type="text"
					value={value}
					onChange={handleChange}
					onBlur={() => save(value)}
					placeholder={pacingSuggestion ?? "e.g. Lesson 14.1 Practice, pp. 657–658"}
					maxLength={500}
					className="flex-1 min-w-0 rounded-lg bg-slate-800/60 border border-slate-700/60 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
				/>
				{saved && !saving && (
					<span className="shrink-0 text-emerald-400">
						<CheckIcon className="h-3.5 w-3.5" />
					</span>
				)}
			</div>
			{pacingSuggestion && !value && (
				<button
					type="button"
					onClick={() => {
						setValue(pacingSuggestion);
						save(pacingSuggestion);
					}}
					className="mt-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
				>
					Use pacing guide suggestion ↑
				</button>
			)}
		</div>
	);
}
