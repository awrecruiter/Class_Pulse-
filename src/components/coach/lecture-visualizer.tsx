"use client";

import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import type { VisualResponse } from "@/app/api/coach/visualize/route";

type Props = {
	visual: VisualResponse | null;
	loading: boolean;
};

export function LectureVisualizer({ visual, loading }: Props) {
	const [collapsed, setCollapsed] = useState(false);

	if (!loading && !visual) return null;

	return (
		<div className="rounded-lg border border-violet-200 bg-violet-50/60 overflow-hidden">
			{/* Header */}
			<button
				type="button"
				onClick={() => setCollapsed((c) => !c)}
				className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-violet-100/50 transition-colors"
			>
				<div className="flex items-center gap-2">
					<SparklesIcon className="h-3.5 w-3.5 text-violet-500" />
					<span className="text-xs font-semibold text-violet-700">
						{loading ? "Reading your lesson..." : (visual?.concept ?? "Concept Visual")}
					</span>
				</div>
				{!loading &&
					(collapsed ? (
						<ChevronDownIcon className="h-3.5 w-3.5 text-violet-400" />
					) : (
						<ChevronUpIcon className="h-3.5 w-3.5 text-violet-400" />
					))}
			</button>

			{/* Body */}
			{!collapsed && (
				<div className="px-3 pb-3 flex flex-col gap-3">
					{loading ? (
						<div className="flex flex-col gap-2">
							<div className="h-3 w-3/4 rounded bg-violet-200/60 animate-pulse" />
							<div className="h-3 w-1/2 rounded bg-violet-200/60 animate-pulse" />
							<div className="h-3 w-2/3 rounded bg-violet-200/60 animate-pulse" />
						</div>
					) : visual ? (
						<>
							{/* Whiteboard visual */}
							<pre className="font-mono text-xs text-violet-900 leading-relaxed bg-white/70 rounded-md px-3 py-2.5 border border-violet-100 whitespace-pre-wrap overflow-x-auto">
								{visual.visual}
							</pre>

							{/* Key points */}
							<div className="flex flex-col gap-1">
								{visual.keyPoints.map((point, i) => (
									<div key={point} className="flex items-start gap-2">
										<span className="text-xs font-bold text-violet-400 shrink-0 mt-0.5">
											{i + 1}.
										</span>
										<span className="text-xs text-violet-800 leading-snug">{point}</span>
									</div>
								))}
							</div>
						</>
					) : null}
				</div>
			)}
		</div>
	);
}
