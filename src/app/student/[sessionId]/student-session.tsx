"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { StudentManipulative } from "@/components/coach/manipulatives/student";
import type { CoachResponse } from "@/lib/ai/coach";

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
	emoji: string;
	label: string;
	bg: string;
	ring: string;
	text: string;
}[] = [
	{
		id: "got-it",
		emoji: "✅",
		label: "Got it!",
		bg: "bg-green-100",
		ring: "ring-green-500",
		text: "text-green-700",
	},
	{
		id: "almost",
		emoji: "🤔",
		label: "Almost...",
		bg: "bg-yellow-100",
		ring: "ring-yellow-500",
		text: "text-yellow-700",
	},
	{
		id: "lost",
		emoji: "😕",
		label: "Lost",
		bg: "bg-red-100",
		ring: "ring-red-500",
		text: "text-red-700",
	},
];

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

	// Pushed manipulative state
	const [pushedSpec, setPushedSpec] = useState<ManipSpec>(null);
	const [pushedStandardCode, setPushedStandardCode] = useState<string | undefined>(undefined);
	const [showManip, setShowManip] = useState(false);
	const esRef = useRef<EventSource | null>(null);

	// Connect to student feed SSE to receive pushed manipulatives
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
				// ignore parse errors
			}
		};

		return () => {
			es.close();
		};
	}, [sessionId, isActive]);

	async function submitSignal(signal: Signal) {
		if (isPending) return;
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
		<div className="flex min-h-screen flex-col items-center justify-start px-4 py-10 gap-5">
			{/* Avatar + name */}
			<div className="flex flex-col items-center gap-2">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-4xl shadow-lg">
					🐏
				</div>
				<div className="text-center">
					<p className="text-xl font-bold text-white drop-shadow">Hey, {displayName}</p>
					<p className="text-sm text-white/80">{classLabel}</p>
				</div>
			</div>

			{/* RAM Buck balances */}
			{(ramBalance > 0 || groupBalance !== null) && (
				<div className="flex flex-col items-center gap-1.5">
					{ramBalance > 0 && (
						<div className="rounded-full bg-yellow-400/90 px-4 py-1.5 text-sm font-bold text-yellow-900">
							🐏 {ramBalance} RAM Bucks
						</div>
					)}
					{groupBalance !== null && groupName && (
						<div className="rounded-full bg-blue-200/80 px-3 py-1 text-xs font-semibold text-blue-900">
							{groupName}: 🐏 {groupBalance}
						</div>
					)}
				</div>
			)}

			{/* Pushed manipulative — appears above signal when teacher sends one */}
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

			{/* Main signal card */}
			<div className="w-full max-w-sm rounded-2xl bg-white/95 shadow-2xl p-5 flex flex-col gap-4">
				{isActive ? (
					<>
						{/* Live indicator */}
						<div className="flex items-center justify-center gap-2">
							<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
							<p className="text-xs font-medium text-green-600">Class is live</p>
						</div>

						{/* 3-state signal */}
						<div>
							<p className="text-sm font-bold text-gray-700 text-center mb-3">How are you doing?</p>
							<div className="flex flex-col gap-2">
								{SIGNALS.map((s) => {
									const isSelected = currentSignal === s.id;
									return (
										<button
											key={s.id}
											type="button"
											onClick={() => submitSignal(s.id)}
											disabled={isPending}
											className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all text-left border-2 ${
												isSelected
													? `${s.bg} border-transparent ring-2 ${s.ring} shadow-md scale-[1.02]`
													: "bg-gray-50 border-gray-100 hover:bg-gray-100"
											} disabled:opacity-60`}
										>
											<span className="text-2xl">{s.emoji}</span>
											<span
												className={`text-base font-semibold ${isSelected ? s.text : "text-gray-700"}`}
											>
												{s.label}
											</span>
											{isSelected && (
												<span className="ml-auto text-xs font-medium text-gray-400">selected</span>
											)}
										</button>
									);
								})}
							</div>
						</div>

						{error && <p className="text-center text-xs text-red-500">{error}</p>}

						{currentSignal === "lost" && !showManip && (
							<div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2.5 text-center">
								<p className="text-sm font-medium text-orange-700">
									Your teacher knows you need help 👋
								</p>
								<p className="text-xs text-orange-500 mt-0.5">They&apos;ll send you help soon.</p>
							</div>
						)}
					</>
				) : (
					<div className="flex flex-col items-center gap-3 py-4">
						<span className="text-4xl animate-pulse">⏳</span>
						<p className="text-base font-bold text-gray-800">Waiting for class...</p>
						<p className="text-sm text-gray-500">Your teacher will start the session soon.</p>
					</div>
				)}
			</div>

			{studentId && <p className="text-xs text-white/50">ID: {studentId}</p>}
		</div>
	);
}
