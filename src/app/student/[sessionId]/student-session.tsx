"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { StudentManipulative } from "@/components/coach/manipulatives/student";
import { CorrectionRequest } from "@/components/coach/manipulatives/student/correction-request";
import { RamBuckBurst } from "@/components/coach/ram-buck-burst";
import { useStudentFeed } from "@/hooks/use-student-feed";
import type { CoachResponse } from "@/lib/ai/coach";

gsap.registerPlugin(useGSAP);

// ─── SoundCloud-style scrolling waveform ─────────────────────────────────────

function buildWaveData(n: number): number[] {
	return Array.from({ length: n }, (_, i) => {
		const v = Math.abs(
			0.4 * Math.sin(i * 0.053) +
				0.35 * Math.sin(i * 0.119 + 1.3) +
				0.16 * Math.sin(i * 0.29 + 0.7) +
				0.09 * Math.sin(i * 0.61 + 2.1),
		);
		return Math.min(1, Math.max(0.05, v / 0.9));
	});
}

const WAVE_DATA = buildWaveData(900);
const BAR_W = 2;
const BAR_PITCH = 3; // bar + gap
const SCROLL_SPEED = 0.7; // px per frame

type WaveMarker = { frame: number; signal: Signal };

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
	const frameRef = useRef(0);
	const markersRef = useRef<WaveMarker[]>([]);
	const prevTriggerRef = useRef(0);
	const rafRef = useRef<number>(0);
	const activeRef = useRef(active);

	useEffect(() => {
		activeRef.current = active;
	}, [active]);

	// Stamp marker at current playhead frame
	useEffect(() => {
		if (markTrigger > prevTriggerRef.current && latestSignal) {
			markersRef.current = [
				...markersRef.current,
				{ frame: frameRef.current, signal: latestSignal },
			].slice(-30);
			prevTriggerRef.current = markTrigger;
		}
	}, [markTrigger, latestSignal]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		function resize() {
			if (!canvas || !ctx) return;
			const dpr = window.devicePixelRatio || 1;
			const r = canvas.getBoundingClientRect();
			canvas.width = r.width * dpr;
			canvas.height = r.height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);

		function draw() {
			if (!canvas || !ctx) return;
			const cssW = canvas.getBoundingClientRect().width;
			const cssH = canvas.getBoundingClientRect().height;
			if (cssW === 0) {
				rafRef.current = requestAnimationFrame(draw);
				return;
			}

			ctx.clearRect(0, 0, cssW, cssH);
			const cy = cssH / 2;
			const maxH = cssH - 6;
			const playheadX = cssW * 0.4;
			const totalScroll = frameRef.current * SCROLL_SPEED;
			const scrollOffset = totalScroll % BAR_PITCH;
			const numBars = Math.ceil(cssW / BAR_PITCH) + 2;

			// Bars
			for (let i = 0; i < numBars; i++) {
				const x = i * BAR_PITCH - scrollOffset;
				const globalIdx = Math.floor(totalScroll / BAR_PITCH) + i;
				const dataIdx = ((globalIdx % WAVE_DATA.length) + WAVE_DATA.length) % WAVE_DATA.length;
				const amp = WAVE_DATA[dataIdx] ?? 0.3;
				const h = Math.max(2, amp * maxH);
				const played = x <= playheadX;
				if (activeRef.current) {
					ctx.fillStyle = played ? "rgba(129,140,248,0.88)" : "rgba(99,102,241,0.22)";
				} else {
					ctx.fillStyle = "rgba(71,85,105,0.38)";
				}
				ctx.beginPath();
				ctx.roundRect(x, cy - h / 2, BAR_W, h, 1);
				ctx.fill();
			}

			// Signal markers (fingerprints)
			for (const { frame, signal } of markersRef.current) {
				const mx = playheadX - (frameRef.current - frame) * SCROLL_SPEED;
				if (mx < -20 || mx > cssW + 20) continue;
				const color = signal === "got-it" ? "#34d399" : signal === "almost" ? "#fbbf24" : "#a78bfa";
				// Vertical line
				ctx.fillStyle = `${color}99`;
				ctx.fillRect(mx - 0.5, 3, 1.5, cssH - 6);
				// Ripple (fades over ~90 frames)
				const age = frameRef.current - frame;
				const fade = Math.max(0, 1 - age / 90);
				if (fade > 0) {
					ctx.beginPath();
					ctx.arc(mx, cy, 8 + (1 - fade) * 8, 0, Math.PI * 2);
					ctx.strokeStyle =
						color +
						Math.round(fade * 100)
							.toString(16)
							.padStart(2, "0");
					ctx.lineWidth = 1;
					ctx.stroke();
				}
				// Core dot
				ctx.beginPath();
				ctx.arc(mx, cy, 3.5, 0, Math.PI * 2);
				ctx.fillStyle = color;
				ctx.fill();
			}

			// Playhead
			if (activeRef.current) {
				const g = ctx.createLinearGradient(playheadX - 10, 0, playheadX + 10, 0);
				g.addColorStop(0, "rgba(255,255,255,0)");
				g.addColorStop(0.5, "rgba(255,255,255,0.18)");
				g.addColorStop(1, "rgba(255,255,255,0)");
				ctx.fillStyle = g;
				ctx.fillRect(playheadX - 10, 0, 20, cssH);
				ctx.fillStyle = "rgba(255,255,255,0.6)";
				ctx.fillRect(playheadX, 0, 1, cssH);
			}

			if (activeRef.current) frameRef.current++;
			rafRef.current = requestAnimationFrame(draw);
		}

		rafRef.current = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(rafRef.current);
			ro.disconnect();
		};
	}, []);

	return (
		<div className="relative w-full overflow-hidden rounded-lg" style={{ height: 52 }}>
			<canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
			{/* Edge fade */}
			<div
				className="absolute inset-y-0 left-0 w-8 pointer-events-none"
				style={{ background: "linear-gradient(to right, #0f1117, transparent)" }}
			/>
			<div
				className="absolute inset-y-0 right-0 w-8 pointer-events-none"
				style={{ background: "linear-gradient(to left, #0f1117, transparent)" }}
			/>
		</div>
	);
}

