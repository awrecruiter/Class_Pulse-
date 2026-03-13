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
const SMOOTHING = 0.6; // AudioContext smoothing

interface WaveformMeterProps {
	active: boolean; // true = mic is running
	height?: number; // if omitted, uses CSS height (e.g. h-full from className)
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
	const analyserRef = useRef<AnalyserNode | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const rafRef = useRef<number>(0);
	const lastSampleRef = useRef<number>(0);
	const activeRef = useRef(active);
	const confusionEventsRef = useRef<number[]>(confusionEvents);
	activeRef.current = active;
	confusionEventsRef.current = confusionEvents;

	// Start / stop mic stream
	// biome-ignore lint/correctness/useExhaustiveDependencies: stopMic is a stable local function, active is the intentional trigger
	useEffect(() => {
		let mounted = true;

		if (active) {
			navigator.mediaDevices
				.getUserMedia({ audio: true, video: false })
				.then((stream) => {
					if (!mounted) {
						for (const t of stream.getTracks()) t.stop();
						return;
					}
					const ctx = new AudioContext();
					const analyser = ctx.createAnalyser();
					analyser.fftSize = 1024;
					analyser.smoothingTimeConstant = SMOOTHING;
					ctx.createMediaStreamSource(stream).connect(analyser);
					// NOT connected to destination — silent analysis only
					streamRef.current = stream;
					audioCtxRef.current = ctx;
					analyserRef.current = analyser;
				})
				.catch(() => {
					/* mic denied — waveform stays flat */
				});
		}

		return () => {
			mounted = false;
			stopMic();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active]);

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
				if (analyserRef.current && activeRef.current) {
					const buf = new Uint8Array(analyserRef.current.fftSize);
					analyserRef.current.getByteTimeDomainData(buf);
					// RMS of time-domain signal (128 = silence midpoint)
					let sum = 0;
					for (const v of buf) {
						const d = (v - 128) / 128;
						sum += d * d;
					}
					amp = Math.sqrt(sum / buf.length);
				} else {
					// Decay last value toward zero when not active
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

	function stopMic() {
		if (streamRef.current) {
			for (const t of streamRef.current.getTracks()) t.stop();
			streamRef.current = null;
		}
		audioCtxRef.current?.close();
		audioCtxRef.current = null;
		analyserRef.current = null;
	}

	return (
		<canvas
			ref={canvasRef}
			className={`w-full block ${className}`}
			style={height !== undefined ? { height } : { height: "100%" }}
		/>
	);
}
