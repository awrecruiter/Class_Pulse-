"use client";

import { useState } from "react";
import type { CoachResponse } from "@/lib/ai/coach";
import { StudentAreaModel } from "./area-model";
import { StudentDrawingPrompt } from "./drawing-prompt";
import { StudentFractionBar } from "./fraction-bar";
import { StudentNumberLine } from "./number-line";
import { StudentQuiz } from "./quiz";

type Spec = CoachResponse["manipulative"];

type Props = {
	spec: Spec;
	sessionId: string;
	standardCode?: string;
	onDismiss?: () => void;
};

type Phase = "manipulative" | "quiz" | "drawing";

export function StudentManipulative({ spec, sessionId, standardCode, onDismiss }: Props) {
	const [phase, setPhase] = useState<Phase>("manipulative");

	if (!spec) return null;

	let visual: React.ReactNode = null;

	if (spec.type === "fraction-bar" && spec.bars) {
		visual = <StudentFractionBar bars={spec.bars} />;
	} else if (spec.type === "area-model" && spec.rows !== undefined && spec.cols !== undefined) {
		visual = (
			<StudentAreaModel
				rows={spec.rows}
				cols={spec.cols}
				shadedRows={spec.shadedRows ?? 0}
				shadedCols={spec.shadedCols ?? 0}
			/>
		);
	} else if (
		spec.type === "number-line" &&
		spec.min !== undefined &&
		spec.max !== undefined &&
		spec.markers
	) {
		visual = (
			<StudentNumberLine
				min={spec.min}
				max={spec.max}
				markers={spec.markers}
				highlightIndex={spec.highlightIndex}
			/>
		);
	}

	if (!visual) return null;

	const headerEmoji = phase === "quiz" ? "🧠" : phase === "drawing" ? "✏️" : "🧮";
	const headerLabel =
		phase === "quiz"
			? "Test yourself!"
			: phase === "drawing"
				? "Draw it!"
				: "Your teacher sent you this!";

	return (
		<div className="w-full rounded-2xl bg-white/95 shadow-2xl overflow-hidden border-2 border-indigo-300">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 bg-indigo-600">
				<div className="flex items-center gap-2">
					<span className="text-xl">{headerEmoji}</span>
					<p className="text-sm font-bold text-white">{headerLabel}</p>
				</div>
				{onDismiss && phase === "manipulative" && (
					<button
						type="button"
						onClick={onDismiss}
						className="text-white/70 hover:text-white text-sm font-medium transition-colors"
					>
						Close ✕
					</button>
				)}
			</div>

			{/* Body */}
			<div className="p-4 flex flex-col gap-3">
				{phase === "quiz" ? (
					<StudentQuiz
						sessionId={sessionId}
						manipType={spec.type}
						standardCode={standardCode}
						onClose={() => {
							// After quiz: offer drawing if we have a standard code
							if (standardCode) {
								setPhase("drawing");
							} else {
								setPhase("manipulative");
							}
						}}
					/>
				) : phase === "drawing" && standardCode ? (
					<StudentDrawingPrompt
						sessionId={sessionId}
						standardCode={standardCode}
						standardHint="Show what you know about this concept"
						onDone={() => setPhase("manipulative")}
					/>
				) : (
					<>
						{visual}
						{spec.caption && (
							<p className="text-xs text-center text-gray-500 leading-relaxed border-t border-gray-100 pt-2">
								{spec.caption}
							</p>
						)}
						<button
							type="button"
							onClick={() => setPhase("quiz")}
							className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white hover:bg-indigo-600 active:scale-95 transition-all shadow"
						>
							🧠 Test yourself! →
						</button>
					</>
				)}
			</div>
		</div>
	);
}
