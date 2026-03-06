"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
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
		label: "I'm lost",
		icon: "?",
		accent: "bg-red-500",
		ring: "ring-red-500/60",
		glow: "shadow-red-500/20",
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
	ramBalance,
	groupBalance,
	groupName,
}: Props) {
	const [currentSignal, setCurrentSignal] = useState<Signal | null>(initialSignal);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState("");

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
						{/* Live indicator */}
						<div className="flex items-center justify-center gap-2">
							<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
							<p className="text-xs font-semibold text-emerald-500 tracking-wide uppercase">
								Class is live
							</p>
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
							<p className="text-center text-xs text-red-400 bg-red-500/10 rounded-lg py-2">
								{error}
							</p>
						)}

						{/* Help / lost context */}
						{currentSignal === "lost" && !showManip && (
							<div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-center">
								<p className="text-sm font-semibold text-red-300">
									Your teacher sees you need help
								</p>
								<p className="text-xs text-red-400/70 mt-0.5">They'll send something over soon.</p>
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
