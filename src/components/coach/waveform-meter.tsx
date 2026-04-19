"use client";

/**
 * Horizontal scrolling waveform visualizer — Voice Memos style.
 * Amplitude-over-time: new bars enter from the right, scroll left.
 * Bars are symmetric (extend above and below center line).
 *
 * Opens its own AudioContext + getUserMedia when active so bars respond
 * to real vocal inflections (walkie-talkie feel). Falls back to synthetic
 * waveform if mic access is unavailable.
 */

import { useEffect, useRef } from "react";

const BAR_W = 2; // bar width px
const BAR_GAP = 2; // gap between bars px
const STEP = BAR_W + BAR_GAP;
const SAMPLE_MS = 50; // new sample every 50ms → ~20fps scroll rate

interface WaveformMeterProps {
	active: boolean; // true = mic is running
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

	// Real mic amplitude (0–1) — updated by the analyser effect below
	const micAmpRef = useRef(0);
	// True once getUserMedia succeeds; drives draw-loop branch selection
	const micReadyRef = useRef(false);
	// Synthetic phase — used only when mic is unavailable
	const synthPhaseRef = useRef(0);

	// ── Mic analyser effect ────────────────────────────────────────────────────
	useEffect(() => {
		if (!active) {
			micAmpRef.current = 0;
			micReadyRef.current = false;
			return;
		}

		let disposed = false;
		let stream: MediaStream | null = null;
		let ctx: AudioContext | null = null;
		let analyserRafId = 0;

		async function start() {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
				if (disposed) {
					for (const t of stream.getTracks()) t.stop();
					return;
				}

				ctx = new AudioContext();
				await ctx.resume(); // ensure context isn't auto-suspended

				const source = ctx.createMediaStreamSource(stream);
				const analyser = ctx.createAnalyser();
				analyser.fftSize = 256;
				analyser.smoothingTimeConstant = 0; // manual smoothing below

				// Silent gain → ctx.destination forces Chrome to process the graph.
				// Without a destination connection some Chrome versions return all-zero data.
				const gain = ctx.createGain();
				gain.gain.value = 0;
				source.connect(analyser);
				source.connect(gain);
				gain.connect(ctx.destination);

				const td = new Uint8Array(analyser.fftSize);
				micReadyRef.current = true;

				function tick() {
					if (disposed) return;
					analyser.getByteTimeDomainData(td);

					// Time-domain RMS: values 0–255 where 128 = silence
					let sum = 0;
					for (let i = 0; i < td.length; i++) {
						const v = (td[i] - 128) / 128;
						sum += v * v;
					}
					const rms = Math.sqrt(sum / td.length);
					const target = Math.min(1, rms * 8); // boost so normal speech hits full height

					// Instant attack, fast decay — FaceTime feel
					const prev = micAmpRef.current;
					micAmpRef.current =
						target > prev ? prev + (target - prev) * 0.85 : prev + (target - prev) * 0.4;

					analyserRafId = requestAnimationFrame(tick);
				}

				analyserRafId = requestAnimationFrame(tick);
			} catch {
				// Mic unavailable — draw loop will use synthetic fallback
			}
		}

		start();

		return () => {
			disposed = true;
			cancelAnimationFrame(analyserRafId);
			if (stream) for (const t of stream.getTracks()) t.stop();
			ctx?.close();
			micAmpRef.current = 0;
			micReadyRef.current = false;
		};
	}, [active]);

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
					if (micReadyRef.current) {
						// Real mic — tiny noise keeps static amplitude from looking frozen
						const noise = (Math.random() - 0.5) * 0.02;
						amp = Math.max(0, Math.min(1, micAmpRef.current + noise));
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
