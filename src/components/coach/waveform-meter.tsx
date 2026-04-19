"use client";

/**
 * Horizontal scrolling waveform visualizer — Voice Memos style.
 * Amplitude-over-time: new bars enter from the right, scroll left.
 * Bars are symmetric (extend above and below center line).
 * Uses its own getUserMedia + AnalyserNode for time-domain RMS amplitude.
 */

import { useEffect, useRef } from "react";

const BAR_W = 2; // bar width px
const BAR_GAP = 2; // gap between bars px
const STEP = BAR_W + BAR_GAP;
const SAMPLE_MS = 50; // new sample every 50ms → ~20fps scroll rate

interface WaveformMeterProps {
	active: boolean; // true = mic is running
	level?: number; // real-time mic amplitude 0–1 from useMicAnalyser; drives bar height when provided
	height?: number; // if omitted, uses CSS height (e.g. h-full from className)
	className?: string;
	confusionEvents?: number[]; // array of Date.now() timestamps when confusion spiked
}

export function WaveformMeter({
	active,
	level,
	height = 56,
	className = "",
	confusionEvents = [],
}: WaveformMeterProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const historyRef = useRef<number[]>([]);
	const rafRef = useRef<number>(0);
	const lastSampleRef = useRef<number>(0);
	const activeRef = useRef(active);
	const levelRef = useRef(level);
	const confusionEventsRef = useRef<number[]>(confusionEvents);
	activeRef.current = active;
	levelRef.current = level;
	confusionEventsRef.current = confusionEvents;

	// Synthetic phase — used as fallback when no real level is provided
	const synthPhaseRef = useRef(0);

	// Canvas draw loop — always running so history decays when mic stops
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
			// Keep canvas pixel size in sync with CSS size
			if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
				canvas.width = W * dpr;
				canvas.height = H * dpr;
				c.scale(dpr, dpr);
			}

			const barCount = Math.floor(W / STEP) + 1;

			// Sample amplitude at SAMPLE_MS intervals
			if (ts - lastSampleRef.current >= SAMPLE_MS) {
				lastSampleRef.current = ts;
				let amp = 0;
				if (activeRef.current) {
					const realLevel = levelRef.current;
					if (realLevel !== undefined) {
						// Real mic amplitude — add slight noise so static signals still animate
						const noise = (Math.random() - 0.5) * 0.03;
						amp = Math.max(0, Math.min(1, realLevel + noise));
					} else {
						// Synthetic fallback: two sine waves + noise
						synthPhaseRef.current += 0.18;
						const base =
							Math.sin(synthPhaseRef.current) * 0.14 + Math.sin(synthPhaseRef.current * 2.3) * 0.07;
						const noise = (Math.random() - 0.5) * 0.12;
						amp = Math.max(0, 0.18 + base + noise);
					}
				} else {
					// Decay toward zero when not active
					const last = historyRef.current.at(-1) ?? 0;
					amp = last * 0.7;
				}
				historyRef.current.push(amp);
				if (historyRef.current.length > barCount) {
					historyRef.current = historyRef.current.slice(-barCount);
				}
			}

			// Draw
			c.clearRect(0, 0, W, H);
			const history = historyRef.current;
			const centerY = H / 2;
			const now = Date.now();

			// Build a set of bar indices that have confusion markers
			const confusionSet = new Set<number>();
			for (const ts of confusionEventsRef.current) {
				const ageMs = now - ts;
				const barsBack = Math.round(ageMs / SAMPLE_MS);
				const idx = history.length - 1 - barsBack;
				if (idx >= 0 && idx < history.length) confusionSet.add(idx);
			}

			for (let i = 0; i < history.length; i++) {
				const x = W - (history.length - i) * STEP;
				const amp = history[i];
				// Scale: at max RMS ~0.35 we want bars ~90% of half-height
				const halfH = Math.max(1, Math.min(centerY - 2, amp * centerY * 4.5));

				const isConfusion = confusionSet.has(i);
				const alpha = activeRef.current ? 0.85 : 0.35;

				if (isConfusion) {
					// Red confusion marker — full-height vertical line with dot above
					c.fillStyle = "rgba(239,68,68,0.9)"; // red-500
					c.fillRect(x, 2, BAR_W, H - 4);
					// Bright cap dot at top
					c.beginPath();
					c.arc(x + BAR_W / 2, 4, 3, 0, Math.PI * 2);
					c.fillStyle = "rgba(252,165,165,1)"; // red-300
					c.fill();
				} else {
					// Gradient: brighter in center, dimmer at tips
					const grad = c.createLinearGradient(x, centerY - halfH, x, centerY + halfH);
					if (activeRef.current) {
						grad.addColorStop(0, `rgba(147,197,253,${alpha * 0.6})`); // blue-300
						grad.addColorStop(0.5, `rgba(96,165,250,${alpha})`); // blue-400
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
