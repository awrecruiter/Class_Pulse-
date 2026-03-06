"use client";

import { ChevronDownIcon, ChevronUpIcon, FilmIcon, SparklesIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { VisualResponse } from "@/app/api/coach/visualize/route";

type Props = {
	visual: VisualResponse | null;
	loading: boolean;
	transcript?: string;
};

export function LectureVisualizer({ visual, loading, transcript }: Props) {
	const [collapsed, setCollapsed] = useState(false);
	const [animState, setAnimState] = useState<"idle" | "rendering" | "ready" | "error">("idle");
	const [videoUrl, setVideoUrl] = useState<string | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);

	if (!loading && !visual) return null;

	async function handleAnimate() {
		if (!visual?.concept || animState === "rendering") return;
		setAnimState("rendering");
		setVideoUrl(null);
		try {
			const res = await fetch("/api/coach/animate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ concept: visual.concept, transcript: transcript ?? "" }),
			});
			const data = await res.json();
			if (!res.ok || !data.videoUrl) throw new Error(data.error ?? "Render failed");
			setVideoUrl(data.videoUrl);
			setAnimState("ready");
			// Auto-play once loaded
			setTimeout(() => videoRef.current?.play(), 100);
		} catch {
			setAnimState("error");
		}
	}

	return (
		<div className="rounded-lg border border-violet-500/30 bg-slate-800/60 overflow-hidden">
			{/* Header */}
			<button
				type="button"
				onClick={() => setCollapsed((c) => !c)}
				className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-700/40 transition-colors"
			>
				<div className="flex items-center gap-2">
					<SparklesIcon className="h-3.5 w-3.5 text-violet-400" />
					<span className="text-xs font-semibold text-violet-300">
						{loading ? "Reading your lesson..." : (visual?.concept ?? "Concept Visual")}
					</span>
				</div>
				{!loading &&
					(collapsed ? (
						<ChevronDownIcon className="h-3.5 w-3.5 text-violet-500" />
					) : (
						<ChevronUpIcon className="h-3.5 w-3.5 text-violet-500" />
					))}
			</button>

			{/* Body */}
			{!collapsed && (
				<div className="px-3 pb-3 flex flex-col gap-3">
					{loading ? (
						<div className="flex flex-col gap-2">
							<div className="h-3 w-3/4 rounded bg-violet-800/40 animate-pulse" />
							<div className="h-3 w-1/2 rounded bg-violet-800/40 animate-pulse" />
							<div className="h-3 w-2/3 rounded bg-violet-800/40 animate-pulse" />
						</div>
					) : visual ? (
						<>
							{/* Whiteboard visual */}
							<pre className="font-mono text-xs text-violet-200 leading-relaxed bg-slate-900/60 rounded-md px-3 py-2.5 border border-violet-800/40 whitespace-pre-wrap overflow-x-auto">
								{visual.visual}
							</pre>

							{/* Key points */}
							<div className="flex flex-col gap-1">
								{visual.keyPoints.map((point, i) => (
									<div key={point} className="flex items-start gap-2">
										<span className="text-xs font-bold text-violet-500 shrink-0 mt-0.5">
											{i + 1}.
										</span>
										<span className="text-xs text-slate-300 leading-snug">{point}</span>
									</div>
								))}
							</div>

							{/* Manim animation */}
							<div className="flex flex-col gap-2">
								{animState !== "ready" && (
									<button
										type="button"
										onClick={handleAnimate}
										disabled={animState === "rendering"}
										className="flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 text-xs font-semibold bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
									>
										<FilmIcon className="h-3 w-3" />
										{animState === "rendering"
											? "Rendering animation (~15s)…"
											: animState === "error"
												? "Retry animation"
												: "Animate it"}
									</button>
								)}

								{animState === "ready" && videoUrl && (
									<div className="rounded-md overflow-hidden border border-violet-800/40">
										<video
											ref={videoRef}
											src={videoUrl}
											controls
											loop
											className="w-full max-h-48 bg-black"
										>
											<track kind="captions" />
										</video>
									</div>
								)}
							</div>
						</>
					) : null}
				</div>
			)}
		</div>
	);
}
