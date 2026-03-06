"use client";

import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MicState = "idle" | "listening" | "processing";

export interface MicButtonProps {
	state: MicState;
	onClick: () => void;
	disabled?: boolean;
	/** 96 = sm, 128 = lg (default) */
	size?: "sm" | "lg";
}

// ─── Bar count options ───────────────────────────────────────────────────────

const BAR_COUNT = 12;

// Animation delays create a natural asymmetric stagger around the circle.
// Each index maps to a delay in milliseconds.
const BAR_DELAYS_MS = [0, 120, 240, 80, 200, 320, 40, 160, 280, 100, 220, 60];

// ─── State-specific visuals ──────────────────────────────────────────────────

const STATE_CONFIG: Record<
	MicState,
	{
		label: string;
		ringColor: string;
		barColor: string;
		barAnimClass: string;
		centerBg: string;
		centerBorder: string;
		iconColor: string;
		glowColor: string;
	}
> = {
	idle: {
		label: "Tap to speak",
		// Neutral silver ring — works on dark and light backgrounds
		ringColor: "stroke-slate-300 dark:stroke-slate-600",
		// Bars are present but very short and dimmed
		barColor: "bg-slate-300 dark:bg-slate-600",
		barAnimClass: "mic-bar-idle",
		// Pill-shaped button: white/near-white in light, dark surface in dark
		centerBg: "bg-white dark:bg-slate-800",
		centerBorder: "border-2 border-slate-200 dark:border-slate-600",
		iconColor: "text-slate-500 dark:text-slate-400",
		glowColor: "transparent",
	},
	listening: {
		label: "Listening…",
		// High-energy electric blue — universally readable
		ringColor: "stroke-blue-500",
		barColor: "bg-blue-500",
		barAnimClass: "mic-bar-listening",
		centerBg: "bg-blue-500",
		centerBorder: "border-2 border-blue-400",
		iconColor: "text-white",
		glowColor: "rgba(59,130,246,0.35)",
	},
	processing: {
		label: "Thinking…",
		// Amber/amber-orange — distinct from blue, reads as "working"
		ringColor: "stroke-amber-500",
		barColor: "bg-amber-500",
		barAnimClass: "mic-bar-processing",
		centerBg: "bg-amber-500",
		centerBorder: "border-2 border-amber-400",
		iconColor: "text-white",
		glowColor: "rgba(245,158,11,0.35)",
	},
};

// ─── SVG Microphone icon ─────────────────────────────────────────────────────
// Inline so there is zero icon-library dependency risk and we can colour it freely.

function MicIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
			<path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
			<path d="M7 11a1 1 0 0 1 2 0 3 3 0 0 0 6 0 1 1 0 1 1 2 0 5 5 0 0 1-4 4.9V18h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.1A5 5 0 0 1 7 11z" />
		</svg>
	);
}

// ─── Spinning arc SVG (used in processing state around the ring) ─────────────

