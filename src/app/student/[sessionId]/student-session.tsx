"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { StudentManipulative } from "@/components/coach/manipulatives/student";
import { CorrectionRequest } from "@/components/coach/manipulatives/student/correction-request";
import type { CoachResponse } from "@/lib/ai/coach";

gsap.registerPlugin(useGSAP);

type Signal = "got-it" | "almost" | "lost";
type ManipSpec = CoachResponse["manipulative"];
type PushPayload = {
	pushId: string;
	spec: ManipSpec;
	standardCode: string | null;
	pushedAt: string;
};

const SIGNALS: {
	id: Signal;
	label: string;
	icon: string;
	accent: string;
	ring: string;
	glow: string;
}[] = [
	{
		id: "got-it",
		label: "Got it!",
		icon: "✓",
		accent: "bg-emerald-500",
		ring: "ring-emerald-500/60",
		glow: "shadow-emerald-500/20",
	},
	{
		id: "almost",
		label: "Almost...",
		icon: "~",
		accent: "bg-amber-500",
		ring: "ring-amber-500/60",
		glow: "shadow-amber-500/20",
	},
	{
		id: "lost",
		label: "Need help",
		icon: "🙋",
		accent: "bg-violet-500",
		ring: "ring-violet-500/60",
		glow: "shadow-violet-500/20",
	},
];

// ─── STUDENT WAVEFORM (matches WaveformMeter aesthetic + signal markers) ─────
type SignalMarker = { timestamp: number; signal: Signal };

const SIGNAL_COLORS: Record<Signal, { line: string; dot: string }> = {
	"got-it": { line: "rgba(16,185,129,0.9)", dot: "rgba(110,231,183,1)" },
	almost: { line: "rgba(245,158,11,0.9)", dot: "rgba(252,211,77,1)" },
	lost: { line: "rgba(139,92,246,0.9)", dot: "rgba(196,181,253,1)" },
};

const S_BAR_W = 2;
const S_BAR_GAP = 2;
const S_STEP = S_BAR_W + S_BAR_GAP;
const S_SAMPLE_MS = 50;

