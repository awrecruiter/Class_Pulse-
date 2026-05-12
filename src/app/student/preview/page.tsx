"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type PreviewTab = "join" | "session";

// ─── RAM SVG — matches student join page ──────────────────────────────────────
function RamLogo({ size = 52 }: { size?: number }) {
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
			{/* Left curling horn */}
			<path
				d="M14 28 C6 22 4 12 10 8 C16 4 22 8 20 16 C18 22 14 24 16 28"
				stroke="#f59e0b"
				strokeWidth="4"
				strokeLinecap="round"
				fill="none"
			/>
			{/* Right curling horn */}
			<path
				d="M50 28 C58 22 60 12 54 8 C48 4 42 8 44 16 C46 22 50 24 48 28"
				stroke="#f59e0b"
				strokeWidth="4"
				strokeLinecap="round"
				fill="none"
			/>
			{/* Head */}
			<ellipse cx="32" cy="36" rx="16" ry="18" fill="#e2e8f0" />
			{/* Snout */}
			<ellipse cx="32" cy="46" rx="9" ry="6" fill="#cbd5e1" />
			{/* Nostrils */}
			<circle cx="29" cy="47" r="1.5" fill="#94a3b8" />
			<circle cx="35" cy="47" r="1.5" fill="#94a3b8" />
			{/* Eyes */}
			<circle cx="25" cy="33" r="3" fill="#1e293b" />
			<circle cx="39" cy="33" r="3" fill="#1e293b" />
			{/* Eye shine */}
			<circle cx="26" cy="32" r="1" fill="white" />
			<circle cx="40" cy="32" r="1" fill="white" />
		</svg>
	);
}

// ─── Static flat waveform bar strip ───────────────────────────────────────────
function StaticWaveform() {
	// Pre-computed bar heights so the preview looks like a real (quiet) waveform
	const bars = [
		3, 5, 4, 8, 6, 12, 9, 7, 5, 10, 14, 11, 8, 6, 4, 7, 9, 12, 10, 8, 6, 5, 7, 9, 6, 4, 5, 8, 11, 7,
		5, 4, 6, 9, 13, 10, 7, 5, 4, 6, 8, 6, 5, 4, 3, 5, 7, 6, 4, 5,
	];
	return (
		<div className="w-full flex items-center justify-center gap-[2px]" style={{ height: 56 }}>
			{bars.map((h, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static decorative bars — order never changes
					key={i}
					className="w-[2px] rounded-sm bg-blue-400/30"
					style={{ height: `${h}px` }}
				/>
			))}
		</div>
	);
}