function SpinningArc({ radius }: { radius: number }) {
	const circumference = 2 * Math.PI * radius;
	const dashLen = circumference * 0.28; // 28% arc
	return (
		<svg
			className="absolute inset-0 w-full h-full [animation:mic-arc-spin_1s_linear_infinite] pointer-events-none"
			viewBox="0 0 100 100"
			aria-hidden="true"
		>
			<circle
				cx="50"
				cy="50"
				r={radius}
				fill="none"
				strokeWidth="3"
				stroke="currentColor"
				strokeDasharray={`${dashLen} ${circumference - dashLen}`}
				strokeLinecap="round"
				className="text-amber-400"
			/>
		</svg>
	);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function MicButton({ state, onClick, disabled = false, size = "lg" }: MicButtonProps) {
	const cfg = STATE_CONFIG[state];

	// Outer container dimensions
	const outerPx = size === "lg" ? 128 : 96;
	// Center button dimensions (inner circle)
	const innerPx = size === "lg" ? 68 : 52;
	// Bar track radius from center, in px — bars live in a ring just inside outer
	const _trackRadius = outerPx / 2 - 10; // 10px inset from edge
	// Bar dimensions
	const barW = size === "lg" ? 3 : 2.5;
	const barMaxH = size === "lg" ? 18 : 14;
	// Icon size
	const iconSize = size === "lg" ? "w-7 h-7" : "w-5 h-5";

	return (
		<div className="flex flex-col items-center gap-3 select-none">
			{/* ── Outer shell ─────────────────────────────────────────────── */}
			<div
				className="relative flex items-center justify-center"
				style={{ width: outerPx, height: outerPx }}
			>
				{/* Ambient glow — only on active states */}
				{state !== "idle" && (
					<div
						className="absolute rounded-full pointer-events-none transition-opacity duration-500"
						style={{
							inset: -12,
							background: `radial-gradient(circle, ${cfg.glowColor} 0%, transparent 70%)`,
						}}
					/>
				)}

				{/* ── Radial waveform bars ────────────────────────────────── */}
				{/*
				 * Each bar is a thin pill positioned absolutely at the edge of
				 * `trackRadius`, rotated around the center. They are sorted
				 * evenly around 360°. The bar's transform-origin is at the
				 * center of the outer div so `rotate` + `translateY(-trackRadius)`
				 * places it on the ring, pointing outward.
				 *
				 * In idle: bars are very short, opacity 0.4 — like an equalizer
				 *           at rest. They still gently undulate via mic-bar-idle.
				 * In listening: bars animate with high amplitude staggered pulse.
				 * In processing: bars sweep in a chasing pattern.
				 */}
				{BAR_DELAYS_MS.map((delayMs, i) => {
					const angleDeg = (i / BAR_COUNT) * 360;

					return (
						<div
							key={angleDeg}
							className="absolute"
							style={{
								width: barW,
								height: barMaxH,
								// Position bar at edge of track
								top: "50%",
								left: "50%",
								// Pivot at center of entire container
								transformOrigin: `${barW / 2}px ${outerPx / 2}px`,
								transform: `translateX(-${barW / 2}px) translateY(-${outerPx / 2}px) rotate(${angleDeg}deg)`,
							}}
						>
							{/* The actual animated bar pill */}
							<div
								className={cn(
									"w-full rounded-full transition-colors duration-500",
									cfg.barColor,
									cfg.barAnimClass,
									state === "idle" && "opacity-40",
									state === "listening" && "opacity-90",
									state === "processing" && "opacity-80",
								)}
								style={{
									height: "100%",
									animationDelay: `${delayMs}ms`,
									// scaleY origin at bottom so bars grow upward from the ring
									transformOrigin: "center bottom",
								}}
							/>
						</div>
					);
				})}

				{/* ── Processing: spinning arc on top of bars ──────────────── */}
				{state === "processing" && <SpinningArc radius={42} />}

				{/* ── Center button ────────────────────────────────────────── */}
				<button
					type="button"
					onClick={onClick}
					disabled={disabled}
					aria-label={cfg.label}
					className={cn(
						"relative flex items-center justify-center rounded-full",
						"transition-all duration-300",
						"active:scale-90",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
						cfg.centerBg,
						cfg.centerBorder,
						disabled && "opacity-50 cursor-not-allowed",
						// Scale pulse on listening
						state === "listening" && "[animation:mic-center-pulse_1.4s_ease-in-out_infinite]",
					)}
					style={{
						width: innerPx,
						height: innerPx,
						// Drop shadow adapts to state
						boxShadow:
							state === "idle"
								? "0 2px 8px rgba(0,0,0,0.12)"
								: state === "listening"
									? "0 0 0 4px rgba(59,130,246,0.25), 0 4px 16px rgba(59,130,246,0.3)"
									: "0 0 0 4px rgba(245,158,11,0.25), 0 4px 16px rgba(245,158,11,0.3)",
					}}
				>
					{/* Microphone icon */}
					<MicIcon className={cn("transition-colors duration-300", cfg.iconColor, iconSize)} />

					{/* Processing: spinning inner ring overlay */}
					{state === "processing" && (
						<span className="absolute inset-1 rounded-full border-2 border-transparent border-t-white/60 border-r-white/30 [animation:mic-arc-spin_0.8s_linear_infinite] pointer-events-none" />
					)}
				</button>
			</div>

			{/* ── Label ────────────────────────────────────────────────────── */}
			<span
				className={cn(
					"text-sm font-semibold tracking-wide transition-all duration-300",
					state === "idle" && "text-slate-400 dark:text-slate-500",
					state === "listening" && "text-blue-500 dark:text-blue-400",
					state === "processing" && "text-amber-500 dark:text-amber-400",
				)}
			>
				{cfg.label}
			</span>
		</div>
	);
}

// Re-export the state type so consumers don't need a second import path
export type { MicState as MicButtonState };

// ─────────────────────────────────────────────────────────────────────────────
// USAGE NOTES
// ─────────────────────────────────────────────────────────────────────────────
//
// Add the following @keyframes to src/app/globals.css:
//
//   /* ── MicButton radial waveform ───────────────────────────── */
//   @keyframes mic-bar-idle {
//     0%, 100% { transform: scaleY(0.25); }
//     50%       { transform: scaleY(0.55); }
//   }
//   @keyframes mic-bar-listening {
//     0%, 100% { transform: scaleY(0.3); }
//     50%       { transform: scaleY(1); }
//   }
//   @keyframes mic-bar-processing {
//     0%        { transform: scaleY(0.15); opacity: 0.3; }
//     50%       { transform: scaleY(0.75); opacity: 1; }
//     100%      { transform: scaleY(0.15); opacity: 0.3; }
//   }
//   @keyframes mic-center-pulse {
//     0%, 100% { transform: scale(1); }
//     50%       { transform: scale(1.07); }
//   }
//   @keyframes mic-arc-spin {
//     to { transform: rotate(360deg); }
//   }
//
// The Tailwind v4 arbitrary animation syntax used here:
//   [animation:mic-bar-idle_2.4s_ease-in-out_infinite]
// requires the keyframe names to exist in a CSS layer that Tailwind can see.
// ─────────────────────────────────────────────────────────────────────────────
