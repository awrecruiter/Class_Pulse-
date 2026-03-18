"use client";

import { useEffect, useState } from "react";

type FontSize = "sm" | "base" | "lg";

export function AccessibilityToolbar() {
	const [open, setOpen] = useState(false);
	const [fontSize, setFontSize] = useState<FontSize>("base");
	const [highContrast, setHighContrast] = useState(false);

	// Load persisted preferences on mount
	useEffect(() => {
		try {
			const storedFont = localStorage.getItem("student_font_size") as FontSize | null;
			if (storedFont && ["sm", "base", "lg"].includes(storedFont)) {
				setFontSize(storedFont);
			}
			const storedHc = localStorage.getItem("student_high_contrast");
			if (storedHc === "true") {
				setHighContrast(true);
			}
		} catch {
			// localStorage unavailable
		}
	}, []);

	// Apply font size attribute
	useEffect(() => {
		document.documentElement.setAttribute("data-student-font", fontSize);
		try {
			localStorage.setItem("student_font_size", fontSize);
		} catch {
			// ignore
		}
	}, [fontSize]);

	// Apply high contrast attribute
	useEffect(() => {
		document.documentElement.setAttribute("data-student-hc", String(highContrast));
		try {
			localStorage.setItem("student_high_contrast", String(highContrast));
		} catch {
			// ignore
		}
	}, [highContrast]);

	return (
		<div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
			{open && (
				<div className="rounded-2xl bg-white dark:bg-[#1a1d27] border border-slate-200 dark:border-white/10 shadow-xl p-4 flex flex-col gap-3 min-w-[160px]">
					{/* Font size controls */}
					<div className="flex flex-col gap-1.5">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
							Text size
						</p>
						<div className="flex gap-1.5">
							{(["sm", "base", "lg"] as FontSize[]).map((size) => (
								<button
									key={size}
									type="button"
									onClick={() => setFontSize(size)}
									className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${
										fontSize === size
											? "bg-indigo-500 text-white"
											: "bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/12"
									}`}
								>
									A<span className="sr-only">{size}</span>
								</button>
							))}
						</div>
						<div className="flex gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 justify-around">
							<span>Small</span>
							<span>Normal</span>
							<span>Large</span>
						</div>
					</div>

					{/* High contrast toggle */}
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
							High contrast
						</p>
						<button
							type="button"
							role="switch"
							aria-checked={highContrast}
							onClick={() => setHighContrast((hc) => !hc)}
							className={`relative h-6 w-10 rounded-full transition-colors ${
								highContrast ? "bg-indigo-500" : "bg-slate-200 dark:bg-white/15"
							}`}
						>
							<span
								className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
									highContrast ? "translate-x-4" : "translate-x-0.5"
								}`}
							/>
						</button>
					</div>
				</div>
			)}

			{/* Toggle button */}
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label="Accessibility options"
				className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-[#1a1d27] border border-slate-200 dark:border-white/10 shadow-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
			>
				<span className="text-base" aria-hidden>
					{open ? "✕" : "Aa"}
				</span>
			</button>
		</div>
	);
}
