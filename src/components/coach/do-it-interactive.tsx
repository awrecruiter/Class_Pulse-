"use client";

import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DrawCanvas } from "@/components/coach/draw-canvas";

type DoItInteractiveProps = { instructions: string };

export function DoItInteractive({ instructions }: DoItInteractiveProps) {
	const steps = instructions
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);

	const [checked, setChecked] = useState<boolean[]>(() => steps.map(() => false));
	const [timeLeft, setTimeLeft] = useState<number | null>(null);
	const [running, setRunning] = useState(false);

	useEffect(() => {
		if (!running) return;
		const interval = setInterval(() => {
			setTimeLeft((t) => {
				if (t === null || t <= 1) {
					setRunning(false);
					clearInterval(interval);
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => clearInterval(interval);
	}, [running]);

	function startTimer() {
		setTimeLeft(30);
		setRunning(true);
	}

	function stopTimer() {
		setRunning(false);
	}

	return (
		<div className="flex flex-col gap-2">
			<ul className="flex flex-col gap-1.5">
				{steps.map((step, i) => (
					<li key={step} className="flex items-start gap-2">
						<button
							type="button"
							onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
							className={`mt-0.5 shrink-0 flex h-4 w-4 rounded border items-center justify-center transition-colors ${
								checked[i]
									? "bg-primary border-primary text-primary-foreground"
									: "border-border bg-background"
							}`}
							aria-label={checked[i] ? "Uncheck" : "Check"}
						>
							{checked[i] && <CheckIcon className="h-2.5 w-2.5" />}
						</button>
						<span
							className={`text-sm leading-snug ${
								checked[i] ? "line-through text-muted-foreground" : "text-foreground"
							}`}
						>
							{step}
						</span>
					</li>
				))}
			</ul>

			<div className="flex items-center gap-2 mt-2">
				{timeLeft === null ? (
					<button
						type="button"
						onClick={startTimer}
						className="rounded px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
					>
						▶ Start 30s
					</button>
				) : timeLeft === 0 ? (
					<span className="text-sm font-medium text-destructive">Time's up!</span>
				) : (
					<>
						<span className="font-mono text-sm font-semibold text-primary tabular-nums">
							{timeLeft}s
						</span>
						<button
							type="button"
							onClick={stopTimer}
							className="text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							Stop
						</button>
					</>
				)}
			</div>

			<div className="mt-3 pt-3 border-t border-orange-200/60">
				<p className="text-xs text-muted-foreground mb-1.5">Sketch it out:</p>
				<DrawCanvas />
			</div>
		</div>
	);
}
