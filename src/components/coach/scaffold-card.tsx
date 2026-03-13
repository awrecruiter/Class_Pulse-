"use client";
// DEPRECATED: sub-components exported for use by remediation-flow.tsx

import {
	DndContext,
	DragOverlay,
	PointerSensor,
	TouchSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CheckIcon, ChevronDownIcon, ClipboardIcon, FilmIcon, SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DrawCanvas } from "@/components/coach/draw-canvas";
import { Manipulative } from "@/components/coach/manipulatives";
import { TtsButton } from "@/components/coach/tts-button";
import type { CoachResponse } from "@/lib/ai/coach";

// ─── Copy button ─────────────────────────────────────────────────────────────

export function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {}
	}
	return (
		<button
			type="button"
			onClick={handleCopy}
			className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors shrink-0"
		>
			{copied ? (
				<>
					<CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
					<span className="text-emerald-400">Copied</span>
				</>
			) : (
				<>
					<ClipboardIcon className="h-3.5 w-3.5" />
					Copy
				</>
			)}
		</button>
	);
}

// ─── Push-to-students button ──────────────────────────────────────────────────

export function PushButton({
	sessionId,
	spec,
	standardCode,
}: {
	sessionId: string;
	spec: CoachResponse["manipulative"];
	standardCode?: string;
}) {
	const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
	if (!spec) return null;

	async function push() {
		if (state !== "idle") return;
		setState("sending");
		try {
			await fetch(`/api/sessions/${sessionId}/push`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ spec, triggeredBy: "teacher", standardCode }),
			});
			setState("sent");
			setTimeout(() => setState("idle"), 3000);
		} catch {
			setState("idle");
		}
	}

	return (
		<button
			type="button"
			onClick={push}
			disabled={state !== "idle"}
			className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-500/25 disabled:opacity-50"
		>
			<SendIcon className="h-3 w-3" />
			{state === "sent"
				? "Sent to students ✓"
				: state === "sending"
					? "Sending…"
					: "Push to students"}
		</button>
	);
}

// ─── Manim animation player ───────────────────────────────────────────────────

export function ManimPlayer({
	concept,
	transcript,
	seedUrl,
	onReady,
	buttonLabel,
}: {
	concept: string;
	transcript?: string;
	seedUrl?: string | null;
	onReady?: (url: string) => void;
	buttonLabel?: string; // when set: don't auto-render, show button instead
}) {
	const [state, setState] = useState<"idle" | "rendering" | "ready" | "error">(
		seedUrl ? "ready" : "idle",
	);
	const [videoUrl, setVideoUrl] = useState<string | null>(seedUrl ?? null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const didRender = useRef(false);

	// Auto-render on first mount only if no seed and no manual trigger required
	// biome-ignore lint/correctness/useExhaustiveDependencies: handleRender intentionally excluded — mount-only trigger; handleRender changes each render
	useEffect(() => {
		if (buttonLabel || seedUrl || didRender.current) return;
		didRender.current = true;
		handleRender();
	}, [buttonLabel, seedUrl]);

	// Sync if parent provides URL after initial mount
	useEffect(() => {
		if (seedUrl && state !== "ready") {
			setVideoUrl(seedUrl);
			setState("ready");
		}
	}, [seedUrl, state]); // eslint-disable-line react-hooks/exhaustive-deps

	async function handleRender() {
		if (state === "rendering") return;
		setState("rendering");
		setVideoUrl(null);
		setErrorMsg(null);
		try {
			const res = await fetch("/api/coach/animate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ concept, transcript: transcript ?? "" }),
			});
			const data = await res.json();
			if (!res.ok || !data.videoUrl) throw new Error(data.error ?? "Render failed");
			setVideoUrl(data.videoUrl);
			setState("ready");
			onReady?.(data.videoUrl);
			setTimeout(() => videoRef.current?.play(), 100);
		} catch (err) {
			setErrorMsg(err instanceof Error ? err.message : "Render failed");
			setState("error");
		}
	}

	if (state === "rendering") {
		return (
			<div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-slate-800/60 border border-slate-700">
				<div className="h-3.5 w-3.5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin shrink-0" />
				<p className="text-[11px] text-slate-400">Rendering animation (~15s)…</p>
			</div>
		);
	}

	if (state === "ready" && videoUrl) {
		return (
			<div className="flex flex-col gap-2">
				{/* biome-ignore lint/a11y/useMediaCaption: Manim-generated math animation, no caption track available */}
				<video
					ref={videoRef}
					src={videoUrl}
					controls
					loop
					playsInline
					className="w-full rounded-lg border border-slate-700 bg-black"
					style={{ maxHeight: 220 }}
				/>
				<button
					type="button"
					onClick={handleRender}
					className="self-start text-[10px] text-slate-500 hover:text-slate-300 underline"
				>
					Regenerate
				</button>
			</div>
		);
	}

	if (state === "error") {
		return (
			<div className="flex flex-col gap-1.5">
				<p className="text-[11px] text-red-400 px-1">Animation failed: {errorMsg}</p>
				<button
					type="button"
					onClick={handleRender}
					className="self-start flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-violet-500/12 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-colors"
				>
					<FilmIcon className="h-3.5 w-3.5" />
					Retry
				</button>
			</div>
		);
	}

	// Manual trigger button (when buttonLabel is set)
	if (buttonLabel) {
		return (
			<button
				type="button"
				onClick={handleRender}
				className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-colors w-full justify-center"
			>
				<FilmIcon className="h-4 w-4" />
				{buttonLabel}
			</button>
		);
	}

	// idle fallback (shouldn't normally show due to auto-render)
	return (
		<div className="h-8 rounded-lg bg-slate-800/40 border border-slate-700/40 animate-pulse" />
	);
}

