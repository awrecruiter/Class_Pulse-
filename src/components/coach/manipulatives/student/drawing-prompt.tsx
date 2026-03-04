"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#d97706", "#000000"];

type Phase = "draw" | "submitting" | "feedback";

type Props = {
	sessionId: string;
	standardCode: string;
	standardHint?: string; // short description shown to student
	onDone: () => void;
};

export function StudentDrawingPrompt({ sessionId, standardCode, standardHint, onDone }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [color, setColor] = useState("#1d4ed8");
	const [isErasing, setIsErasing] = useState(false);
	const [isDrawing, setIsDrawing] = useState(false);
	const [phase, setPhase] = useState<Phase>("draw");
	const [feedback, setFeedback] = useState<{
		analysisType: string;
		studentFeedback: string;
	} | null>(null);
	const [hasDrawn, setHasDrawn] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const w = canvas.parentElement?.clientWidth ?? 280;
		canvas.width = w;
		canvas.height = 220;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.lineWidth = 5;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, w, 220);
	}, []);

	function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
		const canvas = canvasRef.current;
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY,
		};
	}

	function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.setPointerCapture(e.pointerId);
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		setIsDrawing(true);
		setHasDrawn(true);
		const { x, y } = getPoint(e);
		ctx.strokeStyle = isErasing ? "#ffffff" : color;
		ctx.lineWidth = isErasing ? 20 : 5;
		ctx.beginPath();
		ctx.moveTo(x, y);
	}

	function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
		if (!isDrawing) return;
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!ctx) return;
		const { x, y } = getPoint(e);
		ctx.lineTo(x, y);
		ctx.stroke();
	}

	function handlePointerUp() {
		setIsDrawing(false);
		const ctx = canvasRef.current?.getContext("2d");
		if (ctx) ctx.closePath();
	}

	function clearCanvas() {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!ctx || !canvas) return;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		setHasDrawn(false);
	}

	async function submitDrawing() {
		const canvas = canvasRef.current;
		if (!canvas || !hasDrawn) return;
		setPhase("submitting");
		setError("");

		// Export as base64 PNG (remove the data:image/png;base64, prefix)
		const dataUrl = canvas.toDataURL("image/png");
		const imageBase64 = dataUrl.split(",")[1] ?? "";

		try {
			const res = await fetch(`/api/sessions/${sessionId}/drawing`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ imageBase64, standardCode }),
			});
			if (!res.ok) {
				const json = await res.json();
				throw new Error((json as { error?: string }).error ?? "Failed");
			}
			const data = (await res.json()) as { analysisType: string; studentFeedback: string };
			setFeedback(data);
			setPhase("feedback");
		} catch {
			setError("Couldn't analyze — try again");
			setPhase("draw");
		}
	}

	// ── Feedback screen ───────────────────────────────────────────────────────
	if (phase === "feedback" && feedback) {
		const isCorrect = feedback.analysisType === "correct";
		const isPartial = feedback.analysisType === "partial";
		const emoji = isCorrect ? "🌟" : isPartial ? "🤏" : "🔍";
		const bgClass = isCorrect
			? "bg-green-50 border-green-200"
			: isPartial
				? "bg-yellow-50 border-yellow-200"
				: "bg-orange-50 border-orange-200";
		const textClass = isCorrect
			? "text-green-700"
			: isPartial
				? "text-yellow-700"
				: "text-orange-700";

		return (
			<div className="flex flex-col gap-4 py-2">
				<div className="text-center">
					<div className="text-5xl mb-2 animate-bounce">{emoji}</div>
					<p className="text-base font-bold text-gray-800">
						{isCorrect ? "Great drawing!" : isPartial ? "Nice try!" : "Interesting!"}
					</p>
				</div>
				<div className={`rounded-xl border px-4 py-3 ${bgClass}`}>
					<p className={`text-sm font-medium leading-relaxed ${textClass}`}>
						{feedback.studentFeedback}
					</p>
				</div>
				<button
					type="button"
					onClick={onDone}
					className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white hover:bg-indigo-600 active:scale-95 transition-all"
				>
					Done ✓
				</button>
			</div>
		);
	}

	// ── Drawing screen ────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col gap-3">
			{/* Prompt */}
			<div className="text-center">
				<p className="text-sm font-bold text-gray-800">✏️ Draw what you know!</p>
				{standardHint && (
					<p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{standardHint}</p>
				)}
			</div>

			{/* Color controls */}
			<div className="flex items-center gap-2 flex-wrap">
				{COLORS.map((c) => (
					<button
						key={c}
						type="button"
						onClick={() => {
							setColor(c);
							setIsErasing(false);
						}}
						className="h-6 w-6 rounded-full border-2 transition-transform active:scale-90"
						style={{
							backgroundColor: c,
							borderColor: color === c && !isErasing ? "#0f172a" : "transparent",
						}}
						aria-label={`Color ${c}`}
					/>
				))}
				<button
					type="button"
					onClick={() => setIsErasing((e) => !e)}
					className={`rounded px-2 py-0.5 text-xs transition-colors ml-1 ${
						isErasing ? "bg-gray-200 ring-2 ring-gray-400" : "bg-gray-100 hover:bg-gray-200"
					}`}
				>
					Erase
				</button>
				<button
					type="button"
					onClick={clearCanvas}
					className="rounded px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
				>
					Clear
				</button>
			</div>

			{/* Canvas */}
			<canvas
				ref={canvasRef}
				className="w-full rounded-xl border-2 border-indigo-200 touch-none cursor-crosshair bg-white"
				style={{ height: 220 }}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerUp}
			/>

			{error && <p className="text-center text-xs text-red-500">{error}</p>}

			<div className="flex gap-2">
				<button
					type="button"
					onClick={submitDrawing}
					disabled={!hasDrawn || phase === "submitting"}
					className="flex-1 rounded-xl bg-purple-500 py-3 text-sm font-bold text-white hover:bg-purple-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow"
				>
					{phase === "submitting" ? "🔍 Checking..." : "Submit my drawing! 🚀"}
				</button>
				<button
					type="button"
					onClick={onDone}
					className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
				>
					Skip
				</button>
			</div>
		</div>
	);
}
