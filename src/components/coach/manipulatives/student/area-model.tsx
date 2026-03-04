"use client";

import { useState } from "react";

type Props = {
	rows: number;
	cols: number;
	shadedRows: number;
	shadedCols: number;
};

const FILLED_COLOR = "#6366f1";
const EMPTY_COLOR = "#f3f4f6";

export function StudentAreaModel({ rows, cols, shadedRows, shadedCols }: Props) {
	// Start with the teacher's suggested shading, student can tap to modify
	const [cells, setCells] = useState<boolean[][]>(() =>
		Array.from({ length: rows }, (_, r) =>
			Array.from({ length: cols }, (_, c) => r < shadedRows && c < shadedCols),
		),
	);

	function toggle(r: number, c: number) {
		setCells((prev) =>
			prev.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? !cell : cell))),
		);
	}

	const totalFilled = cells.flat().filter(Boolean).length;
	const totalCells = rows * cols;

	// Clamp cell size so grid fits on mobile
	const cellSize = Math.max(32, Math.min(52, Math.floor(280 / cols)));

	return (
		<div className="flex flex-col gap-3 select-none">
			<div className="flex items-center justify-between">
				<p className="text-sm font-semibold text-gray-700">Tap cells to fill them</p>
				<p className="text-lg font-bold text-indigo-600 tabular-nums">
					{totalFilled}/{totalCells}
				</p>
			</div>

			{/* Grid */}
			<div className="flex flex-col gap-1" style={{ width: cols * cellSize + (cols - 1) * 4 }}>
				{cells.map((row, r) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: stable grid indices
					<div key={r} className="flex gap-1">
						{row.map((filled, c) => (
							<button
								// biome-ignore lint/suspicious/noArrayIndexKey: stable grid indices
								key={c}
								type="button"
								onClick={() => toggle(r, c)}
								className="rounded-md border-2 transition-all duration-100 active:scale-90 flex items-center justify-center"
								style={{
									width: cellSize,
									height: cellSize,
									backgroundColor: filled ? FILLED_COLOR : EMPTY_COLOR,
									borderColor: filled ? "#4f46e5" : "#d1d5db",
									boxShadow: filled ? "0 2px 6px #6366f144" : "none",
								}}
								aria-label={`Row ${r + 1}, Column ${c + 1} — ${filled ? "filled" : "empty"}`}
							>
								{filled && <span className="text-white text-xs font-bold select-none">✓</span>}
							</button>
						))}
					</div>
				))}
			</div>

			<p className="text-xs text-center text-gray-500">
				{rows} rows × {cols} columns ={" "}
				<span className="font-bold text-indigo-600">{totalCells}</span> total
				{totalFilled > 0 && (
					<>
						{" "}
						· <span className="font-bold text-indigo-600">{totalFilled}</span> filled
					</>
				)}
			</p>
		</div>
	);
}
