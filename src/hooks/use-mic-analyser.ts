"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 12;
const FFT_SIZE = 256; // 128 usable bins
const SMOOTHING = 0.75; // higher = smoother decay

/**
 * Returns an array of BAR_COUNT amplitude values (0–1) driven by the real microphone.
 * Uses getUserMedia for analysis only — does NOT compete with SpeechRecognition.
 * When `enabled` is false the stream is released and all bars return 0.
 */
export function useMicAnalyser(enabled: boolean): number[] {
	const [levels, setLevels] = useState<number[]>(Array(BAR_COUNT).fill(0));
	const rafRef = useRef<number>(0);
	const streamRef = useRef<MediaStream | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const ctxRef = useRef<AudioContext | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: cleanup is a stable local function, enabled is the intentional trigger
	useEffect(() => {
		if (!enabled) {
			cleanup();
			setLevels(Array(BAR_COUNT).fill(0));
			return;
		}

		let active = true;

		async function start() {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
				if (!active) {
					for (const t of stream.getTracks()) t.stop();
					return;
				}

				const ctx = new AudioContext();
				const source = ctx.createMediaStreamSource(stream);
				const analyser = ctx.createAnalyser();
				analyser.fftSize = FFT_SIZE;
				analyser.smoothingTimeConstant = SMOOTHING;
				source.connect(analyser);
				// NOT connected to ctx.destination — purely for analysis, silent

				streamRef.current = stream;
				analyserRef.current = analyser;
				ctxRef.current = ctx;

				const data = new Uint8Array(analyser.frequencyBinCount); // 128 bins

				function tick() {
					if (!active) return;
					analyser.getByteFrequencyData(data);

					// Map 128 FFT bins → 12 bars using log-spaced buckets
					// Concentrate lower bins (voice is mostly 80–3000 Hz) and cap at bin ~80
					const usableBins = Math.min(80, data.length);
					const newLevels: number[] = [];

					for (let b = 0; b < BAR_COUNT; b++) {
						// Logarithmic spacing: lower bars = more freq resolution
						const start = Math.floor((b / BAR_COUNT) ** 1.8 * usableBins);
						const end = Math.floor(((b + 1) / BAR_COUNT) ** 1.8 * usableBins);
						let sum = 0;
						const count = Math.max(1, end - start);
						for (let i = start; i < end; i++) sum += data[i];
						// Normalize 0-255 → 0-1, apply a floor boost so quiet room isn't flat zero
						const raw = sum / count / 255;
						newLevels.push(Math.min(1, raw * 1.6));
					}

					setLevels(newLevels);
					rafRef.current = requestAnimationFrame(tick);
				}

				rafRef.current = requestAnimationFrame(tick);
			} catch {
				// Permission denied or no mic — leave bars at 0
			}
		}

		start();

		return () => {
			active = false;
			cleanup();
		};
	}, [enabled]);

	function cleanup() {
		cancelAnimationFrame(rafRef.current);
		if (streamRef.current) {
			for (const t of streamRef.current.getTracks()) t.stop();
			streamRef.current = null;
		}
		if (ctxRef.current) {
			ctxRef.current.close();
			ctxRef.current = null;
		}
		analyserRef.current = null;
	}

	return levels;
}