// ─── QuestionVisual — AI-driven contextual illustration ─────────────────────

import type { ScaffoldVisual } from "@/lib/ai/coach";

function EmojiRow({ emoji, count, scale = 1 }: { emoji: string; count: number; scale?: number }) {
	return (
		<span className="flex flex-wrap gap-0.5 items-end">
			{Array.from({ length: count }).map((_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: positional index in fixed-length visual array
					key={i}
					style={{ fontSize: `${scale * 1.6}rem`, lineHeight: 1 }}
					className="select-none"
				>
					{emoji}
				</span>
			))}
		</span>
	);
}

// Sort visual — drag-and-drop bins
function SortVisual({ visual }: { visual: Extract<ScaffoldVisual, { type: "sort" }> }) {
	type Piece = { id: string; emoji: string; scale: number; groupLabel: string };

	const allPieces: Piece[] = visual.items.flatMap(({ emoji, label, count, scale = 1 }) =>
		Array.from({ length: count }, (_, i) => ({
			id: `${label}-${i}`,
			emoji,
			scale,
			groupLabel: label,
		})),
	);

	const [placement, setPlacement] = useState<Record<string, string>>(() =>
		Object.fromEntries(allPieces.map((p) => [p.id, "tray"])),
	);
	const [activeId, setActiveId] = useState<string | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
	);

	function piecesIn(binId: string): Piece[] {
		return allPieces.filter((p) => placement[p.id] === binId);
	}

	const activePiece = activeId ? allPieces.find((p) => p.id === activeId) : null;

	return (
		<DndContext
			sensors={sensors}
			onDragStart={(e) => setActiveId(e.active.id as string)}
			onDragEnd={(e) => {
				setActiveId(null);
				if (e.over)
					setPlacement((prev) => ({
						...prev,
						[e.active.id as string]: (e.over?.id ?? "") as string,
					}));
			}}
			onDragCancel={() => setActiveId(null)}
		>
			<div className="flex flex-col gap-2">
				{/* Tray */}
				{piecesIn("tray").length > 0 && (
					<SortBin id="tray" label="Drag to sort ↓" pieces={piecesIn("tray")} />
				)}
				{/* Bins */}
				<div className={`grid gap-2 grid-cols-${Math.min(visual.bins.length, 3)}`}>
					{visual.bins.map((bin) => (
						<SortBin
							key={bin.label}
							id={bin.label}
							label={bin.label}
							pieces={piecesIn(bin.label)}
						/>
					))}
				</div>
				{allPieces.some((p) => placement[p.id] !== "tray") && (
					<button
						type="button"
						onClick={() => setPlacement(Object.fromEntries(allPieces.map((p) => [p.id, "tray"])))}
						className="self-start text-[10px] text-slate-600 hover:text-slate-400 underline"
					>
						Reset
					</button>
				)}
			</div>
			<DragOverlay>
				{activePiece && (
					<span style={{ fontSize: `${(activePiece.scale ?? 1) * 2}rem`, lineHeight: 1 }}>
						{activePiece.emoji}
					</span>
				)}
			</DragOverlay>
		</DndContext>
	);
}

