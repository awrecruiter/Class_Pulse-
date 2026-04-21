"use client";

/**
 * Horizontal scrolling waveform visualizer — Voice Memos style.
 * Amplitude-over-time: new bars enter from the right, scroll left.
 * Bars are symmetric (extend above and below center line).
 *
 * Pure synthetic waveform — same pace and appearance as the student SoundcloudWave.
 */

import { useEffect, useRef } from "react";

const BAR_W = 2; // bar width px
const BAR_GAP = 2; // gap between bars px
const STEP = BAR_W + BAR_GAP;
const SAMPLE_MS = 50; // one new bar every 50 ms — locked to student meter pace

interface WaveformMeterProps {
	active: boolean; // true = session is running (drives color + bar generation)
	height?: number;
	className?: string;
	confusionEvents?: number[]; // array of Date.now() timestamps when confusion spiked
}

export function WaveformMeter({
	active,
	height = 56,
	className = "",
	confusionEvents = [],
}: WaveformMeterProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const historyRef = useRef<number[]>([]);
	const rafRef = useRef<number>(0);
	const lastSampleRef = useRef<number>(0);
	const activeRef = useRef(active);
	const confusionEventsRef = useRef<number[]>(confusionEvents);
	activeRef.current = active;
	confusionEventsRef.current = confusionEvents;

	const synthPhaseRef = useRef(0);

	// ── Draw loop ─────────────────────────────────────────────────────────────
	useEffect(() => {
		function draw(ts: number) {
			rafRef.current = requestAnimationFrame(draw);
			const canvas = canvasRef.current;
			if (!canvas) return;
			const c = canvas.getContext("2d");
			if (!c) return;

			const dpr = window.devicePixelRatio || 1;
			const W = canvas.clientWidth;
			const H = canvas.clientHeight;
			if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
				canvas.width = W * dpr;
				canvas.height = H * dpr;
				c.scale(dpr, dpr);
			}

			const barCount = Math.floor(W / STEP) + 1;

			if (ts - lastSampleRef.current >= SAMPLE_MS) {
				lastSampleRef.current = ts;
				let amp = 0;
				if (activeRef.current) {
					synthPhaseRef.current += 0.18;
					const base =
						Math.sin(synthPhaseRef.current) * 0.14 + Math.sin(synthPhaseRef.current * 2.3) * 0.07;
					amp = Math.max(0, 0.18 + base + (Math.random() - 0.5) * 0.12);
				} else {
					const last = historyRef.current.at(-1) ?? 0;
					amp = last * 0.7;
				}
				historyRef.current.push(amp);
				if (historyRef.current.length > barCount) {
					historyRef.current = historyRef.current.slice(-barCount);
				}
			}

			c.clearRect(0, 0, W, H);
			const history = historyRef.current;
			const centerY = H / 2;
			const now = Date.now();

			const confusionSet = new Set<number>();
			for (const evTs of confusionEventsRef.current) {
				const ageMs = now - evTs;
				const barsBack = Math.round(ageMs / SAMPLE_MS);
				const idx = history.length - 1 - barsBack;
				if (idx >= 0 && idx < history.length) confusionSet.add(idx);
			}

			for (let i = 0; i < history.length; i++) {
				const x = W - (history.length - i) * STEP;
				const amp = history[i];
				const halfH = Math.max(1, Math.min(centerY - 2, amp * centerY * 4.5));
				const isConfusion = confusionSet.has(i);
				const alpha = activeRef.current ? 0.85 : 0.35;

				if (isConfusion) {
					c.fillStyle = "rgba(239,68,68,0.9)";
					c.fillRect(x, 2, BAR_W, H - 4);
					c.beginPath();
					c.arc(x + BAR_W / 2, 4, 3, 0, Math.PI * 2);
					c.fillStyle = "rgba(252,165,165,1)";
					c.fill();
				} else {
					const grad = c.createLinearGradient(x, centerY - halfH, x, centerY + halfH);
					if (activeRef.current) {
						grad.addColorStop(0, `rgba(147,197,253,${alpha * 0.6})`);
						grad.addColorStop(0.5, `rgba(96,165,250,${alpha})`);
						grad.addColorStop(1, `rgba(147,197,253,${alpha * 0.6})`);
					} else {
						grad.addColorStop(0, `rgba(100,116,139,${alpha * 0.5})`);
						grad.addColorStop(0.5, `rgba(100,116,139,${alpha})`);
						grad.addColorStop(1, `rgba(100,116,139,${alpha * 0.5})`);
					}
					c.fillStyle = grad;
					c.beginPath();
					c.roundRect(x, centerY - halfH, BAR_W, halfH * 2, 1);
					c.fill();
				}
			}
		}

		rafRef.current = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className={`w-full block ${className}`}
			style={height !== undefined ? { height } : { height: "100%" }}
		/>
	);
}
