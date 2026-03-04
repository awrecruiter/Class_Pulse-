"use client";

import { useState } from "react";

type Bar = { parts: number; filled: number; label: string };

type Props = { bars: Bar[] };

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

export function StudentFractionBar({ bars }: Props) {
	// For each bar, track which cells are shaded
	const [shaded, setShaded] = useState<boolean[][]>(() =>
		bars.map((bar) => Array.from({ length: bar.parts }, (_, i) => i < bar.filled)),
	);

	function toggle(barIdx: number, cellIdx: number) {
		setShaded((prev) =>
			prev.map((barCells, bi) =>
				bi === barIdx ? barCells.map((v, ci) => (ci === cellIdx ? !v : v)) : barCells,
			),
		);
	}

	return (
		<div className="flex flex-col gap-4 select-none">
			{bars.map((bar, bi) => {
				const shadedCount = shaded[bi].filter(Boolean).length;
				const color = COLORS[bi % COLORS.length];
				return (
					<div key={bar.label} className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<p className="text-sm font-semibold text-gray-700">{bar.label}</p>
							<p className="text-lg font-bold tabular-nums" style={{ color }}>
								{shadedCount}/{bar.parts}
							</p>
						</div>
						{/* Tappable segments */}
						<div className="flex gap-1.5">
							{shaded[bi].map((isFilled, ci) => (
								<button
									// biome-ignore lint/suspicious/noArrayIndexKey: index is stable for bar cells
									key={ci}
									type="button"
									onClick={() => toggle(bi, ci)}
									className="flex-1 rounded-lg border-2 transition-all duration-150 active:scale-95"
									style={{
										height: 52,
										backgroundColor: isFilled ? color : "#f3f4f6",
										borderColor: isFilled ? color : "#d1d5db",
										boxShadow: isFilled ? `0 2px 8px ${color}44` : "none",
									}}
									aria-label={`Part ${ci + 1} of ${bar.parts} — ${isFilled ? "shaded" : "unshaded"}`}
								/>
							))}
						</div>
						{shadedCount > 0 && (
							<p className="text-xs text-center text-gray-500">
								You colored{" "}
								<span className="font-bold" style={{ color }}>
									{shadedCount} out of {bar.parts}
								</span>{" "}
								parts
							</p>
						)}
					</div>
				);
			})}
		</div>
	);
}
