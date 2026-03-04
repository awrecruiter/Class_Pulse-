"use client";

import { useState } from "react";

type Marker = { value: number; label: string };

type Props = {
	min: number;
	max: number;
	markers: Marker[];
	highlightIndex?: number;
};

export function StudentNumberLine({ min, max, markers, highlightIndex }: Props) {
	const [selected, setSelected] = useState<number>(highlightIndex ?? -1);

	const range = max - min;

	return (
		<div className="flex flex-col gap-4 select-none">
			<p className="text-sm font-semibold text-gray-700 text-center">
				Tap a point to place it on the number line
			</p>

			{/* Visual number line */}
			<div className="relative mx-4" style={{ height: 60 }}>
				{/* Line */}
				<div className="absolute left-0 right-0 top-7 h-0.5 bg-gray-400 rounded-full" />
				{/* End caps */}
				<div className="absolute left-0 top-5 w-0.5 h-4 bg-gray-400" />
				<div className="absolute right-0 top-5 w-0.5 h-4 bg-gray-400" />

				{/* Markers */}
				{markers.map((m, i) => {
					const pct = ((m.value - min) / range) * 100;
					const isSelected = selected === i;
					return (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: stable marker indices
							key={i}
							type="button"
							onClick={() => setSelected(i)}
							className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5 transition-all duration-200"
							style={{ left: `${pct}%`, top: 0 }}
							aria-label={`Select ${m.label}`}
						>
							{/* Point */}
							<div
								className={`rounded-full border-2 transition-all duration-200 ${
									isSelected
										? "w-6 h-6 bg-violet-600 border-violet-600 shadow-lg shadow-violet-300"
										: "w-4 h-4 bg-white border-gray-400 hover:border-violet-400"
								}`}
								style={{ marginTop: isSelected ? 14 : 20 }}
							/>
							{/* Label below line */}
							<span
								className={`text-xs font-bold mt-1 transition-colors ${
									isSelected ? "text-violet-700" : "text-gray-500"
								}`}
							>
								{m.label}
							</span>
						</button>
					);
				})}
			</div>

			{/* Selected value display */}
			{selected >= 0 && selected < markers.length ? (
				<div className="text-center">
					<p className="text-2xl font-bold text-violet-700">{markers[selected].label}</p>
					<p className="text-xs text-gray-500 mt-0.5">is your answer</p>
				</div>
			) : (
				<p className="text-sm text-gray-400 text-center">Tap a point above to select it</p>
			)}

			{/* All options as big tap targets for small screens */}
			<div className="flex flex-wrap gap-2 justify-center">
				{markers.map((m, i) => (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: stable marker indices
						key={i}
						type="button"
						onClick={() => setSelected(i)}
						className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all duration-150 active:scale-95 ${
							selected === i
								? "bg-violet-600 border-violet-600 text-white shadow-md"
								: "bg-gray-50 border-gray-200 text-gray-700 hover:border-violet-300"
						}`}
					>
						{m.label}
					</button>
				))}
			</div>
		</div>
	);
}
