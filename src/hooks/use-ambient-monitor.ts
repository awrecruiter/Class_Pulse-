"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AmbientLevel = "off" | "quiet" | "moderate" | "loud";

type Props = {
	active: boolean;
	onLevel?: (level: number) => void;
};

type Result = {
	level: number; // 0–100 normalized
	ambientLevel: AmbientLevel;
	hasPermission: boolean | null; // null = unknown, false = denied
};

function classify(level: number): AmbientLevel {
	if (level < 45) return "quiet";
	if (level < 70) return "moderate";
	return "loud";
}

export function useAmbientMonitor({ active, onLevel }: Props): Result {
	const [level, setLevel] = useState(0);
	const [hasPermission, setHasPermission] = useState<boolean | null>(null);

	const streamRef = useRef<MediaStream | null>(null);
	const contextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const rafRef = useRef<number | null>(null);
	const onLevelRef = useRef(onLevel);
	onLevelRef.current = onLevel;

	const stop = useCallback(() => {
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) track.stop();
			streamRef.current = null;
		}
		if (contextRef.current && contextRef.current.state !== "closed") {
			void contextRef.current.close();
			contextRef.current = null;
		}
		analyserRef.current = null;
		setLevel(0);
	}, []);

	useEffect(() => {
		if (!active) {
			stop();
			return;
		}

		let cancelled = false;

		async function start() {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
				if (cancelled) {
					for (const t of stream.getTracks()) t.stop();
					return;
				}

				setHasPermission(true);
				streamRef.current = stream;

				const ctx = new AudioContext();
				contextRef.current = ctx;

				const analyser = ctx.createAnalyser();
				analyser.fftSize = 256;
				analyserRef.current = analyser;

				const source = ctx.createMediaStreamSource(stream);
				source.connect(analyser);

				const data = new Uint8Array(analyser.frequencyBinCount);

				function tick() {
					if (!analyserRef.current) return;
					analyserRef.current.getByteFrequencyData(data);
					const avg = data.reduce((s, v) => s + v, 0) / data.length;
					const normalized = Math.min(100, Math.round((avg / 128) * 100));
					setLevel(normalized);
					onLevelRef.current?.(normalized);
					rafRef.current = requestAnimationFrame(tick);
				}

				rafRef.current = requestAnimationFrame(tick);
			} catch {
				if (!cancelled) setHasPermission(false);
			}
		}

		void start();

		return () => {
			cancelled = true;
			stop();
		};
	}, [active, stop]);

	return {
		level,
		ambientLevel: active ? classify(level) : "off",
		hasPermission,
	};
}
