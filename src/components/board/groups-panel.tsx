"use client";

import { useEffect, useState } from "react";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";
import { GroupsSidebarPanel } from "@/components/coach/groups-sidebar-panel";

export function GroupsBoardPanel() {
	const [classId, setClassId] = useState<string>("");
	const [_students, setStudents] = useState<StudentOverview[]>([]);

	useEffect(() => {
		const id = localStorage.getItem("board-class-id") ?? "";
		setClassId(id);
	}, []);

	useEffect(() => {
		if (!classId) return;
		fetch(`/api/classes/${classId}/roster-overview`)
			.then((r) => r.json())
			.then((j) => setStudents(j.students ?? []))
			.catch(() => {});
	}, [classId]);

	if (!classId) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<p className="text-slate-500 text-sm">No class selected — open the Coach panel first.</p>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col items-center justify-center p-8">
			<p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-6">
				Group Standings
			</p>
			<div className="w-full max-w-3xl">
				<GroupsSidebarPanel classId={classId} />
			</div>
		</div>
	);
}
