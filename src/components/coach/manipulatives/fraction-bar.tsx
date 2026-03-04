"use client";

import type { ReactNode } from "react";

type Bar = { parts: number; filled: number; label: string };

type FractionBarProps = {
	bars: Bar[];
};

const BAR_W = 220;
const BAR_H = 28;
const GAP = 8;
const LABEL_X = BAR_W + 8;

export function FractionBar({ bars }: FractionBarProps) {
	const svgH = bars.length * BAR_H + Math.max(0, bars.length - 1) * GAP;

	const barGroups: ReactNode[] = bars.map((bar, i) => {
		const y = i * (BAR_H + GAP);
		const cellW = BAR_W / bar.parts;
		const delay = `${i * 200}ms`;

		// Build filled rects and dividers with for loops
		const fillRects: ReactNode[] = [];
		for (let j = 0; j < bar.filled; j++) {
			fillRects.push(
				<rect key={`fill-${j}`} x={j * cellW} y={y} width={cellW} height={BAR_H} fill="#bfdbfe" />,
			);
		}

		const dividers: ReactNode[] = [];
		for (let j = 1; j < bar.parts; j++) {
			dividers.push(
				<line
					key={`div-${j}`}
					x1={j * cellW}
					y1={y}
					x2={j * cellW}
					y2={y + BAR_H}
					stroke="#9ca3af"
					strokeWidth={1}
				/>,
			);
		}

		return (
			<g
				key={bar.label}
				style={{ opacity: 0, animation: "fadeIn 0.3s ease forwards", animationDelay: delay }}
			>
				<rect x={0} y={y} width={BAR_W} height={BAR_H} fill="#f3f4f6" rx={2} />
				{fillRects}
				{dividers}
				<rect
					x={0}
					y={y}
					width={BAR_W}
					height={BAR_H}
					fill="none"
					stroke="#9ca3af"
					strokeWidth={1}
					rx={2}
				/>
				<text
					x={LABEL_X}
					y={y + BAR_H / 2 + 4}
					fontSize={12}
					fill="#374151"
					fontFamily="system-ui, sans-serif"
				>
					{bar.label}
				</text>
			</g>
		);
	});

	return (
		<>
			<style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
			<svg width={300} height={svgH} viewBox={`0 0 300 ${svgH}`} aria-hidden="true">
				{barGroups}
			</svg>
		</>
	);
}
