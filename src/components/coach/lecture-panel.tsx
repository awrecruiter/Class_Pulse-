"use client";

import { MicIcon, SquareIcon } from "lucide-react";
import { StandardPicker } from "./standard-picker";

type LecturePanelProps = {
	transcript: string;
	isListening: boolean;
	wordCount: number;
	isSupported: boolean;
	pinnedStandards: string[];
	onStart: () => void;
	onStop: () => void;
	onClear: () => void;
	onStandardsChange: (codes: string[]) => void;
};

export function LecturePanel({
	transcript,
	isListening,
	wordCount,
	isSupported,
	pinnedStandards,
	onStart,
	onStop,
	onClear,
	onStandardsChange,
}: LecturePanelProps) {
	if (!isSupported) {
		return (
			<div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
				Speech recognition is not supported in this browser. Try Chrome or Edge on desktop.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Standard picker */}
			<StandardPicker value={pinnedStandards} onChange={onStandardsChange} />

			{/* Status bar */}
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					{isListening ? (
						<>
							<span className="relative flex h-3 w-3">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
								<span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
							</span>
							<span className="text-sm font-medium text-red-600">Listening...</span>
						</>
					) : (
						<>
							<span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
							<span className="text-sm text-muted-foreground">Not listening</span>
						</>
					)}
				</div>
				<span className="text-xs text-muted-foreground tabular-nums">
					{wordCount.toLocaleString()} / 2,500 words
				</span>
			</div>

			{/* Controls */}
			<div className="flex gap-2">
				{isListening ? (
					<button
						type="button"
						onClick={onStop}
						className="flex items-center gap-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 text-sm font-medium transition-colors"
					>
						<SquareIcon className="h-4 w-4" />
						Stop
					</button>
				) : (
					<button
						type="button"
						onClick={onStart}
						className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium transition-colors"
					>
						<MicIcon className="h-4 w-4" />
						Start Listening
					</button>
				)}
				{transcript && (
					<button
						type="button"
						onClick={onClear}
						className="rounded-lg border border-border bg-background hover:bg-muted px-4 py-2 text-sm font-medium transition-colors"
					>
						Clear
					</button>
				)}
			</div>

			{/* Transcript preview */}
			{transcript ? (
				<div className="rounded-lg border border-border bg-muted/30 p-3 max-h-64 overflow-y-auto">
					<p className="text-xs font-medium text-muted-foreground mb-2">Lesson context:</p>
					<p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
						{transcript}
					</p>
				</div>
			) : (
				<div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
					Speak your lesson — the transcript will appear here.
					<br />
					<span className="text-xs">Rolling 15-minute buffer. Never saved.</span>
				</div>
			)}
		</div>
	);
}
