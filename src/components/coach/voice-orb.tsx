"use client";

import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const CONFIG: Record<
	OrbState,
	{
		ring: string;
		body: string;
		scaleAnim: string;
		ringAnim: string;
		shadow: string;
	}
> = {
	idle: {
		ring: "#818CF8, #A78BFA, #6366F1, #818CF8",
		body: "from-indigo-500 via-violet-500 to-purple-600",
		scaleAnim: "[animation:orb-idle_4s_ease-in-out_infinite]",
		ringAnim: "[animation:orb-ring-slow_4s_linear_infinite]",
		shadow: "0 0 32px 8px rgba(99,102,241,0.3), inset 0 0 24px rgba(255,255,255,0.12)",
	},
	listening: {
		ring: "#2DD4BF, #60A5FA, #818CF8, #2DD4BF",
		body: "from-teal-400 via-blue-500 to-indigo-600",
		scaleAnim: "[animation:orb-listen_1.5s_ease-in-out_infinite]",
		ringAnim: "[animation:orb-ring-slow_2s_linear_infinite]",
		shadow: "0 0 40px 12px rgba(20,184,166,0.4), inset 0 0 24px rgba(255,255,255,0.15)",
	},
	thinking: {
		ring: "#FBBF24, #F97316, #EC4899, #FBBF24",
		body: "from-amber-400 via-orange-500 to-pink-500",
		scaleAnim: "[animation:orb-think_2s_linear_infinite]",
		ringAnim: "[animation:orb-ring-fast_1s_linear_infinite]",
		shadow: "0 0 36px 10px rgba(251,146,60,0.35), inset 0 0 24px rgba(255,255,255,0.12)",
	},
	speaking: {
		ring: "#F472B6, #A78BFA, #818CF8, #F472B6",
		body: "from-pink-500 via-purple-500 to-indigo-500",
		scaleAnim: "[animation:orb-speak_0.6s_ease-in-out_infinite]",
		ringAnim: "[animation:orb-ring-fast_0.8s_linear_infinite]",
		shadow: "0 0 48px 16px rgba(168,85,247,0.45), inset 0 0 24px rgba(255,255,255,0.15)",
	},
};

const LABELS: Record<OrbState, string> = {
	idle: "Tap to speak",
	listening: "Listening…",
	thinking: "Thinking…",
	speaking: "Speaking…",
};

interface VoiceOrbProps {
	state: OrbState;
	onClick: () => void;
	disabled?: boolean;
	size?: "sm" | "md" | "lg";
}

const SIZES = {
	sm: { outer: "w-16 h-16", inset: "inset-[2px]" },
	md: { outer: "w-24 h-24", inset: "inset-[3px]" },
	lg: { outer: "w-32 h-32", inset: "inset-[4px]" },
};

export function VoiceOrb({ state, onClick, disabled, size = "lg" }: VoiceOrbProps) {
	const c = CONFIG[state];
	const s = SIZES[size];
	const isBlob = state === "listening" || state === "speaking";

	return (
		<div className="flex flex-col items-center gap-4 select-none">
			<div className={cn("relative", s.outer, disabled && "opacity-60")}>
				{/* Ambient glow halo */}
				<div
					className={cn(
						"absolute rounded-full bg-gradient-to-br pointer-events-none",
						c.body,
						"[animation:glow-breathe_3s_ease-in-out_infinite]",
						"blur-xl",
					)}
					style={{ inset: "-28%" }}
				/>

				{/* Rotating conic ring */}
				<div
					className={cn("absolute rounded-full pointer-events-none", c.ringAnim)}
					style={{
						inset: "-4px",
						background: `conic-gradient(from var(--orb-angle), ${c.ring})`,
					}}
				/>

				{/* Orb body */}
				<button
					type="button"
					onClick={onClick}
					disabled={disabled}
					aria-label={LABELS[state]}
					className={cn(
						"absolute rounded-full bg-gradient-to-br active:scale-95 transition-[box-shadow]",
						c.body,
						s.inset,
						!isBlob && state !== "thinking" && c.scaleAnim,
						isBlob &&
							"[animation:orb-listen_1.5s_ease-in-out_infinite,blob-morph_8s_ease-in-out_infinite]",
						state === "speaking" &&
							"[animation:orb-speak_0.6s_ease-in-out_infinite,blob-morph_8s_ease-in-out_infinite]",
						state === "thinking" && "[animation:orb-think_2s_linear_infinite]",
					)}
					style={{ boxShadow: c.shadow }}
				>
					{/* Inner glass shine */}
					<div className="absolute inset-[18%] rounded-full bg-white/10 blur-sm pointer-events-none" />
				</button>
			</div>

			<span
				className={cn(
					"text-sm font-medium tracking-wide transition-colors duration-300",
					state === "idle" && "text-slate-400",
					state === "listening" && "text-teal-300",
					state === "thinking" && "text-amber-300",
					state === "speaking" && "text-pink-300",
				)}
			>
				{LABELS[state]}
			</span>
		</div>
	);
}