// ─── Signal button (static, non-interactive) ─────────────────────────────────
function SignalButton({
	icon,
	label,
	accent,
	ring,
	glow,
	selected,
}: {
	icon: string;
	label: string;
	accent: string;
	ring: string;
	glow: string;
	selected?: boolean;
}) {
	return (
		<div
			className={`relative flex items-center gap-4 rounded-xl px-5 py-4 text-left border select-none ${
				selected
					? `${accent} border-transparent ring-2 ${ring} shadow-xl ${glow}`
					: "bg-[#0f1117] border-white/8"
			}`}
		>
			<span
				className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-black ${
					selected ? "bg-black/20 text-white" : "bg-white/8 text-slate-400"
				}`}
			>
				{icon}
			</span>
			<span className={`text-base font-bold ${selected ? "text-white" : "text-slate-300"}`}>
				{label}
			</span>
			{selected && (
				<span className="ml-auto text-[10px] font-black text-white/60 uppercase tracking-widest">
					✓ Sent
				</span>
			)}
		</div>
	);
}

export default function StudentPreviewPage() {
	const [tab, setTab] = useState<PreviewTab>("join");

	return (
		<div className="flex min-h-screen flex-col">
			{/* ── Teacher preview banner ──────────────────────────────────────── */}
			<div className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-amber-400 px-4 py-2.5 text-amber-950">
				<div className="flex items-center gap-2">
					<span className="text-base">👁</span>
					<p className="text-sm font-bold leading-snug">
						Teacher Preview Mode — This is what your students see when they join a session
					</p>
				</div>
				<Link
					href="/cockpit"
					className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-950/15 hover:bg-amber-950/25 px-3 py-1.5 text-xs font-bold transition-colors"
				>
					← Back to Class Pulse
				</Link>
			</div>

			{/* ── Tab strip ───────────────────────────────────────────────────── */}
			<div className="flex items-center justify-center gap-0 border-b border-white/8 bg-[#0f1117] px-4 py-3">
				<button
					type="button"
					onClick={() => setTab("join")}
					className={`rounded-l-lg border px-5 py-2 text-sm font-semibold transition-colors ${
						tab === "join"
							? "border-amber-500/60 bg-amber-500/15 text-amber-400"
							: "border-white/8 bg-transparent text-slate-500 hover:text-slate-300"
					}`}
				>
					Join Screen
				</button>
				<button
					type="button"
					onClick={() => setTab("session")}
					className={`rounded-r-lg border-y border-r px-5 py-2 text-sm font-semibold transition-colors ${
						tab === "session"
							? "border-amber-500/60 bg-amber-500/15 text-amber-400"
							: "border-white/8 bg-transparent text-slate-500 hover:text-slate-300"
					}`}
				>
					In-Session View
				</button>
			</div>

			{/* ── Content ─────────────────────────────────────────────────────── */}
			{tab === "join" && (
				<div className="flex flex-col items-center justify-center flex-1 px-4 py-12 gap-8">
					{/* Contextual note */}
					<div className="rounded-lg border border-white/8 bg-white/5 px-4 py-2.5 text-center max-w-sm">
						<p className="text-xs text-slate-400">
							Students navigate to{" "}
							<span className="font-mono text-slate-300">class-pulse-nine.vercel.app/student</span>{" "}
							and enter the join code displayed on your session card.
						</p>
					</div>

					{/* Logo — mirrors real student page */}
					<div className="flex flex-col items-center gap-3">
						<div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-[#1e2230] shadow-lg ring-1 ring-white/10">
							<RamLogo size={52} />
						</div>
						<div className="text-center">
							<p className="text-2xl font-black tracking-tight text-white">Class Pulse</p>
							<p className="text-xs text-slate-500 mt-0.5 font-medium tracking-widest uppercase">
								Student Portal
							</p>
						</div>
					</div>

					{/* Join card — enter-code phase (static) */}
					<div className="w-full max-w-sm rounded-2xl bg-[#1a1d27] border border-white/8 shadow-2xl overflow-hidden">
						<div className="flex flex-col gap-5 p-7">
							<div className="text-center">
								<p className="text-lg font-bold text-white">Enter your class code</p>
								<p className="text-sm text-slate-400 mt-1">Your teacher has the 6-digit code</p>
							</div>

							{/* Mock code input */}
							<div className="text-center font-mono text-3xl font-black tracking-[0.35em] rounded-xl border border-amber-500/60 bg-[#0f1117] px-4 py-4 text-amber-400 ring-1 ring-amber-500/30 cursor-default select-none">
								ABC123
							</div>

							<button
								type="button"
								disabled
								className="rounded-xl bg-amber-500 px-6 py-3.5 text-base font-black text-black shadow-lg opacity-90 cursor-not-allowed"
							>
								Find My Class →
							</button>

							<p className="text-center text-[11px] text-slate-600 italic">
								(Interactive in the real student app)
							</p>
						</div>
					</div>

					<p className="text-xs text-slate-700">Class Pulse Student Portal</p>
				</div>
			)}

			{tab === "session" && (
				<div className="flex flex-col items-center justify-start flex-1 px-4 py-8 gap-6">
					{/* Contextual note */}
					<div className="rounded-lg border border-white/8 bg-white/5 px-4 py-2.5 text-center max-w-sm">
						<p className="text-xs text-slate-400">
							After entering their ID, students land here. They signal their understanding in real
							time and can browse the Privilege Store.
						</p>
					</div>

					{/* Header — mirrors real session header */}
					<div className="flex flex-col items-center gap-3 pt-2">
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e2230] ring-1 ring-white/10 shadow-lg">
								<RamLogo size={34} />
							</div>
							<div>
								<p className="text-lg font-black text-white leading-tight">J.M.</p>
								<p className="text-xs text-slate-500 font-medium">5th Period Math</p>
								<p className="text-[10px] font-mono text-slate-600 tracking-widest">
									JOIN: <span className="text-slate-500">ABC123</span>
								</p>
							</div>
						</div>

						{/* Balance chips */}
						<div className="flex items-center gap-2 flex-wrap justify-center">
							<div className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 text-sm font-bold text-amber-400">
								47 RAM Bucks
							</div>
							<div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-semibold text-slate-400">
								🐕 Dogs: 120 pts
							</div>
						</div>

						{/* Tonight's practice */}
						<div className="w-full max-w-xs rounded-xl bg-indigo-500/10 border border-indigo-500/25 px-4 py-3 text-center">
							<p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">
								📚 Tonight&apos;s Practice
							</p>
							<p className="text-sm font-semibold text-slate-200 leading-snug">
								IXL: Fractions — Section 4B (15 min)
							</p>
						</div>
					</div>

					{/* Session card */}
					<div className="w-full max-w-sm rounded-2xl bg-[#1a1d27] border border-white/8 shadow-2xl overflow-hidden">
						{/* Tab navigation */}
						<div className="flex border-b border-white/8">
							<div className="flex-1 py-3 text-sm font-bold text-center text-emerald-400 border-b-2 border-emerald-400">
								📊 Pulse
							</div>
							<div className="flex-1 py-3 text-sm font-bold text-center text-slate-500">
								🛒 Store
							</div>
						</div>

						{/* Pulse tab content */}
						<div className="flex flex-col gap-4 p-5">
							{/* Waveform */}
							<div className="flex flex-col items-center gap-2">
								<StaticWaveform />
								<div className="flex items-center gap-1.5">
									<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
									<p className="text-[11px] font-semibold text-emerald-500 tracking-wide uppercase">
										Teacher is live
									</p>
								</div>
							</div>

							<p className="text-sm font-bold text-slate-300 text-center">How are you doing?</p>

							{/* Signal buttons — "Got it" shown as selected */}
							<div className="flex flex-col gap-2.5">
								<SignalButton
									icon="✓"
									label="Got it!"
									accent="bg-emerald-500"
									ring="ring-emerald-500/60"
									glow="shadow-emerald-500/20"
									selected
								/>
								<SignalButton
									icon="~"
									label="Almost..."
									accent="bg-amber-500"
									ring="ring-amber-500/60"
									glow="shadow-amber-500/20"
								/>
								<SignalButton
									icon="🙋"
									label="Need help"
									accent="bg-violet-500"
									ring="ring-violet-500/60"
									glow="shadow-violet-500/20"
								/>
							</div>

							{/* I'm Lost button placeholder */}
							<div className="border-t border-white/6 pt-3">
								<button
									type="button"
									disabled
									className="w-full rounded-xl border border-violet-500/25 bg-violet-500/8 px-4 py-2.5 text-sm font-semibold text-violet-400 opacity-60 cursor-not-allowed"
								>
									🙋 I&apos;m Lost — Request Help
								</button>
							</div>
						</div>
					</div>

					{/* Footer note */}
					<div className="flex items-center gap-1.5 text-xs text-slate-600">
						<ExternalLinkIcon className="h-3 w-3" />
						<span>
							Students access this at <span className="font-mono">/student/[sessionId]</span> after
							joining
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
