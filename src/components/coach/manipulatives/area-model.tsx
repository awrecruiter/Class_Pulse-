"use client";

import type { ReactNode } from "react";

type AreaModelProps = {
	rows: number;
	cols: number;
	shadedRows: number;
	shadedCols: number;
};

const CELL = 40;

export function AreaModel({ rows, cols, shadedRows, shadedCols }: AreaModelProps) {
	const w = cols * CELL;
	const h = rows * CELL;

	// Build rect layers with for loops (avoids noArrayIndexKey lint rule)
	const baseRects: ReactNode[] = [];
	const rowRects: ReactNode[] = [];
	const colRects: ReactNode[] = [];
	const overlapRects: ReactNode[] = [];

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = c * CELL;
			const y = r * CELL;
			baseRects.push(
				<rect
					key={`g-${r}-${c}`}
					x={x}
					y={y}
					width={CELL}
					height={CELL}
					fill="white"
					stroke="#d1d5db"
					strokeWidth={1}
				/>,
			);
			if (r < shadedRows) {
				rowRects.push(
					<rect
						key={`r-${r}-${c}`}
						x={x}
						y={y}
						width={CELL}
						height={CELL}
						fill="#dbeafe"
						stroke="#d1d5db"
						strokeWidth={1}
						style={{ opacity: 0, animation: "fadeIn 0.3s ease forwards", animationDelay: "300ms" }}
					/>,
				);
			}
			if (c < shadedCols) {
				colRects.push(
					<rect
						key={`c-${r}-${c}`}
						x={x}
						y={y}
						width={CELL}
						height={CELL}
						fill="#ffedd5"
						stroke="#d1d5db"
						strokeWidth={1}
						style={{ opacity: 0, animation: "fadeIn 0.3s ease forwards", animationDelay: "600ms" }}
					/>,
				);
			}
			if (r < shadedRows && c < shadedCols) {
				overlapRects.push(
					<rect
						key={`o-${r}-${c}`}
						x={x}
						y={y}
						width={CELL}
						height={CELL}
						fill="#c4b5fd"
						stroke="#d1d5db"
						strokeWidth={1}
						style={{ opacity: 0, animation: "fadeIn 0.3s ease forwards", animationDelay: "900ms" }}
					/>,
				);
			}
		}
	}

	return (
		<>
			<style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
			<svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
				{baseRects}
				{rowRects}
				{colRects}
				{overlapRects}
			</svg>
		</>
	);
}