function SoundcloudWave({
	active,
	markTrigger,
	latestSignal,
}: {
	active: boolean;
	markTrigger: number;
	latestSignal: Signal | null;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const historyRef = useRef<number[]>([]);
	const rafRef = useRef<number>(0);
	const lastSampleRef = useRef<number>(0);
	const synthPhaseRef = useRef(0);
	const activeRef = useRef(active);
	activeRef.current = active;
	const markersRef = useRef<SignalMarker[]>([]);
	const latestSignalRef = useRef(latestSignal);
	latestSignalRef.current = latestSignal;
	const micAmpRef = useRef(0);
	const micReadyRef = useRef(false);

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
				await ctx.resume();
				const source = ctx.createMediaStreamSource(stream);
				const analyser = ctx.createAnalyser();
				analyser.fftSize = 512;
				analyser.smoothingTimeConstant = 0;
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
					let sum = 0;
					for (let i = 0; i < td.length; i++) {
						const v = (td[i] - 128) / 128;
						sum += v * v;
					}
					const rms = Math.sqrt(sum / td.length);
					const target = Math.min(1, rms * 6);
					const prev = micAmpRef.current;
					micAmpRef.current =
						target > prev ? prev + (target - prev) * 0.5 : prev + (target - prev) * 0.1;
					analyserRafId = requestAnimationFrame(tick);
				}
				analyserRafId = requestAnimationFrame(tick);
			} catch {
				/* mic unavailable */
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

	// Stamp a marker each time the student submits a signal
	useEffect(() => {
		if (markTrigger === 0 || !latestSignalRef.current) return;
		markersRef.current = [
			...markersRef.current,
			{ timestamp: Date.now(), signal: latestSignalRef.current },
		];
	}, [markTrigger]);

	// Draw loop — same synthetic amplitude + blue gradient as WaveformMeter
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

			const barCount = Math.floor(W / S_STEP) + 1;

			// Pre-populate on first draw so canvas isn't blank after a page reload
			if (historyRef.current.length === 0 && activeRef.current && W > 0) {
				let phase = Math.random() * Math.PI * 2;
				const warmup: number[] = [];
				for (let i = 0; i < barCount; i++) {
					phase += 0.18;
					const b = Math.sin(phase) * 0.14 + Math.sin(phase * 2.3) * 0.07;
					warmup.push(Math.max(0, 0.18 + b + (Math.random() - 0.5) * 0.12));
				}
				historyRef.current = warmup;
			}

			if (ts - lastSampleRef.current >= S_SAMPLE_MS) {
				lastSampleRef.current = ts;
				let amp = 0;
				if (activeRef.current) {
					if (micReadyRef.current) {
						amp = Math.max(0, Math.min(1, micAmpRef.current + (Math.random() - 0.5) * 0.02));
					} else {
						synthPhaseRef.current += 0.18;
						const base =
							Math.sin(synthPhaseRef.current) * 0.14 + Math.sin(synthPhaseRef.current * 2.3) * 0.07;
						amp = Math.max(0, 0.18 + base + (Math.random() - 0.5) * 0.12);
					}
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
			const alpha = activeRef.current ? 0.85 : 0.35;

			// Map each marker to the bar index it lands on
			const markerMap = new Map<number, Signal>();
			for (const m of markersRef.current) {
				const barsBack = Math.round((now - m.timestamp) / S_SAMPLE_MS);
				const idx = history.length - 1 - barsBack;
				if (idx >= 0 && idx < history.length) markerMap.set(idx, m.signal);
			}

			for (let i = 0; i < history.length; i++) {
				const x = W - (history.length - i) * S_STEP;
				const amp = history[i];
				const halfH = Math.max(1, Math.min(centerY - 2, amp * centerY * 4.5));
				const markerSignal = markerMap.get(i);

				if (markerSignal) {
					const col = SIGNAL_COLORS[markerSignal];
					c.fillStyle = col.line;
					c.fillRect(x, 2, S_BAR_W, H - 4);
					c.beginPath();
					c.arc(x + S_BAR_W / 2, 4, 3, 0, Math.PI * 2);
					c.fillStyle = col.dot;
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
					c.roundRect(x, centerY - halfH, S_BAR_W, halfH * 2, 1);
					c.fill();
				}
			}
		}

		rafRef.current = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	return <canvas ref={canvasRef} className="w-full block" style={{ height: 56 }} />;
}

// ─── RAM SVG ──────────────────────────────────────────────────────────────────
function RamLogo({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 64 64"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-label="RAM mascot"
		>
			<title>RAM mascot</title>
			<path
				d="M14 28 C6 22 4 12 10 8 C16 4 22 8 20 16 C18 22 14 24 16 28"
				stroke="#f59e0b"
				strokeWidth="4"
				strokeLinecap="round"
				fill="none"
			/>
			<path
				d="M50 28 C58 22 60 12 54 8 C48 4 42 8 44 16 C46 22 50 24 48 28"
				stroke="#f59e0b"
				strokeWidth="4"
				strokeLinecap="round"
				fill="none"
			/>
			<ellipse cx="32" cy="36" rx="16" ry="18" fill="#e2e8f0" />
			<ellipse cx="32" cy="46" rx="9" ry="6" fill="#cbd5e1" />
			<circle cx="29" cy="47" r="1.5" fill="#94a3b8" />
			<circle cx="35" cy="47" r="1.5" fill="#94a3b8" />
			<circle cx="25" cy="33" r="3" fill="#1e293b" />
			<circle cx="39" cy="33" r="3" fill="#1e293b" />
			<circle cx="26" cy="32" r="1" fill="white" />
			<circle cx="40" cy="32" r="1" fill="white" />
		</svg>
	);
}

type Props = {
	sessionId: string;
	displayName: string;
	classLabel: string;
	isActive: boolean;
	studentId: string;
	initialSignal: Signal | null;
	ramBalance: number;
	groupBalance: number | null;
	groupName: string | null;
	joinCode: string;
};

export function StudentSession({
	sessionId,
	displayName,
	classLabel,
	isActive,
	studentId,
	initialSignal,
	ramBalance,
	groupBalance,
	groupName,
	joinCode,
}: Props) {
	const router = useRouter();
	const [currentSignal, setCurrentSignal] = useState<Signal | null>(initialSignal);
	const [markTrigger, setMarkTrigger] = useState(0);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState("");

	// Poll for session going live when student joins early
	useEffect(() => {
		if (isActive) return;
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/sessions/${sessionId}/status`);
				if (!res.ok) return;
				const { active } = await res.json();
				if (active) router.refresh();
			} catch {
				/* noop */
			}
		}, 4000);
		return () => clearInterval(interval);
	}, [isActive, sessionId, router]);

	const [pushedSpec, setPushedSpec] = useState<ManipSpec>(null);
	const [pushedStandardCode, setPushedStandardCode] = useState<string | undefined>(undefined);
	const [showManip, setShowManip] = useState(false);
	const esRef = useRef<EventSource | null>(null);

	const headerRef = useRef<HTMLDivElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

	// Entrance animation
	useGSAP(() => {
		gsap.from(headerRef.current, { y: -16, opacity: 0, duration: 0.5, ease: "power2.out" });
		gsap.from(cardRef.current, {
			y: 32,
			opacity: 0,
			duration: 0.5,
			ease: "power2.out",
			delay: 0.1,
		});
		gsap.from(btnRefs.current.filter(Boolean), {
			y: 20,
			opacity: 0,
			duration: 0.4,
			ease: "back.out(1.4)",
			stagger: 0.08,
			delay: 0.25,
		});
	}, []);

	// SSE for pushed manipulatives
	useEffect(() => {
		if (!isActive) return;
		const es = new EventSource(`/api/sessions/${sessionId}/student-feed`);
		esRef.current = es;
		es.onmessage = (e) => {
			try {
				const data = JSON.parse(e.data) as PushPayload;
				if (data.spec) {
					setPushedSpec(data.spec);
					setPushedStandardCode(data.standardCode ?? undefined);
					setShowManip(true);
				}
			} catch {
				/* ignore */
			}
		};
		return () => es.close();
	}, [sessionId, isActive]);

	function tapButton(el: HTMLButtonElement | null) {
		if (!el) return;
		gsap
			.timeline()
			.to(el, { scale: 0.93, duration: 0.08, ease: "power2.in" })
			.to(el, { scale: 1.04, duration: 0.2, ease: "back.out(3)" })
			.to(el, { scale: 1, duration: 0.12, ease: "power2.out" });
	}

	async function submitSignal(signal: Signal, el: HTMLButtonElement | null) {
		if (isPending) return;
		tapButton(el);
		setError("");
		startTransition(async () => {
			try {
				const res = await fetch(`/api/sessions/${sessionId}/signal`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ signal }),
				});
				if (!res.ok) throw new Error("Failed");
				setCurrentSignal(signal);
				setMarkTrigger((t) => t + 1);
			} catch {
				setError("Couldn't save — try again");
			}
		});
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-start px-4 py-8 gap-6">
			{/* Header */}
			<div ref={headerRef} className="flex flex-col items-center gap-3 pt-2">
				<div className="flex items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e2230] ring-1 ring-white/10 shadow-lg">
						<RamLogo size={34} />
					</div>
					<div>
						<p className="text-lg font-black text-white leading-tight">{displayName}</p>
						<p className="text-xs text-slate-500 font-medium">{classLabel}</p>
						<p className="text-[10px] font-mono text-slate-600 tracking-widest">
							JOIN: <span className="text-slate-500">{joinCode}</span>
						</p>
					</div>
				</div>

				{/* RAM Buck balance chips */}
				{(ramBalance > 0 || groupBalance !== null) && (
					<div className="flex items-center gap-2 flex-wrap justify-center">
						{ramBalance > 0 && (
							<div className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 text-sm font-bold text-amber-400">
								{ramBalance} RAM Bucks
							</div>
						)}
						{groupBalance !== null && groupName && (
							<div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-semibold text-slate-400">
								{groupName}: {groupBalance} pts
							</div>
						)}
					</div>
				)}
			</div>

			{/* Pushed manipulative */}
			{showManip && pushedSpec && (
				<div className="w-full max-w-sm">
					<StudentManipulative
						spec={pushedSpec}
						sessionId={sessionId}
						standardCode={pushedStandardCode}
						onDismiss={() => setShowManip(false)}
					/>
				</div>
			)}

			{/* Main card */}
			<div
				ref={cardRef}
				className="w-full max-w-sm rounded-2xl bg-[#1a1d27] border border-white/8 shadow-2xl overflow-hidden"
			>
				{isActive ? (
					<div className="flex flex-col gap-4 p-5">
						{/* Teacher voice waveform */}
						<div className="flex flex-col items-center gap-2">
							<SoundcloudWave
								active={isActive}
								markTrigger={markTrigger}
								latestSignal={currentSignal}
							/>
							<div className="flex items-center gap-1.5">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
								<p className="text-[11px] font-semibold text-emerald-500 tracking-wide uppercase">
									Teacher is live
								</p>
							</div>
						</div>

						{/* Signal label */}
						<p className="text-sm font-bold text-slate-300 text-center">How are you doing?</p>

						{/* Signal buttons */}
						<div className="flex flex-col gap-2.5">
							{SIGNALS.map((s, i) => {
								const isSelected = currentSignal === s.id;
								return (
									<button
										key={s.id}
										ref={(el) => {
											btnRefs.current[i] = el;
										}}
										type="button"
										onClick={() => submitSignal(s.id, btnRefs.current[i])}
										disabled={isPending}
										className={`relative flex items-center gap-4 rounded-xl px-5 py-4 transition-colors text-left border ${
											isSelected
												? `${s.accent} border-transparent ring-2 ${s.ring} shadow-xl ${s.glow}`
												: "bg-[#0f1117] border-white/8 hover:border-white/20"
										} disabled:opacity-60`}
									>
										<span
											className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-black ${
												isSelected ? "bg-black/20 text-white" : "bg-white/8 text-slate-400"
											}`}
										>
											{s.icon}
										</span>
										<span
											className={`text-base font-bold ${isSelected ? "text-white" : "text-slate-300"}`}
										>
											{s.label}
										</span>
										{isSelected && (
											<span className="ml-auto text-[10px] font-black text-white/60 uppercase tracking-widest">
												✓ Sent
											</span>
										)}
									</button>
								);
							})}
						</div>

						{error && (
							<p className="text-center text-xs text-rose-300 bg-rose-500/10 rounded-lg py-2">
								{error}
							</p>
						)}

						{/* Help / lost context */}
						{currentSignal === "lost" && !showManip && (
							<div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-3 text-center">
								<p className="text-sm font-semibold text-violet-300">Your teacher is on the way!</p>
								<p className="text-xs text-violet-400/70 mt-0.5">Hang tight, help is coming.</p>
							</div>
						)}

						{/* Correction request */}
						<div className="border-t border-white/6 pt-3">
							<CorrectionRequest sessionId={sessionId} />
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center gap-4 p-12">
						<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 animate-pulse">
							<RamLogo size={36} />
						</div>
						<div className="text-center">
							<p className="text-base font-bold text-white">Waiting for class...</p>
							<p className="text-sm text-slate-500 mt-1">Your teacher will start soon.</p>
						</div>
					</div>
				)}
			</div>

			{studentId && <p className="text-xs text-slate-700">ID: {studentId}</p>}
		</div>
	);
}
