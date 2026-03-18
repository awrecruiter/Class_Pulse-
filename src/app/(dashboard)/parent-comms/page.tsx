"use client";

import { useEffect, useState } from "react";
import { ParentCommsPanel } from "@/components/coach/parent-comms-panel";

type ClassItem = { id: string; label: string };

export default function ParentCommsPage() {
	const [classes, setClasses] = useState<ClassItem[]>([]);
	const [selectedClassId, setSelectedClassId] = useState<string>("");
	const [students, setStudents] = useState<
		Array<{
			rosterId: string;
			displayName: string;
			firstInitial: string;
			lastInitial: string;
			firstName: string | null;
		}>
	>([]);

	useEffect(() => {
		fetch("/api/classes")
			.then((r) => (r.ok ? r.json() : { classes: [] }))
			.then((j) => {
				const list: ClassItem[] = j.classes ?? [];
				setClasses(list);
				if (list.length > 0) {
					const saved = localStorage.getItem("activeClassId");
					const match = list.find((c) => c.id === saved);
					setSelectedClassId(match ? match.id : list[0].id);
				}
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		if (!selectedClassId) return;
		fetch(`/api/classes/${selectedClassId}/roster-overview`)
			.then((r) => (r.ok ? r.json() : { students: [] }))
			.then((j) => setStudents(j.students ?? []))
			.catch(() => {});
	}, [selectedClassId]);

	return (
		<div className="h-[calc(100vh-3.5rem)] bg-[#0d1525] flex flex-col overflow-hidden">
			{/* Header */}
			<div className="shrink-0 border-b border-slate-800 px-4 py-2 flex items-center gap-3">
				<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
					Parent Comms
				</p>
				{classes.length > 0 && (
					<select
						value={selectedClassId}
						onChange={(e) => {
							setSelectedClassId(e.target.value);
							localStorage.setItem("activeClassId", e.target.value);
						}}
						className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1"
					>
						{classes.map((c) => (
							<option key={c.id} value={c.id}>
								{c.label}
							</option>
						))}
					</select>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 min-h-0 overflow-y-scroll">
				{selectedClassId ? (
					<ParentCommsPanel classId={selectedClassId} students={students} />
				) : (
					<div className="flex items-center justify-center h-full text-slate-600 text-sm">
						No classes found
					</div>
				)}
			</div>
		</div>
	);
}
