"use client";

import { GraduationCapIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VisualResponse } from "@/app/api/coach/visualize/route";
import { BehaviorPanel } from "@/components/coach/behavior-panel";
import { LecturePanel } from "@/components/coach/lecture-panel";
import { LectureVisualizer } from "@/components/coach/lecture-visualizer";
import type { CoachMode } from "@/components/coach/mode-toggle";
import { ModeToggle } from "@/components/coach/mode-toggle";
import { QueryInput } from "@/components/coach/query-input";
import { ScaffoldCard } from "@/components/coach/scaffold-card";
import { useLectureTranscript } from "@/hooks/use-lecture-transcript";
import { useSpeechQuery } from "@/hooks/use-speech-query";
import type { CoachResponse } from "@/lib/ai/coach";

const SESSION_MODE_KEY = "coach-mode";

export default function CoachPage() {
	const [mode, setMode] = useState<CoachMode>("lecture");

	// Restore saved mode after hydration to avoid SSR/client mismatch
	useEffect(() => {
		const saved = sessionStorage.getItem(SESSION_MODE_KEY);
		if (saved === "lecture" || saved === "coach") setMode(saved);
	}, []);

	const [pinnedStandards, setPinnedStandards] = useState<string[]>([]);
	const [manualQuery, setManualQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [response, setResponse] = useState<CoachResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempts, setAttempts] = useState<
		Array<{ studentQuery: string; triedApproach: string; deeperContext: string }>
	>([]);

	const {
		transcript,
		isListening,
		wordCount,
		isSupported,
		startListening,
		stopListening,
		clearTranscript,
	} = useLectureTranscript();

	// ── Lecture Visualizer — debounced AI call every 30s while listening ──────
	const [visual, setVisual] = useState<VisualResponse | null>(null);
	const [visualLoading, setVisualLoading] = useState(false);
	const visualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastVisualTranscript = useRef("");

	useEffect(() => {
		// Only run when actively listening and transcript has grown meaningfully
		if (!isListening || wordCount < 20) return;
		if (transcript === lastVisualTranscript.current) return;

		// Reset debounce timer
		if (visualTimerRef.current) clearTimeout(visualTimerRef.current);

		visualTimerRef.current = setTimeout(async () => {
			lastVisualTranscript.current = transcript;
			setVisualLoading(true);
			try {
				const res = await fetch("/api/coach/visualize", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ transcript, pinnedStandards }),
				});
				if (res.ok) {
					const data = (await res.json()) as VisualResponse;
					setVisual(data);
				}
			} catch {
				// Non-critical — silently fail
			} finally {
				setVisualLoading(false);
			}
		}, 30_000);

		return () => {
			if (visualTimerRef.current) clearTimeout(visualTimerRef.current);
		};
	}, [transcript, isListening, wordCount, pinnedStandards]);

	const {
		query: spokenQuery,
		isRecording,
		startRecording,
		clearQuery,
		isSupported: speechSupported,
	} = useSpeechQuery();

	// Merge spoken query into manual query field
	useEffect(() => {
		if (spokenQuery) setManualQuery(spokenQuery);
	}, [spokenQuery]);

	const handleModeChange = (newMode: CoachMode) => {
		setMode(newMode);
		if (typeof window !== "undefined") {
			sessionStorage.setItem(SESSION_MODE_KEY, newMode);
		}
	};

	const handleMicClick = useCallback(() => {
		if (isRecording) {
			clearQuery();
		} else {
			startRecording();
		}
	}, [isRecording, clearQuery, startRecording]);

	const handleSubmit = useCallback(async () => {
		const q = manualQuery.trim();
		if (!q) return;

		setIsLoading(true);
		setError(null);
		setResponse(null);
		setAttempts([]);

		try {
			const res = await fetch("/api/coach", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					lessonTranscript: transcript,
					studentQuery: q,
					pinnedStandards,
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
			}

			const data = (await res.json()) as CoachResponse;
			setResponse(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
		} finally {
			setIsLoading(false);
		}
	}, [manualQuery, transcript, pinnedStandards]);

	const handleDeepen = useCallback(
		async (triedApproach: string, deeperContext: string) => {
			const newAttempt = { studentQuery: manualQuery.trim(), triedApproach, deeperContext };
			const nextAttempts = [...attempts, newAttempt];
			setAttempts(nextAttempts);
			setIsLoading(true);
			setError(null);

			try {
				const res = await fetch("/api/coach", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						lessonTranscript: transcript,
						studentQuery: manualQuery.trim(),
						pinnedStandards,
						priorAttempts: nextAttempts,
					}),
				});

				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
				}

				const data = (await res.json()) as CoachResponse;
				setResponse(data);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
			} finally {
				setIsLoading(false);
			}
		},
		[manualQuery, attempts, transcript, pinnedStandards],
	);

	const queryWordCount = manualQuery.trim()
		? manualQuery.trim().split(/\s+/).filter(Boolean).length
		: 0;

	// Compact lesson context summary shown in coach mode
	const lectureMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / 130)) : 0;
	const lectureLabel =
		wordCount === 0
			? "No lesson captured yet"
			: `~${lectureMinutes} min captured (${wordCount.toLocaleString()} words)`;

	return (
		<div className="mx-auto max-w-lg px-4 py-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-2">
					<GraduationCapIcon className="h-5 w-5 text-primary" />
					<h1 className="text-lg font-semibold">Coach</h1>
				</div>
				<ModeToggle mode={mode} onChange={handleModeChange} />
			</div>

			{mode === "behavior" ? (
				<BehaviorPanel />
			) : mode === "lecture" ? (
				<div className="flex flex-col gap-4">
					<LecturePanel
						transcript={transcript}
						isListening={isListening}
						wordCount={wordCount}
						isSupported={isSupported}
						pinnedStandards={pinnedStandards}
						onStart={startListening}
						onStop={stopListening}
						onClear={clearTranscript}
						onStandardsChange={setPinnedStandards}
					/>
					<LectureVisualizer visual={visual} loading={visualLoading} />
				</div>
			) : (
				<div className="flex flex-col gap-5">
					{/* Lesson context indicator */}
					<div
						className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
							wordCount > 0
								? "bg-green-50 text-green-800 border border-green-200"
								: "bg-muted text-muted-foreground border border-border"
						}`}
					>
						<span
							className={`h-2 w-2 rounded-full flex-shrink-0 ${wordCount > 0 ? "bg-green-500" : "bg-muted-foreground/40"}`}
						/>
						<span>Lesson: {lectureLabel}</span>
						{wordCount === 0 && (
							<button
								type="button"
								onClick={() => handleModeChange("lecture")}
								className="ml-auto text-xs underline underline-offset-2 hover:no-underline"
							>
								Capture lesson →
							</button>
						)}
					</div>

					{/* Query input */}
					<QueryInput
						query={manualQuery}
						isRecording={isRecording}
						isLoading={isLoading}
						isSupported={speechSupported}
						wordCount={queryWordCount}
						onChange={setManualQuery}
						onMicClick={handleMicClick}
						onSubmit={handleSubmit}
					/>

					{/* Error */}
					{error && (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error}
						</div>
					)}

					{/* Loading skeleton */}
					{isLoading && (
						<div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
							<div className="flex border-b border-border">
								{["Script", "Gap", "Draw", "Go!"].map((label) => (
									<div key={label} className="flex-1 py-2.5 px-2">
										<div className="h-4 bg-muted rounded" />
									</div>
								))}
							</div>
							<div className="p-4 flex flex-col gap-2">
								<div className="h-3 bg-muted rounded w-1/3" />
								<div className="h-4 bg-muted rounded w-full" />
								<div className="h-4 bg-muted rounded w-4/5" />
							</div>
						</div>
					)}

					{/* Response */}
					{response && !isLoading && <ScaffoldCard response={response} onDeepen={handleDeepen} />}
				</div>
			)}
		</div>
	);
}
