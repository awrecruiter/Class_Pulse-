"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RosterItem = {
	id: string;
	display: string;
	studentId: string;
};

type Phase = "enter-code" | "pick-name" | "joining";

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
			setPhase("pick-name");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	async function handleJoin() {
		if (!selectedRosterId) return;
		setPhase("joining");
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
			setPhase("pick-name");
		}
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
			{/* Logo / mascot */}
			<div className="mb-8 flex flex-col items-center gap-3">
				<div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-5xl shadow-lg">
					🐏
				</div>
				<h1 className="text-2xl font-bold text-white drop-shadow">RAM Class</h1>
			</div>

			<div className="w-full max-w-sm rounded-2xl bg-white/95 shadow-2xl overflow-hidden">
				{phase === "enter-code" && (
					<form onSubmit={handleCodeSubmit} className="flex flex-col gap-5 p-6">
						<div className="text-center">
							<p className="text-lg font-bold text-gray-800">Enter your class code</p>
							<p className="text-sm text-gray-500 mt-1">Ask your teacher for the code</p>
						</div>

						<input
							type="text"
							autoComplete="off"
							autoCorrect="off"
							spellCheck={false}
							maxLength={6}
							placeholder="ABC123"
							value={code}
							onChange={(e) => {
								setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
								setError("");
							}}
							className="text-center font-mono text-3xl font-bold tracking-[0.3em] rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-4 text-indigo-700 placeholder:text-indigo-200 focus:border-indigo-400 focus:outline-none uppercase"
						/>

						{error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}

						<button
							type="submit"
							disabled={loading || code.length !== 6}
							className="rounded-xl bg-indigo-500 px-6 py-3.5 text-base font-bold text-white shadow-md hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{loading ? "Looking up..." : "Find My Class →"}
						</button>
					</form>
				)}

				{phase === "pick-name" && (
					<div className="flex flex-col gap-4 p-6">
						<div className="text-center">
							<p className="text-lg font-bold text-gray-800">{sessionLabel}</p>
							<p className="text-sm text-gray-500 mt-1">Tap your name</p>
						</div>

						<div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
							{roster.map((student) => (
								<button
									key={student.id}
									type="button"
									onClick={() => setSelectedRosterId(student.id)}
									className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all text-left ${
										selectedRosterId === student.id
											? "border-indigo-500 bg-indigo-50"
											: "border-gray-200 bg-white hover:border-indigo-200"
									}`}
								>
									<span
										className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
											selectedRosterId === student.id
												? "bg-indigo-500 text-white"
												: "bg-gray-100 text-gray-600"
										}`}
									>
										{student.display.replace(".", "").replace(".", "")}
									</span>
									<div>
										<p className="text-sm font-semibold text-gray-800">{student.display}</p>
										<p className="text-xs text-gray-400">ID: {student.studentId}</p>
									</div>
								</button>
							))}
						</div>

						{error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}

						<button
							type="button"
							onClick={handleJoin}
							disabled={!selectedRosterId}
							className="rounded-xl bg-green-500 px-6 py-3.5 text-base font-bold text-white shadow-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							That&apos;s me! Join Class →
						</button>

						<button
							type="button"
							onClick={() => {
								setPhase("enter-code");
								setSelectedRosterId("");
							}}
							className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
						>
							← Enter a different code
						</button>
					</div>
				)}

				{phase === "joining" && (
					<div className="flex flex-col items-center gap-4 p-10">
						<div className="text-5xl animate-bounce">🐏</div>
						<p className="text-lg font-bold text-gray-800">Joining class...</p>
					</div>
				)}
			</div>
		</div>
	);
}