type Signal = "got-it" | "almost" | "lost";
type ManipSpec = CoachResponse["manipulative"];

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
};

export function StudentSession({
	sessionId,
	displayName,
	classLabel,
	isActive,
	studentId,
	initialSignal,
	ramBalance: initialRamBalanceProp,
	groupBalance,
	groupName,
}: Props) {
	const router = useRouter();
	const [currentSignal, setCurrentSignal] = useState<Signal | null>(initialSignal);
	const [markTrigger, setMarkTrigger] = useState(0);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState("");

	// RAM balance + burst
	const [ramBalance, setRamBalance] = useState(initialRamBalanceProp ?? 0);
	const [burstAmount, setBurstAmount] = useState(0);
	const [showBurst, setShowBurst] = useState(false);
	const balanceChipRef = useRef<HTMLDivElement>(null);

	// Manipulative slide-in state
	const [dismissing, setDismissing] = useState(false);
	const manipWrapRef = useRef<HTMLDivElement>(null);

	// SSE feed via hook
	const {
		status,
		pushedSpec,
		pushedStandardCode,
		showManip,
		dismissManip,
		ramAward,
		clearRamAward,
	} = useStudentFeed(sessionId, isActive);

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

	// Watch ramAward from SSE feed
	useEffect(() => {
		if (!ramAward) return;
		setRamBalance(ramAward.newBalance);
		setBurstAmount(ramAward.amount);
		setShowBurst(true);
		clearRamAward();
	}, [ramAward, clearRamAward]);

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

	// Manipulative slide-in animation
	useGSAP(
		() => {
			if (showManip && !dismissing && manipWrapRef.current) {
				gsap.fromTo(
					manipWrapRef.current,
					{ y: 40, opacity: 0, scale: 0.96 },
					{ y: 0, opacity: 1, scale: 1, duration: 0.38, ease: "back.out(1.4)" },
				);
			}
		},
		{ dependencies: [showManip, dismissing] },
	);

	function handleDismissManip() {
		if (!manipWrapRef.current) {
			dismissManip();
			return;
		}
		setDismissing(true);
		gsap.to(manipWrapRef.current, {
			y: 30,
			opacity: 0,
			duration: 0.22,
			ease: "power2.in",
			onComplete: () => {
				setDismissing(false);
				dismissManip();
			},
		});
	}

	const tapButton = useCallback((el: HTMLButtonElement | null) => {
		if (!el) return;
		gsap
			.timeline()
			.to(el, { scale: 0.93, duration: 0.08, ease: "power2.in" })
			.to(el, { scale: 1.04, duration: 0.2, ease: "back.out(3)" })
			.to(el, { scale: 1, duration: 0.12, ease: "power2.out" });
	}, []);

	const submitSignal = useCallback(
		async (signal: Signal, el: HTMLButtonElement | null) => {
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
		},
		[isPending, sessionId, tapButton],
	);

	return (
		<div className="student-content flex min-h-screen flex-col items-center justify-start px-4 py-8 gap-6">
			{/* Connection status banners */}
			{status === "reconnecting" && (
				<div className="fixed top-0 inset-x-0 z-50 bg-amber-500/90 text-black text-center text-xs py-1 font-medium">
					Reconnecting...
				</div>
			)}
			{status === "failed" && (
				<div className="fixed top-0 inset-x-0 z-50 bg-red-500/90 text-white text-center text-xs py-1 font-medium">
					Connection lost — please rejoin
				</div>
			)}

			{/* RAM Bucks burst animation */}
			{showBurst && (
				<RamBuckBurst
					amount={burstAmount}
					type="award"
					anchorRef={balanceChipRef}
					onDone={() => setShowBurst(false)}
				/>
			)}

			{/* Header */}
			<div ref={headerRef} className="flex flex-col items-center gap-3 pt-2">
				<div className="flex items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e2230] ring-1 ring-white/10 shadow-lg">
						<RamLogo size={34} />
					</div>
					<div>
						<p className="text-lg font-black text-white leading-tight">{displayName}</p>
						<p className="text-xs text-slate-500 font-medium">{classLabel}</p>
					</div>
				</div>

				{/* RAM Buck balance chips */}
				{(ramBalance > 0 || groupBalance !== null) && (
					<div className="flex items-center gap-2 flex-wrap justify-center">
						{ramBalance > 0 && (
							<div
								ref={balanceChipRef}
								className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 text-sm font-bold text-amber-400"
							>
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
			{showManip && pushedSpec != null && (
				<div ref={manipWrapRef} className="w-full max-w-sm">
					<StudentManipulative
						spec={pushedSpec as ManipSpec}
						sessionId={sessionId}
						standardCode={pushedStandardCode}
						onDismiss={handleDismissManip}
						onRamEarned={(amount, newBalance) => {
							setRamBalance(newBalance);
							setBurstAmount(amount);
							setShowBurst(true);
						}}
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
