"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type ClassRow = {
	id: string;
	label: string;
	periodTime: string | null;
};

export function CockpitClassPicker({
	classes,
	initialClassId,
}: {
	classes: ClassRow[];
	initialClassId: string | null;
}) {
	const [selectedId, setSelectedId] = useState(initialClassId ?? classes[0]?.id ?? null);

	function select(id: string) {
		setSelectedId(id);
		window.dispatchEvent(new CustomEvent("class-selected", { detail: { classId: id } }));
	}

	if (classes.length === 0) {
		return (
			<div className="flex items-center gap-2">
				<span className="text-xs text-slate-500">No classes yet.</span>
				<Link href="/classes" className="text-xs text-indigo-400 hover:text-indigo-300">
					Create one
				</Link>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1.5 flex-wrap">
			{classes.map((cls) => (
				<button
					key={cls.id}
					type="button"
					onClick={() => select(cls.id)}
					className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
						selectedId === cls.id
							? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
							: "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
					}`}
				>
					{cls.label}
					{cls.periodTime && (
						<span className="ml-1.5 opacity-50 font-normal">{cls.periodTime}</span>
					)}
				</button>
			))}
			<Link
				href="/classes"
				className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-300 transition-colors shrink-0"
			>
				Manage
				<ArrowRightIcon className="h-3 w-3" />
			</Link>
		</div>
	);
}
