"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnomalyScanResult } from "@/app/api/coach/ambient-scan/route";
import { useAmbientMonitor } from "@/hooks/use-ambient-monitor";

type Props = {
	sessionId?: string;
	transcript: string;
	isListening: boolean;
};

type CorrectionRequest = {
	id: string;
	firstInitial: string;
	lastInitial: string;
	context: string;
	createdAt: string;
};

const NOISE_COLORS: Record<string, string> = {
	off: "bg-gray-200",
	quiet: "bg-green-400",
	moderate: "bg-yellow-400",
	loud: "bg-red-500",
};

export function AmbientHud({ sessionId, transcript, isListening }: Props) {
	const lastScanRef = useRef<string>("");
	const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const [anomalies, setAnomalies] = useState<AnomalyScanResult["anomalies"]>([]);
	const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
	const [currentLevel, setCurrentLevel] = useState(0);

	const handleLevel = useCallback(
		async (level: number) => {
			setCurrentLevel(level);
			if (sessionId) {
				void fetch(`/api/sessions/${sessionId}/noise`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ level }),
				}).catch(() => {});
			}
		},
		[sessionId],
	);

	const { ambientLevel, hasPermission } = useAmbientMonitor({
		active: isListening,
		onLevel: handleLevel,
	});

	// AI anomaly scan every 5 minutes while listening
	useEffect(() => {
		if (!isListening) {
			if (scanTimerRef.current) clearInterval(scanTimerRef.current);
			return;
		}

		async function runScan() {
			if (transcript === lastScanRef.current || transcript.length < 100) return;
			lastScanRef.current = transcript;
			try {
				const res = await fetch("/api/coach/ambient-scan", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ transcript: transcript.slice(-3000) }),
				});
				if (res.ok) {
					const result = (await res.json()) as AnomalyScanResult;
					setAnomalies(result.anomalies.filter((a) => a.severity !== "low"));
				}
			} catch {
				// non-critical
			}
		}

		scanTimerRef.current = setInterval(runScan, 5 * 60 * 1000);
		return () => {
			if (scanTimerRef.current) clearInterval(scanTimerRef.current);
		};
	}, [isListening, transcript]);

	// Poll correction requests every 15s when session active
	useEffect(() => {
		if (!sessionId) return;

		async function fetchCorrections() {
			try {
				const res = await fetch(`/api/sessions/${sessionId}/correction-requests`);
				if (res.ok) {
					const json = (await res.json()) as { requests: CorrectionRequest[] };
					setCorrections(json.requests ?? []);
				}
			} catch {
				// non-critical
			}
		}

		fetchCorrections();
		const interval = setInterval(fetchCorrections, 15_000);
		return () => clearInterval(interval);
	}, [sessionId]);

	async function acknowledgeCorrection(requestId: string) {
		if (!sessionId) return;
		await fetch(`/api/sessions/${sessionId}/correction-requests`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ requestId }),
		});
		setCorrections((prev) => prev.filter((c) => c.id !== requestId));
	}

	if (!isListening && corrections.length === 0 && anomalies.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2 items-center">
			{/* Noise meter */}
			{isListening && hasPermission !== false && (
				<div className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1">
					<div className={`h-2 w-2 rounded-full ${NOISE_COLORS[ambientLevel]} animate-pulse`} />
					<span className="text-xs text-muted-foreground capitalize">{ambientLevel}</span>
					<span className="text-xs tabular-nums text-muted-foreground">{currentLevel}</span>
				</div>
			)}

			{/* Correction requests */}
			{corrections.length > 0 && (
				<div className="flex flex-col gap-1">
					{corrections.map((c) => (
						<div
							key={c.id}
							className="flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-2.5 py-1"
						>
							<span className="text-xs font-medium text-red-700">
								🆘 {c.firstInitial}.{c.lastInitial}. is lost
								{c.context ? ` — ${c.context}` : ""}
							</span>
							<button
								type="button"
								onClick={() => acknowledgeCorrection(c.id)}
								className="text-xs text-red-500 hover:text-red-700 underline"
							>
								Got it
							</button>
						</div>
					))}
				</div>
			)}

			{/* Anomaly alerts */}
			{anomalies.map((a) => (
				<div
					key={a.description}
					className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
						a.severity === "high"
							? "border-orange-300 bg-orange-50 text-orange-800"
							: "border-yellow-300 bg-yellow-50 text-yellow-800"
					}`}
				>
					<span className="text-xs">⚠️ {a.description}</span>
					<button
						type="button"
						onClick={() =>
							setAnomalies((prev) => prev.filter((x) => x.description !== a.description))
						}
						className="text-xs opacity-60 hover:opacity-100"
					>
						✕
					</button>
				</div>
			))}
		</div>
	);
}
