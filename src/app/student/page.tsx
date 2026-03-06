"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP);

type RosterItem = {
	id: string;
	display: string;
	studentId: string;
};

type Phase = "enter-code" | "pick-name" | "joining";

// ─── RAM SVG — stylized ram head with curling horns ───────────────────────────
function RamLogo({ size = 56 }: { size?: number }) {
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

export default function StudentJoinPage() {
	const router = useRouter();
	const [phase, setPhase] = useState<Phase>("enter-code");
	const [code, setCode] = useState("");
	const [sessionId, setSessionId] = useState("");
	const [sessionLabel, setSessionLabel] = useState("");
	const [roster, setRoster] = useState<RosterItem[]>([]);
	const [selectedRosterId, setSelectedRosterId] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const cardRef = useRef<HTMLDivElement>(null);
	const logoRef = useRef<HTMLDivElement>(null);

	// Entrance animation
	useGSAP(() => {
		gsap.from(logoRef.current, { y: -20, opacity: 0, duration: 0.6, ease: "back.out(1.7)" });
		gsap.from(cardRef.current, {
			y: 40,
			opacity: 0,
			duration: 0.5,
			ease: "power2.out",
			delay: 0.15,
		});
	}, []);

	// Animate card on phase change
	function animateCardFlip(cb: () => void) {
		gsap.to(cardRef.current, {
			opacity: 0,
			y: -8,
			duration: 0.18,
			ease: "power2.in",
			onComplete: () => {
				cb();
				gsap.fromTo(
					cardRef.current,
					{ opacity: 0, y: 16 },
					{ opacity: 1, y: 0, duration: 0.28, ease: "power2.out" },
				);
			},
		});
	}

	async function handleCodeSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = code.trim().toUpperCase();
		if (trimmed.length !== 6) {
			setError("Enter the 6-character code from your teacher");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const res = await fetch(`/api/sessions/join?code=${trimmed}`);
			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Code not found");
			}
			const json = await res.json();
			setSessionId(json.sessionId);
			setSessionLabel(json.sessionLabel);
			setRoster(json.roster);
			animateCardFlip(() => setPhase("pick-name"));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	async function handleJoin() {
		if (!selectedRosterId) return;
		animateCardFlip(() => setPhase("joining"));
		setError("");
		try {
			const res = await fetch("/api/sessions/join", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ joinCode: code.trim().toUpperCase(), rosterId: selectedRosterId }),
			});
			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Failed to join");
			}
			router.push(`/student/${sessionId}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to join");
			animateCardFlip(() => setPhase("pick-name"));
		}
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 gap-8">
			{/* Logo */}
			<div ref={logoRef} className="flex flex-col items-center gap-3">
				<div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-[#1e2230] shadow-lg ring-1 ring-white/10">
					<RamLogo size={52} />
				</div>
				<div className="text-center">
					<p className="text-2xl font-black tracking-tight text-white">RAM Class</p>
					<p className="text-xs text-slate-500 mt-0.5 font-medium tracking-widest uppercase">
						Student Portal
					</p>
				</div>
			</div>

			{/* Main card */}
			<div
				ref={cardRef}
				className="w-full max-w-sm rounded-2xl bg-[#1a1d27] border border-white/8 shadow-2xl overflow-hidden"
			>
				{phase === "enter-code" && (
					<form onSubmit={handleCodeSubmit} className="flex flex-col gap-5 p-7">
						<div className="text-center">
							<p className="text-lg font-bold text-white">Enter your class code</p>
							<p className="text-sm text-slate-400 mt-1">Your teacher has the 6-digit code</p>
						</div>

						<input
							type="text"
							autoComplete="off"
							autoCorrect="off"
							spellCheck={false}
							maxLength={6}
							placeholder="A B C 1 2 3"
							value={code}
							onChange={(e) => {
								setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
								setError("");
							}}
							className="text-center font-mono text-3xl font-black tracking-[0.35em] rounded-xl border border-white/10 bg-[#0f1117] px-4 py-4 text-amber-400 placeholder:text-slate-700 focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 uppercase transition-colors"
						/>

						{error && (
							<p className="text-center text-sm text-red-400 font-medium bg-red-500/10 rounded-lg py-2">
								{error}
							</p>
						)}

						<button
							type="submit"
							disabled={loading || code.length !== 6}
							className="rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 px-6 py-3.5 text-base font-black text-black shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
						>
							{loading ? "Looking up..." : "Find My Class →"}
						</button>
					</form>
				)}

				{phase === "pick-name" && (
					<div className="flex flex-col gap-4 p-7">
						<div className="text-center">
							<p className="text-lg font-bold text-white">{sessionLabel}</p>
							<p className="text-sm text-slate-400 mt-1">Tap your name below</p>
						</div>

						<div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-0.5">
							{roster.map((student) => {
								const isSelected = selectedRosterId === student.id;
								return (
									<button
										key={student.id}
										type="button"
										onClick={() => setSelectedRosterId(student.id)}
										className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all text-left ${
											isSelected
												? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30"
												: "border-white/8 bg-[#0f1117] hover:border-white/20"
										}`}
									>
										<span
											className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
												isSelected ? "bg-amber-500 text-black" : "bg-white/8 text-slate-400"
											}`}
										>
											{student.display.replace(/\./g, "").slice(0, 2).toUpperCase()}
										</span>
										<div>
											<p className="text-sm font-semibold text-white">{student.display}</p>
											<p className="text-xs text-slate-500">#{student.studentId}</p>
										</div>
										{isSelected && (
											<span className="ml-auto text-[10px] font-bold text-amber-400 uppercase tracking-widest">
												That&apos;s me
											</span>
										)}
									</button>
								);
							})}
						</div>

						{error && (
							<p className="text-center text-sm text-red-400 font-medium bg-red-500/10 rounded-lg py-2">
								{error}
							</p>
						)}

						<button
							type="button"
							onClick={handleJoin}
							disabled={!selectedRosterId}
							className="rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 px-6 py-3.5 text-base font-black text-black shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
						>
							Join Class →
						</button>

						<button
							type="button"
							onClick={() =>
								animateCardFlip(() => {
									setPhase("enter-code");
									setSelectedRosterId("");
								})
							}
							className="text-sm text-slate-500 hover:text-slate-300 transition-colors text-center"
						>
							← Different code
						</button>
					</div>
				)}

				{phase === "joining" && (
					<div className="flex flex-col items-center gap-5 p-12">
						<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 animate-pulse">
							<RamLogo size={44} />
						</div>
						<div className="text-center">
							<p className="text-base font-bold text-white">Joining class...</p>
							<p className="text-sm text-slate-500 mt-1">Hold tight</p>
						</div>
					</div>
				)}
			</div>

			<p className="text-xs text-slate-700">RAM Class Student Portal</p>
		</div>
	);
}