function DraggableItem({ id, emoji, scale }: { id: string; emoji: string; scale: number }) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
	return (
		<span
			ref={setNodeRef}
			{...listeners}
			{...attributes}
			style={{
				transform: CSS.Translate.toString(transform),
				fontSize: `${scale * 1.6}rem`,
				lineHeight: 1,
			}}
			className={`select-none touch-none cursor-grab inline-block ${isDragging ? "opacity-0" : ""}`}
		>
			{emoji}
		</span>
	);
}

function SortBin({
	id,
	label,
	pieces,
}: {
	id: string;
	label: string;
	pieces: { id: string; emoji: string; scale: number }[];
}) {
	const { setNodeRef, isOver } = useDroppable({ id });
	return (
		<div
			ref={setNodeRef}
			className={`flex flex-col gap-1 rounded-xl border-2 border-dashed p-2 min-h-12 transition-colors ${isOver ? "border-indigo-400 bg-indigo-500/10" : "border-slate-600 bg-slate-900/30"}`}
		>
			<p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
			<div className="flex flex-wrap gap-1 items-end">
				{pieces.map((p) => (
					<DraggableItem key={p.id} id={p.id} emoji={p.emoji} scale={p.scale} />
				))}
			</div>
		</div>
	);
}

// Table visual — rows of emoji in labeled columns
// headers[0] = label column header, headers[1] = emoji/count column header
function TableVisual({ visual }: { visual: Extract<ScaffoldVisual, { type: "table" }> }) {
	const labelHeader = visual.headers[0] ?? "Category";
	const countHeader = visual.headers[1] ?? "Count";
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-xs border-collapse">
				<thead>
					<tr>
						<th className="border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200 font-bold text-left">
							{labelHeader}
						</th>
						<th className="border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200 font-bold text-center">
							{countHeader}
						</th>
					</tr>
				</thead>
				<tbody>
					{visual.rows.map((row) => (
						<tr key={row.label}>
							<td className="border border-slate-600 bg-slate-800/60 px-2 py-1.5 text-slate-300 font-semibold">
								{row.label}
							</td>
							<td className="border border-slate-700 bg-slate-900/40 px-2 py-1.5 text-center">
								<EmojiRow emoji={row.emoji} count={row.count} scale={row.scale} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// Compare visual — side-by-side stacks
function CompareVisual({ visual }: { visual: Extract<ScaffoldVisual, { type: "compare" }> }) {
	return (
		<div className={`grid gap-3 grid-cols-${Math.min(visual.groups.length, 3)}`}>
			{visual.groups.map((g) => (
				<div
					key={g.label}
					className="flex flex-col items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/40 p-2"
				>
					<EmojiRow emoji={g.emoji} count={g.count} scale={g.scale} />
					<p className="text-[10px] font-bold text-slate-400 mt-1">{g.label}</p>
					<span className="text-lg font-bold text-slate-200">{g.count}</span>
				</div>
			))}
		</div>
	);
}

// Count visual — grouped objects for counting
function CountVisual({ visual }: { visual: Extract<ScaffoldVisual, { type: "count" }> }) {
	return (
		<div className="flex flex-wrap gap-3">
			{visual.groups.map((g) => (
				<div
					key={g.label}
					className="flex flex-col gap-1 rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2"
				>
					<p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{g.label}</p>
					<EmojiRow emoji={g.emoji} count={g.count} scale={g.scale} />
				</div>
			))}
		</div>
	);
}

// Select visual — tap the correct table/option
function SelectVisual({
	visual,
	correctIndex,
}: {
	visual: Extract<ScaffoldVisual, { type: "select" }>;
	correctIndex?: number;
}) {
	const [picked, setPicked] = useState<number | null>(null);
	return (
		<div className="flex flex-col gap-2">
			<p className="text-[10px] text-slate-500 italic">Tap the correct option</p>
			<div className={`grid gap-2 grid-cols-${Math.min(visual.options.length, 2)}`}>
				{visual.options.map((opt, i) => {
					const isCorrect = correctIndex !== undefined && i === correctIndex;
					const isWrong = picked === i && !isCorrect;
					const showResult = picked !== null;
					return (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: positional
							key={i}
							type="button"
							onClick={() => setPicked(i)}
							disabled={showResult}
							className={`rounded-xl border-2 p-2 text-left transition-all ${
								showResult && isCorrect
									? "border-emerald-500 bg-emerald-500/10"
									: showResult && isWrong
										? "border-red-500 bg-red-500/10"
										: picked === i
											? "border-indigo-500 bg-indigo-500/10"
											: "border-slate-700 bg-slate-900/40 hover:border-slate-500"
							}`}
						>
							<p className="text-[10px] font-bold text-slate-400 mb-1">{opt.label}</p>
							{opt.headers && (
								<table className="w-full text-[10px] border-collapse">
									<thead>
										<tr>
											{opt.headers.map((h) => (
												<th key={h} className="border border-slate-600 px-1 py-0.5 text-slate-300">
													{h}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{opt.rows.map((r) => (
											<tr key={r.label}>
												<td className="border border-slate-700 px-1 py-0.5 text-slate-400">
													{r.label}
												</td>
												<td className="border border-slate-700 px-1 py-0.5 text-center">
													{r.emoji.repeat(Math.min(r.count, 6))}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function QuestionVisual({
	visual,
	correctIndex,
}: {
	visual: ScaffoldVisual;
	correctIndex?: number;
}) {
	if (!visual) return null;
	return (
		<div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-3 py-2.5">
			{visual.type === "sort" && <SortVisual visual={visual} />}
			{visual.type === "table" && <TableVisual visual={visual} />}
			{visual.type === "compare" && <CompareVisual visual={visual} />}
			{visual.type === "count" && <CountVisual visual={visual} />}
			{visual.type === "select" && <SelectVisual visual={visual} correctIndex={correctIndex} />}
		</div>
	);
}

// ─── Progressive scaffold quiz ────────────────────────────────────────────────

type ScaffoldQuestion = CoachResponse["scaffoldQuestions"][number];

export function ScaffoldQuiz({
	questions,
	onComplete,
	manipulative,
}: {
	questions: ScaffoldQuestion[];
	onComplete?: () => void;
	manipulative?: CoachResponse["manipulative"];
}) {
	const [step, setStep] = useState(0);
	const [picked, setPicked] = useState<number | null>(null);
	const [attempts, setAttempts] = useState(0);
	const [mastered, setMastered] = useState(false);
	const [showManipulative, setShowManipulative] = useState(false);

	if (!questions.length) return null;
	const q = questions[step];
	if (!q) return null;

	const isCorrect = picked === q.correct;
	const revealAnswer = attempts >= 2 && picked !== null && !isCorrect;

	function handlePick(i: number) {
		if (picked !== null && isCorrect) return;
		setPicked(i);
		setAttempts((a) => a + 1);
	}

	function handleNext() {
		if (step + 1 >= questions.length) {
			setMastered(true);
			onComplete?.();
		} else {
			setStep((s) => s + 1);
			setPicked(null);
			setAttempts(0);
		}
	}

	if (mastered) {
		return (
			<div className="flex flex-col items-center gap-2 py-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
				<span className="text-3xl">🎉</span>
				<p className="text-sm font-bold text-emerald-300">Mastery unlocked!</p>
				<p className="text-[11px] text-slate-400">
					Student answered all {questions.length} questions correctly.
				</p>
				<button
					type="button"
					onClick={() => {
						setStep(0);
						setPicked(null);
						setAttempts(0);
						setMastered(false);
					}}
					className="text-[11px] text-slate-500 hover:text-slate-300 underline"
				>
					Restart
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{/* Progress */}
			<div className="flex items-center gap-2">
				<div className="flex gap-1 flex-1">
					{questions.map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: question progress bar uses positional index
							key={i}
							className={`h-1 flex-1 rounded-full transition-all duration-300 ${
								i < step ? "bg-emerald-500" : i === step ? "bg-blue-400" : "bg-slate-700"
							}`}
						/>
					))}
				</div>
				<span className="text-[10px] text-slate-500 shrink-0 font-mono">
					{step + 1}/{questions.length}
				</span>
			</div>

			{/* Question + TTS */}
			<div className="flex items-start justify-between gap-3">
				<p className="text-sm font-medium text-slate-200 leading-relaxed flex-1">{q.question}</p>
				<div className="shrink-0">
					<TtsButton text={q.question} size="sm" />
				</div>
			</div>

			{/* AI-driven contextual visual */}
			<QuestionVisual visual={q.visual ?? null} correctIndex={q.correct} />

			{/* Manipulative hint — collapsible */}
			{manipulative && (
				<div>
					<button
						type="button"
						onClick={() => setShowManipulative((v) => !v)}
						className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
					>
						<ChevronDownIcon
							className={`h-3.5 w-3.5 transition-transform ${showManipulative ? "rotate-180" : ""}`}
						/>
						{showManipulative ? "Hide visual helper" : "Show visual helper"}
					</button>
					{showManipulative && (
						<div className="mt-2">
							<Manipulative spec={manipulative} />
						</div>
					)}
				</div>
			)}

			{/* Choices */}
			<div className="flex flex-col gap-1.5">
				{q.choices.map((choice, i) => {
					const isSelected = picked === i;
					const isRight = i === q.correct;
					const showRight = (revealAnswer || isCorrect) && isRight;
					const showWrong = isSelected && picked !== null && !isCorrect && !revealAnswer;
					return (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: answer choice index is stable position identity
							key={i}
							type="button"
							onClick={() => handlePick(i)}
							disabled={isCorrect || revealAnswer}
							className={`w-full text-left rounded-lg border px-3 py-2.5 text-[13px] transition-all ${
								showRight
									? "border-emerald-500/50 bg-emerald-500/12 text-emerald-300"
									: showWrong
										? "border-red-500/50 bg-red-500/10 text-red-300"
										: "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
							}`}
						>
							<span className="font-bold mr-2 text-slate-500 text-[11px]">
								{["A", "B", "C", "D"][i]}.
							</span>
							{choice}
							{showRight && <span className="ml-1.5 text-emerald-400">✓</span>}
							{showWrong && <span className="ml-1.5 text-red-400">✗</span>}
						</button>
					);
				})}
			</div>

			{/* Hint / explanation */}
			{picked !== null && (
				<div
					className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
						isCorrect || revealAnswer
							? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
							: "border-amber-500/25 bg-amber-500/8 text-amber-300"
					}`}
				>
					{isCorrect || revealAnswer ? q.explanation : q.hint}
				</div>
			)}

			{/* Next */}
			{picked !== null && (isCorrect || revealAnswer) && (
				<button
					type="button"
					onClick={handleNext}
					className="self-end rounded-lg bg-blue-600 text-white px-4 py-1.5 text-xs font-bold hover:bg-blue-500 transition-colors"
				>
					{step + 1 >= questions.length ? "Finish →" : "Next →"}
				</button>
			)}
		</div>
	);
}

// ─── Modality card ────────────────────────────────────────────────────────────

export function ModalityCard({
	emoji,
	label,
	sublabel,
	accent,
	copyText,
	isOpen,
	onToggle,
	children,
}: {
	emoji: string;
	label: string;
	sublabel: string;
	accent: string;
	copyText: string;
	isOpen: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}) {
	return (
		<div className={`rounded-xl border overflow-hidden ${accent}`}>
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center justify-between gap-2 px-3.5 py-3"
			>
				<div className="flex items-center gap-2">
					<span className="text-base leading-none">{emoji}</span>
					<span className="text-sm font-semibold text-slate-100">{label}</span>
					<span className="text-[11px] text-slate-500">{sublabel}</span>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: copy button inside toggle */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: copy button inside toggle */}
					<span onClick={(e) => e.stopPropagation()}>
						<CopyButton text={copyText} />
					</span>
					<ChevronDownIcon
						className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
					/>
				</div>
			</button>
			{isOpen && (
				<div className="px-3.5 pb-4 flex flex-col gap-3 border-t border-white/6 pt-3">
					{children}
				</div>
			)}
		</div>
	);
}

// ─── Grade-below toggle wrapper ──────────────────────────────────────────────

export function BelowToggle({
	grade,
	children,
}: {
	grade: number | string;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
			>
				<ChevronDownIcon
					className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
				/>
				{open ? "Hide" : `Show grade ${grade} version`}
			</button>
			{open && <div className="mt-2">{children}</div>}
		</div>
	);
}

// ─── Grade-below fallback block ───────────────────────────────────────────────

export function BelowBlock({
	gradePrereq,
	below,
	modality,
	sessionId,
	standardCode,
}: {
	gradePrereq: CoachResponse["gradePrereq"];
	below: CoachResponse["below"];
	modality: "auditory" | "visual" | "kinesthetic";
	sessionId?: string;
	standardCode?: string;
}) {
	const grade = gradePrereq?.grade ?? "lower";

	return (
		<div className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 flex flex-col gap-2">
			<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
				Grade {grade} — if still can't access it
			</p>

			{modality === "auditory" && (
				<>
					<p className="text-xs text-slate-400 leading-relaxed italic">
						&ldquo;{below.script}&rdquo;
					</p>
					<TtsButton text={below.script} label="Hear grade-below script" />
					<ol className="flex flex-col gap-1">
						{below.guidingQuestions.map((q, i) => (
							<li key={q} className="flex items-start gap-1.5 text-xs text-slate-400 leading-snug">
								<span className="shrink-0 font-bold text-slate-600 mt-0.5">{i + 1}.</span>
								<span>{q}</span>
							</li>
						))}
					</ol>
				</>
			)}

			{modality === "visual" &&
				(below.manipulative ? (
					<div className="flex flex-col gap-2">
						<Manipulative spec={below.manipulative} />
						{sessionId && (
							<PushButton
								sessionId={sessionId}
								spec={below.manipulative}
								standardCode={standardCode}
							/>
						)}
					</div>
				) : (
					<p className="text-xs text-slate-400 leading-relaxed">{below.visual}</p>
				))}

			{modality === "kinesthetic" && (
				<>
					<p className="text-xs text-slate-400 leading-relaxed">{below.visual}</p>
					<p className="text-xs text-slate-400 leading-relaxed">{below.microIntervention}</p>
				</>
			)}
		</div>
	);
}

// ─── Still confused panel ─────────────────────────────────────────────────────

export function StillConfusedPanel({
	onDeepen,
}: {
	onDeepen: (tried: string, context: string) => void;
}) {
	const [selected, setSelected] = useState<string | null>(null);
	const [context, setContext] = useState("");

	return (
		<div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3.5 py-3 flex flex-col gap-2">
			<p className="text-[11px] font-semibold text-slate-400">Still confused?</p>
			<div className="flex flex-wrap gap-1.5">
				{["Auditory", "Visual", "Kinesthetic"].map((m) => (
					<button
						key={m}
						type="button"
						onClick={() => setSelected(m === selected ? null : m)}
						className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
							selected === m
								? "bg-indigo-600 text-white"
								: "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500"
						}`}
					>
						{m}
					</button>
				))}
			</div>
			<textarea
				rows={2}
				value={context}
				onChange={(e) => setContext(e.target.value)}
				placeholder="What happened next? (optional)"
				className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
			/>
			<button
				type="button"
				onClick={() => {
					if (selected) {
						onDeepen(selected, context);
						setSelected(null);
						setContext("");
					}
				}}
				disabled={!selected}
				className="self-end rounded-lg px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 transition-colors"
			>
				Dig Deeper →
			</button>
		</div>
	);
}

// ─── ScaffoldCard ─────────────────────────────────────────────────────────────

type ScaffoldCardProps = {
	response: CoachResponse;
	onDeepen?: (triedApproach: string, deeperContext: string) => void;
	sessionId?: string;
	standardCode?: string;
	transcript?: string;
};

export function ScaffoldCard({
	response,
	onDeepen,
	sessionId,
	standardCode,
	transcript,
}: ScaffoldCardProps) {
	const [activeCard, setActiveCard] = useState<string | null>(null);
	const [sharedAnimUrl, setSharedAnimUrl] = useState<string | null>(null);
	function toggle(id: string) {
		setActiveCard((p) => (p === id ? null : id));
	}

	const animConcept = `${response.missingConcept.description} — ${response.visual}`;

	return (
		<div className="flex flex-col gap-2.5">
			{/* Interpretation */}
			<div className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-3.5 py-2.5">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
					AI understood
				</p>
				<p className="text-sm text-slate-300 leading-relaxed italic">
					{response.studentInterpretation}
				</p>
			</div>

			{/* Gap */}
			<div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5">
				<div className="flex items-center gap-2 mb-1.5">
					<span className="rounded-md bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[11px] font-mono font-bold border border-amber-500/20">
						{response.missingConcept.code}
					</span>
					<span className="text-[11px] text-amber-400/80 font-medium">
						Grade {response.missingConcept.grade} gap
					</span>
				</div>
				<p className="text-xs text-amber-200/80 leading-relaxed">
					{response.missingConcept.explanation}
				</p>
				{response.gradePrereq && (
					<div className="mt-2 pt-2 border-t border-amber-500/15 flex flex-wrap items-baseline gap-1.5">
						<span className="rounded-md bg-amber-500/15 text-amber-400 px-1.5 py-0.5 text-[10px] font-mono font-bold border border-amber-500/15">
							{response.gradePrereq.code}
						</span>
						<span className="text-[11px] text-amber-300/60 leading-relaxed">
							{response.gradePrereq.connection}
						</span>
					</div>
				)}
			</div>

			<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-0.5 pt-0.5">
				Remediate by modality
			</p>

			{/* 🔊 Hear It */}
			<ModalityCard
				emoji="🔊"
				label="Hear It"
				sublabel="scaffold to mastery"
				accent="border-blue-500/20 bg-blue-500/5"
				copyText={response.scaffoldQuestions.map((q, i) => `Q${i + 1}: ${q.question}`).join("\n")}
				isOpen={activeCard === "auditory"}
				onToggle={() => toggle("auditory")}
			>
				<ScaffoldQuiz questions={response.scaffoldQuestions} />
				<div className="mt-1">
					<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
						Animated explanation
					</p>
					<ManimPlayer concept={animConcept} transcript={transcript} onReady={setSharedAnimUrl} />
				</div>
				<BelowToggle grade={response.gradePrereq?.grade ?? "lower"}>
					<BelowBlock
						gradePrereq={response.gradePrereq}
						below={response.below}
						modality="auditory"
						sessionId={sessionId}
						standardCode={standardCode}
					/>
				</BelowToggle>
			</ModalityCard>

			{/* 👁️ See It */}
			<ModalityCard
				emoji="👁️"
				label="See It"
				sublabel="video + mastery"
				accent="border-violet-500/20 bg-violet-500/5"
				copyText={response.visual}
				isOpen={activeCard === "visual"}
				onToggle={() => toggle("visual")}
			>
				<ManimPlayer
					concept={animConcept}
					transcript={transcript}
					seedUrl={sharedAnimUrl}
					onReady={setSharedAnimUrl}
					buttonLabel={sharedAnimUrl ? undefined : "Show me"}
				/>
				{sharedAnimUrl && (
					<>
						<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mt-1">
							Mastery check
						</p>
						<ScaffoldQuiz questions={response.scaffoldQuestions} />
					</>
				)}
			</ModalityCard>

			{/* ✋ Do It */}
			<ModalityCard
				emoji="✋"
				label="Do It"
				sublabel="hands-on"
				accent="border-orange-500/20 bg-orange-500/5"
				copyText={response.microIntervention}
				isOpen={activeCard === "kinesthetic"}
				onToggle={() => toggle("kinesthetic")}
			>
				<p className="text-xs text-slate-400 leading-relaxed">{response.microIntervention}</p>
				{response.manipulative && (
					<div className="flex flex-col gap-2">
						<Manipulative spec={response.manipulative} />
						{sessionId && (
							<PushButton
								sessionId={sessionId}
								spec={response.manipulative}
								standardCode={standardCode}
							/>
						)}
					</div>
				)}
				<DrawCanvas />
				<BelowToggle grade={response.gradePrereq?.grade ?? "lower"}>
					<BelowBlock
						gradePrereq={response.gradePrereq}
						below={response.below}
						modality="kinesthetic"
						sessionId={sessionId}
						standardCode={standardCode}
					/>
				</BelowToggle>
			</ModalityCard>

			{onDeepen && <StillConfusedPanel onDeepen={onDeepen} />}
		</div>
	);
}
