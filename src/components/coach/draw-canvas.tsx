"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#d97706", "#000000"];

export function DrawCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [color, setColor] = useState("#1d4ed8");
	const [isErasing, setIsErasing] = useState(false);
	const [isDrawing, setIsDrawing] = useState(false);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const w = canvas.parentElement?.clientWidth ?? 280;
		canvas.width = w;
		canvas.height = 200;

		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.lineWidth = 4;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, w, 200);
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
		const { x, y } = getPoint(e);
		ctx.strokeStyle = isErasing ? "#ffffff" : color;
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
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!ctx) return;
		ctx.closePath();
	}

	function clearCanvas() {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!ctx || !canvas) return;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 flex-wrap">
				{COLORS.map((c) => (
					<button
						key={c}
						type="button"
						onClick={() => {
							setColor(c);
							setIsErasing(false);
						}}
						className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
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
					className={`rounded px-2 py-0.5 text-xs transition-colors ${
						isErasing
							? "bg-muted ring-2 ring-border"
							: "bg-background border border-border hover:bg-muted/50"
					}`}
				>
					Erase
				</button>
				<button
					type="button"
					onClick={clearCanvas}
					className="rounded px-2 py-0.5 text-xs bg-background border border-border hover:bg-muted/50 transition-colors"
				>
					Clear
				</button>
			</div>
			<canvas
				ref={canvasRef}
				className="w-full rounded border border-border touch-none cursor-crosshair"
				style={{ height: 200 }}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerUp}
			/>
		</div>
	);
}
