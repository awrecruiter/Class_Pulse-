"use client";

import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import type { CoachResponse } from "@/lib/ai/coach";
import { AreaModel } from "./area-model";
import { FractionBar } from "./fraction-bar";
import { NumberLine } from "./number-line";

export function Manipulative({ spec }: { spec: CoachResponse["manipulative"] }) {
	const [replayKey, setReplayKey] = useState(0);

	if (!spec) return null;

	let visual: React.ReactNode = null;

	if (spec.type === "area-model") {
		if (
			spec.rows !== undefined &&
			spec.cols !== undefined &&
			spec.shadedRows !== undefined &&
			spec.shadedCols !== undefined
		) {
			visual = (
				<AreaModel
					rows={spec.rows}
					cols={spec.cols}
					shadedRows={spec.shadedRows}
					shadedCols={spec.shadedCols}
				/>
			);
		}
	} else if (spec.type === "fraction-bar") {
		if (spec.bars) {
			visual = <FractionBar bars={spec.bars} />;
		}
	} else if (spec.type === "number-line") {
		if (spec.min !== undefined && spec.max !== undefined && spec.markers) {
			visual = (
				<NumberLine
					min={spec.min}
					max={spec.max}
					markers={spec.markers}
					highlightIndex={spec.highlightIndex}
				/>
			);
		}
	}

	if (!visual) return null;

	return (
		<div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 flex flex-col gap-2">
			<div className="flex items-center gap-1.5">
				<span className="text-base">👁</span>
				<span className="text-sm font-semibold text-foreground">See It</span>
				<span className="text-xs text-muted-foreground">visual</span>
				<button
					type="button"
					onClick={() => setReplayKey((k) => k + 1)}
					className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
				>
					<RotateCcwIcon className="h-3 w-3" />
					Replay
				</button>
			</div>
			<div key={replayKey}>{visual}</div>
			<p className="text-xs text-muted-foreground">{spec.caption}</p>
		</div>
	);
}
