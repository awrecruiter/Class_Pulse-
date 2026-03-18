"use client";

import gsap from "gsap";
import { useEffect, useState } from "react";
import type { CheckQuestion } from "@/lib/ai/questions";

type Props = {
	sessionId: string;
	manipType: "fraction-bar" | "area-model" | "number-line";
	standardCode?: string;
	onClose: () => void;
	onRamEarned?: (amount: number, newBalance: number) => void;
};

type QuizState = "loading" | "question" | "feedback" | "summary" | "mastered" | "error";

const OPTION_LABELS = ["A", "B", "C", "D"];

export function StudentQuiz({ sessionId, manipType, standardCode, onClose, onRamEarned }: Props) {
	const [state, setState] = useState<QuizState>("loading");
	const [questions, setQuestions] = useState<CheckQuestion[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [selected, setSelected] = useState<number | null>(null);
	const [correctCount, setCorrectCount] = useState(0);
	const [streak, setStreak] = useState(0);
	const [threshold, setThreshold] = useState(3);
	const [errorMsg, setErrorMsg] = useState("");

	// Load questions on mount
	useEffect(() => {
		async function load() {
			try {
				const res = await fetch(`/api/sessions/${sessionId}/generate-questions`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ manipType, standardCode }),
				});
				if (!res.ok) throw new Error("Failed to load questions");
				const data = (await res.json()) as { questions: CheckQuestion[] };
				setQuestions(data.questions);
				setState("question");
			} catch {
				setErrorMsg("Couldn't load questions — try again.");
				setState("error");
			}
		}
		load();
	}, [sessionId, manipType, standardCode]);

	async function submitAnswer(optionIndex: number) {
		if (selected !== null || state !== "question") return;
		setSelected(optionIndex);

		const q = questions[currentIndex];
		const isCorrect = optionIndex === q.correctIndex;
		if (isCorrect) setCorrectCount((c) => c + 1);

		// Post to mastery endpoint
		try {
			const res = await fetch(`/api/sessions/${sessionId}/mastery`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					standardCode: standardCode ?? `manip:${manipType}`,
					isCorrect,
				}),
			});
			if (res.ok) {
				const data = (await res.json()) as {
					consecutiveCorrect: number;
					threshold: number;
					achieved: boolean;
					ramBuckEarned?: number;
					newBalance?: number;
				};
				setStreak(data.consecutiveCorrect);
				setThreshold(data.threshold);
				if (data.ramBuckEarned && data.ramBuckEarned > 0 && data.newBalance !== undefined) {
					onRamEarned?.(data.ramBuckEarned, data.newBalance);
				}
				if (data.achieved) {
					setState("feedback");
					// Show feedback briefly, then mastered — use GSAP delayedCall to prevent leak
					const ctx = gsap.context(() => {
						gsap.delayedCall(1.5, () => setState("mastered"));
					});
					return () => ctx.revert();
				}
			}
		} catch {
			// Non-critical — continue without mastery tracking
		}

		setState("feedback");
	}

	function next() {
		if (currentIndex < questions.length - 1) {
			setCurrentIndex((i) => i + 1);
			setSelected(null);
			setState("question");
		} else {
			setState("summary");
		}
	}

	function tryAgain() {
		// Reload fresh questions (harder set conceptually — same endpoint)
		setCurrentIndex(0);
		setSelected(null);
		setCorrectCount(0);
		setState("loading");
		// Re-trigger useEffect won't work for same deps — trigger a reload manually
		fetch(`/api/sessions/${sessionId}/generate-questions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ manipType, standardCode }),
		})
			.then((r) => r.json())
			.then((data: { questions: CheckQuestion[] }) => {
				setQuestions(data.questions);
				setState("question");
			})
			.catch(() => {
				setErrorMsg("Couldn't load new questions.");
				setState("error");
			});
	}

	const q = questions[currentIndex];
	const isCorrect = selected !== null && q && selected === q.correctIndex;

	// ── Loading ───────────────────────────────────────────────────────────────
	if (state === "loading") {
		return (
			<div className="flex flex-col items-center gap-4 py-8">
				<div className="text-4xl animate-spin">🧠</div>
				<p className="text-sm font-medium text-gray-600">Getting your questions ready...</p>
			</div>
		);
	}

	// ── Error ────────────────────────────────────────────────────────────────
	if (state === "error") {
		return (
			<div className="flex flex-col items-center gap-4 py-6 text-center">
				<p className="text-sm text-red-500">{errorMsg}</p>
				<button type="button" onClick={onClose} className="text-sm text-indigo-600 underline">
					Go back
				</button>
			</div>
		);
	}

	// ── Mastered! ────────────────────────────────────────────────────────────
	if (state === "mastered") {
		return (
			<div className="flex flex-col items-center gap-4 py-8 text-center">
				<div className="text-6xl animate-bounce">🎉</div>
				<p className="text-2xl font-bold text-green-600">You got it!</p>
				<p className="text-sm text-gray-600">
					{streak} in a row — you&apos;ve mastered this skill!
				</p>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl bg-green-500 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-green-600"
					>
						Done ✓
					</button>
				</div>
			</div>
		);
	}

	// ── Summary ──────────────────────────────────────────────────────────────
	if (state === "summary") {
		const needed = Math.max(0, threshold - streak);
		return (
			<div className="flex flex-col gap-4 py-4">
				<div className="text-center">
					<p className="text-4xl font-bold text-indigo-700">
						{correctCount}/{questions.length}
					</p>
					<p className="text-sm text-gray-600 mt-1">correct this round</p>
				</div>

				{/* Streak progress */}
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between text-xs text-gray-500">
						<span>Streak</span>
						<span className="font-bold text-indigo-600">
							{streak}/{threshold}
						</span>
					</div>
					<div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
						<div
							className="h-full rounded-full bg-indigo-500 transition-all duration-700"
							style={{ width: `${Math.min(100, (streak / threshold) * 100)}%` }}
						/>
					</div>
					<p className="text-xs text-gray-500 text-center">
						{needed === 0
							? "You're on a streak! 🔥"
							: `${needed} more in a row to master this skill`}
					</p>
				</div>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={tryAgain}
						className="flex-1 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-600 active:scale-95 transition-all"
					>
						Try again →
					</button>
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
					>
						Close
					</button>
				</div>
			</div>
		);
	}

	// ── Question / Feedback ──────────────────────────────────────────────────
	if (!q) return null;

	return (
		<div className="flex flex-col gap-4">
			{/* Progress */}
			<div className="flex items-center justify-between text-xs text-gray-400">
				<span>
					Question {currentIndex + 1} of {questions.length}
				</span>
				{streak > 0 && <span className="text-orange-500 font-bold">🔥 {streak} in a row</span>}
			</div>

			{/* Question */}
			<p className="text-base font-semibold text-gray-800 leading-snug">{q.question}</p>

			{/* Options */}
			<div className="flex flex-col gap-2">
				{q.options.map((opt, i) => {
					const isSelected = selected === i;
					const isRight = i === q.correctIndex;
					let bg = "bg-gray-50 border-gray-200 text-gray-700";
					if (state === "feedback") {
						if (isRight) bg = "bg-green-100 border-green-400 text-green-800";
						else if (isSelected && !isRight) bg = "bg-red-100 border-red-400 text-red-700";
					} else if (isSelected) {
						bg = "bg-indigo-100 border-indigo-400 text-indigo-800";
					}

					return (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: stable option indices
							key={i}
							type="button"
							onClick={() => submitAnswer(i)}
							disabled={selected !== null}
							className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all active:scale-[0.98] disabled:cursor-default ${bg}`}
						>
							<span className="shrink-0 w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-xs font-bold">
								{OPTION_LABELS[i]}
							</span>
							<span className="text-sm font-medium leading-snug">{opt}</span>
							{state === "feedback" && isRight && <span className="ml-auto text-green-600">✓</span>}
							{state === "feedback" && isSelected && !isRight && (
								<span className="ml-auto text-red-500">✗</span>
							)}
						</button>
					);
				})}
			</div>

			{/* Feedback explanation */}
			{state === "feedback" && (
				<div
					className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
						isCorrect
							? "bg-green-50 border border-green-200 text-green-800"
							: "bg-red-50 border border-red-200 text-red-700"
					}`}
				>
					<span className="font-bold mr-1">{isCorrect ? "✅ Correct!" : "Not quite."}</span>
					{q.explanation}
				</div>
			)}

			{/* Next button */}
			{state === "feedback" && (
				<button
					type="button"
					onClick={next}
					className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white hover:bg-indigo-600 active:scale-95 transition-all"
				>
					{currentIndex < questions.length - 1 ? "Next question →" : "See results →"}
				</button>
			)}
		</div>
	);
}
