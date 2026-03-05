"use client";

import { useState } from "react";

type Props = {
	sessionId: string;
	noiseLevel?: number; // 0–100 from teacher ambient monitor
};

export function CorrectionRequest({ sessionId, noiseLevel = 0 }: Props) {
	const [sent, setSent] = useState(false);
	const [context, setContext] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [loading, setLoading] = useState(false);

	const waveActive = noiseLevel > 20;
	const bars = [
		{ id: "b1", h: 0.4 },
		{ id: "b2", h: 0.7 },
		{ id: "b3", h: 1.0 },
		{ id: "b4", h: 0.7 },
		{ id: "b5", h: 0.4 },
	];

	async function handleSubmit() {
		setLoading(true);
		try {
			await fetch(`/api/sessions/${sessionId}/correction-requests`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ context }),
			});
			setSent(true);
			setShowForm(false);
		} catch {
			// silently fail
		} finally {
			setLoading(false);
		}
	}

	if (sent) {
		return (
			<div className="flex flex-col items-center gap-2 py-4">
				<p className="text-4xl">🙋</p>
				<p className="text-sm font-semibold text-green-700">Your teacher has been notified!</p>
				<p className="text-xs text-muted-foreground">Hang tight — help is coming.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-3 py-4">
			{/* Teacher activity waveform */}
			<div className="flex items-end gap-0.5 h-8">
				{bars.map((bar) => (
					<div
						key={bar.id}
						className={`w-1.5 rounded-full transition-all duration-150 ${waveActive ? "bg-blue-400" : "bg-gray-200"}`}
						style={{
							height: waveActive
								? `${Math.round(bar.h * Math.max(8, (noiseLevel / 100) * 28))}px`
								: "4px",
						}}
					/>
				))}
			</div>
			<p className="text-xs text-muted-foreground">
				{waveActive ? "Teacher is speaking" : "Waiting for teacher"}
			</p>

			{!showForm ? (
				<button
					type="button"
					onClick={() => setShowForm(true)}
					className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition-transform"
				>
					🆘 I&apos;m Lost
				</button>
			) : (
				<div className="flex flex-col gap-2 w-full max-w-xs">
					<textarea
						value={context}
						onChange={(e) => setContext(e.target.value)}
						placeholder="What are you stuck on? (optional)"
						rows={2}
						className="resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setShowForm(false)}
							className="flex-1 rounded-xl border border-border py-2 text-sm text-muted-foreground"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={loading}
							className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-60"
						>
							Send
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
