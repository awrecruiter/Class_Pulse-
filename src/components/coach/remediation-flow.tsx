"use client";

import { Volume2Icon, VolumeXIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DrawCanvas } from "@/components/coach/draw-canvas";
import { StudentAreaModel } from "@/components/coach/manipulatives/student/area-model";
import { StudentFractionBar } from "@/components/coach/manipulatives/student/fraction-bar";
import { StudentNumberLine } from "@/components/coach/manipulatives/student/number-line";
import {
	BelowBlock,
	BelowToggle,
	ManimPlayer,
	PushButton,
	ScaffoldQuiz,
	StillConfusedPanel,
} from "@/components/coach/scaffold-card";
import { useNarration } from "@/hooks/use-narration";
import type { CoachResponse } from "@/lib/ai/coach";

// ─── Types ────────────────────────────────────────────────────────────────────

type RemediationStage = "intro" | "animation" | "manipulative" | "practice" | "mastery";
type GradeLevel = 0 | 1 | 2 | 3 | 4 | 5;

const STAGE_ORDER: RemediationStage[] = [
	"intro",
	"animation",
	"manipulative",
	"practice",
	"mastery",
];

const STAGE_LABELS: Record<RemediationStage, string> = {
	intro: "Intro",
	animation: "Animation",
	manipulative: "Hands-On",
	practice: "Practice",
	mastery: "Mastery",
};

type RemediationFlowProps = {
	response: CoachResponse;
	onDeepen?: (triedApproach: string, deeperContext: string) => void;
	onGradeChange?: (grade: number) => void;
	sessionId?: string;
	standardCode?: string;
	transcript?: string;
	isRefetching?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveDefaultGrade(response: CoachResponse): GradeLevel {
	const base = response.gradePrereq?.grade ?? response.missingConcept.grade;
	const g = Math.max(0, base - 1);
	return Math.min(5, g) as GradeLevel;
}

// ─── StageBar ─────────────────────────────────────────────────────────────────

function StageBar({
	stage,
	completed,
	hasManipulative,
	onJump,
}: {
	stage: RemediationStage;
	completed: Set<RemediationStage>;
	hasManipulative: boolean;
	onJump: (s: RemediationStage) => void;
}) {
	const stages = hasManipulative ? STAGE_ORDER : STAGE_ORDER.filter((s) => s !== "manipulative");

	return (
		<div className="flex items-center gap-1.5 flex-wrap">
			{stages.map((s, idx) => {
				const isCurrent = s === stage;
				const isDone = completed.has(s);
				const isAccessible = isDone;
				return (
					<div key={s} className="flex items-center gap-1.5">
						{idx > 0 && (
							<div
								className={`h-px w-4 ${isDone || isCurrent ? "bg-slate-500" : "bg-slate-700"}`}
							/>
						)}
						<button
							type="button"
							onClick={() => isAccessible && onJump(s)}
							disabled={!isAccessible}
							title={STAGE_LABELS[s]}
							className={`flex items-center justify-center rounded-full text-[10px] font-bold transition-all w-6 h-6 ${
								isCurrent
									? "bg-indigo-600 text-white ring-2 ring-indigo-400/60 scale-110"
									: isDone
										? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer"
										: "bg-slate-800 text-slate-600 border border-slate-700 cursor-default"
							}`}
						>
							{isDone && !isCurrent ? "✓" : idx + 1}
						</button>
					</div>
				);
			})}
			<span className="ml-1 text-[10px] text-slate-500 font-medium">{STAGE_LABELS[stage]}</span>
		</div>
	);
}

// ─── GradeStepper ─────────────────────────────────────────────────────────────

function GradeStepper({
	value,
	aiDetected,
	onChange,
}: {
	value: GradeLevel;
	aiDetected: GradeLevel;
	onChange: (g: GradeLevel) => void;
}) {
	const labels = ["K", "1", "2", "3", "4", "5"] as const;
	return (
		<div className="flex items-center gap-1.5 flex-wrap">
			<span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest shrink-0">
				Grade:
			</span>
			{labels.map((label, idx) => {
				const g = idx as GradeLevel;
				const isSelected = value === g;
				const isAiDetected = aiDetected === g;
				return (
					<div key={label} className="relative">
						<button
							type="button"
							onClick={() => onChange(g)}
							className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${
								isSelected
									? "bg-indigo-600 text-white ring-1 ring-indigo-400/60"
									: "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200"
							}`}
						>
							{label}
						</button>
						{isAiDetected && (
							<span className="absolute -top-1.5 -right-1 rounded-sm bg-amber-500 text-[8px] font-bold text-white px-0.5 leading-tight pointer-events-none">
								AI
							</span>
						)}
					</div>
				);
			})}
			{value <= 2 && (
				<span className="rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-semibold px-1.5 py-0.5 ml-1">
					K–2 Mode
				</span>
			)}
		</div>
	);
}

// ─── Suggested Resources ──────────────────────────────────────────────────────

type ResourceLink = {
	platform: "ixl" | "khan" | "iready" | "youtube";
	title: string;
	url: string;
	description: string;
};

const IXL_GRADE_SLUGS: Record<number, string> = {
	0: "kindergarten",
	1: "grade-1",
	2: "grade-2",
	3: "grade-3",
	4: "grade-4",
	5: "grade-5",
};

const PLATFORM_STYLES: Record<
	ResourceLink["platform"],
	{ label: string; badge: string; link: string }
> = {
	khan: {
		label: "Khan Academy",
		badge: "bg-green-500/20 text-green-300 border-green-500/30",
		link: "text-green-400 hover:text-green-300",
	},
	ixl: {
		label: "IXL",
		badge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
		link: "text-violet-400 hover:text-violet-300",
	},
	iready: {
		label: "iReady",
		badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
		link: "text-cyan-400 hover:text-cyan-300",
	},
	youtube: {
		label: "YouTube",
		badge: "bg-red-500/20 text-red-300 border-red-500/30",
		link: "text-red-400 hover:text-red-300",
	},
};

function SuggestedResources({
	grade,
	conceptDescription,
	standardCode,
}: {
	grade: GradeLevel;
	conceptDescription: string;
	standardCode?: string;
}) {
	const gradeLabel = grade === 0 ? "kindergarten" : `grade ${grade}`;
	const gradeDisplay = grade === 0 ? "K" : String(grade);

	// Strip verbose FL BEST opener phrases so search queries are short and findable
	const shortTerms = conceptDescription
		.replace(/^given\s+a\s+mathematical\s+or\s+real-?world\s+context[,.]?\s*/i, "")
		.replace(/^in\s+a\s+mathematical\s+or\s+real-?world\s+context[,.]?\s*/i, "")
		.replace(/^extend\s+(previous\s+)?understanding\s+of\s+/i, "")
		.replace(/^apply\s+(previous\s+)?understanding\s+of\s+/i, "")
		.replace(/^use\s+understanding\s+of\s+/i, "")
		.replace(/^identify\s+and\s+/i, "")
		.replace(/^represent\s+and\s+/i, "")
		.replace(/^solve\s+real-?world\s+and\s+mathematical\s+problems\s*/i, "")
		.split(/\s+/)
		.slice(0, 6)
		.join(" ");

	const khanQ = encodeURIComponent(`${shortTerms} ${gradeLabel} math`);
	const ytQ = encodeURIComponent(`${shortTerms} ${gradeLabel} math`);

	// IXL: anchor to the specific FL BEST standard so it jumps right to the skill
	const ixlSlug = IXL_GRADE_SLUGS[grade] ?? "grade-5";
	const ixlAnchor = standardCode ? `#${standardCode}` : "";
	const ixlUrl = `https://www.ixl.com/standards/florida/math/${ixlSlug}${ixlAnchor}`;

	const khanUrl = `https://www.khanacademy.org/search?page_search_query=${khanQ}`;
	const ytUrl = `https://www.youtube.com/results?search_query=${ytQ}`;
	const ireadyUrl = "https://login.i-ready.com/";

	const resources: ResourceLink[] = [
		{
			platform: "ixl",
			title: standardCode ? `IXL — ${standardCode}` : `IXL — FL Standards Grade ${gradeDisplay}`,
			url: ixlUrl,
			description:
				"FL BEST-aligned skills — click to jump to this exact standard and find the linked IXL skill",
		},
		{
			platform: "khan",
			title: `Search: "${shortTerms}"`,
			url: khanUrl,
			description: `Khan Academy lessons on this concept at the ${gradeLabel} level`,
		},
		{
			platform: "iready",
			title: `iReady — Grade ${gradeDisplay}`,
			url: ireadyUrl,
			description: `Log in, go to Instruction → Lesson Library, and search: "${shortTerms}"`,
		},
		{
			platform: "youtube",
			title: `Search: "${shortTerms}"`,
			url: ytUrl,
			description: `YouTube math videos for ${gradeLabel} on this concept`,
		},
	];

	return (
		<div className="flex flex-col gap-2">
			<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
				Suggested resources — Grade {grade === 0 ? "K" : grade}
			</p>
			{resources.map((r) => {
				const s = PLATFORM_STYLES[r.platform];
				return (
					<div
						key={r.platform}
						className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 flex items-start gap-2.5"
					>
						<span
							className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${s.badge}`}
						>
							{s.label}
						</span>
						<div className="flex-1 min-w-0">
							{r.url ? (
								<a
									href={r.url}
									target="_blank"
									rel="noopener noreferrer"
									className={`text-xs font-semibold transition-colors ${s.link}`}
								>
									{r.title} ↗
								</a>
							) : (
								<span className="text-xs font-semibold text-slate-400">{r.title}</span>
							)}
							<p className="text-[10px] text-slate-500 leading-snug mt-0.5">{r.description}</p>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ─── IntroStage ───────────────────────────────────────────────────────────────

function IntroStage({
	response,
	scaffoldGrade,
	aiDetectedGrade,
	onGradeChange,
	// biome-ignore lint/correctness/noUnusedFunctionParameters: used in JSX onClick handlers
	onNext,
	// biome-ignore lint/correctness/noUnusedFunctionParameters: used in JSX onClick handlers
	onSkipToHands,
}: {
	response: CoachResponse;
	scaffoldGrade: GradeLevel;
	aiDetectedGrade: GradeLevel;
	onGradeChange: (g: GradeLevel) => void;
	onNext: () => void;
	onSkipToHands: () => void;
}) {
	const showFLBESTCode = scaffoldGrade > 2 && /^MA\.\d/.test(response.missingConcept.code);

	return (
		<div className="flex flex-col gap-3">
			{/* Gap diagnosis */}
			<div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5">
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2 flex-wrap">
						{showFLBESTCode && (
							<span className="rounded-md bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[11px] font-mono font-bold border border-amber-500/20">
								{response.missingConcept.code}
							</span>
						)}
						<span className="text-[11px] text-amber-400/80 font-medium">
							Grade {response.missingConcept.grade} gap
						</span>
						{scaffoldGrade !== aiDetectedGrade && (
							<span className="rounded-md bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 text-[11px] font-semibold border border-indigo-500/20">
								Scaffolded to Grade {scaffoldGrade === 0 ? "K" : scaffoldGrade}
							</span>
						)}
					</div>
					<p className="text-xs text-amber-200/80 leading-relaxed">
						{response.missingConcept.explanation}
					</p>
					{/* Grade stepper inline */}
					<div className="pt-1 border-t border-amber-500/15">
						<GradeStepper
							value={scaffoldGrade}
							aiDetected={aiDetectedGrade}
							onChange={onGradeChange}
						/>
					</div>
				</div>
			</div>

			{/* AI interpretation */}
			<div className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-3.5 py-2.5">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
					AI understood
				</p>
				<p className="text-sm text-slate-300 leading-relaxed italic">
					{response.studentInterpretation}
				</p>
			</div>

			{/* Script */}
			<div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3.5 py-2.5">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/80 mb-1.5">
					Say this now
				</p>
				<p className="text-sm text-slate-200 leading-relaxed">&ldquo;{response.script}&rdquo;</p>
			</div>

			{/* Guiding questions */}
			<div className="flex flex-col gap-1.5">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
					Guiding questions
				</p>
				<ol className="flex flex-col gap-1">
					{response.guidingQuestions.map((q, i) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: stable question indices
							key={i}
							className="flex items-start gap-2 text-xs text-slate-300 leading-snug"
						>
							<span className="shrink-0 font-bold text-slate-600 mt-0.5">{i + 1}.</span>
							<span>{q}</span>
						</li>
					))}
				</ol>
			</div>

			{/* Suggested resources — grade stepper above controls which grade shows */}
			<SuggestedResources
				grade={scaffoldGrade}
				conceptDescription={response.missingConcept.description}
				standardCode={response.missingConcept.code}
			/>

			{/* Action buttons — hidden until RAG remediation is ready
			<div className="flex gap-2 pt-1">
				<button
					type="button"
					onClick={onNext}
					className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-colors text-center"
				>
					Show Animation →
				</button>
				<button
					type="button"
					onClick={onSkipToHands}
					className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors text-center"
				>
					Skip to Hands-On
				</button>
			</div>
			*/}
		</div>
	);
}

// ─── AnimationStage ───────────────────────────────────────────────────────────

function AnimationStage({
	response,
	transcript,
	sharedAnimUrl,
	onReady,
	onNext,
}: {
	response: CoachResponse;
	transcript?: string;
	sharedAnimUrl: string | null;
	onReady: (url: string) => void;
	onNext: () => void;
}) {
	const animConcept = `${response.missingConcept.description} — ${response.visual}`;

	return (
		<div className="flex flex-col gap-3">
			<ManimPlayer
				concept={animConcept}
				transcript={transcript}
				seedUrl={sharedAnimUrl}
				onReady={onReady}
			/>
			<button
				type="button"
				onClick={onNext}
				className="self-end rounded-xl px-5 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
			>
				Continue →
			</button>
		</div>
	);
}

// ─── ManipulativeStage ────────────────────────────────────────────────────────

function ManipulativeStage({
	response,
	sessionId,
	standardCode,
	onNext,
}: {
	response: CoachResponse;
	sessionId?: string;
	standardCode?: string;
	onNext: () => void;
}) {
	const spec = response.manipulative;
	if (!spec) return null;

	return (
		<div className="flex flex-col gap-3">
			{spec.caption && (
				<p className="text-xs text-slate-400 leading-relaxed italic">{spec.caption}</p>
			)}

			{/* Interactive manipulative */}
			<div className="rounded-xl bg-white p-3 border border-slate-700/60">
				{spec.type === "fraction-bar" && spec.bars && <StudentFractionBar bars={spec.bars} />}
				{spec.type === "area-model" &&
					spec.rows !== undefined &&
					spec.cols !== undefined &&
					spec.shadedRows !== undefined &&
					spec.shadedCols !== undefined && (
						<StudentAreaModel
							rows={spec.rows}
							cols={spec.cols}
							shadedRows={spec.shadedRows}
							shadedCols={spec.shadedCols}
						/>
					)}
				{spec.type === "number-line" &&
					spec.min !== undefined &&
					spec.max !== undefined &&
					spec.markers && (
						<StudentNumberLine
							min={spec.min}
							max={spec.max}
							markers={spec.markers}
							highlightIndex={spec.highlightIndex}
						/>
					)}
			</div>

			{/* Draw canvas */}
			<div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
				<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
					Teacher sketch
				</p>
				<DrawCanvas />
			</div>

			{/* Push + Continue */}
			<div className="flex items-center justify-between gap-2">
				{sessionId && <PushButton sessionId={sessionId} spec={spec} standardCode={standardCode} />}
				<button
					type="button"
					onClick={onNext}
					className="ml-auto rounded-xl px-5 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
				>
					Continue →
				</button>
			</div>
		</div>
	);
}

// ─── PracticeStage ────────────────────────────────────────────────────────────

function PracticeStage({
	response,
	onComplete,
}: {
	response: CoachResponse;
	onComplete: () => void;
}) {
	return (
		<div className="flex flex-col gap-3">
			<ScaffoldQuiz
				questions={response.scaffoldQuestions}
				onComplete={onComplete}
				manipulative={response.manipulative ?? undefined}
			/>
		</div>
	);
}

// ─── MasteryStage ─────────────────────────────────────────────────────────────

function MasteryStage({
	response,
	sessionId,
	standardCode,
	onDeepen,
}: {
	response: CoachResponse;
	sessionId?: string;
	standardCode?: string;
	onDeepen?: (tried: string, context: string) => void;
}) {
	return (
		<div className="flex flex-col gap-3">
			{/* Celebration */}
			<div className="flex flex-col items-center gap-2 py-5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
				<span className="text-4xl">🎉</span>
				<p className="text-base font-bold text-emerald-300">Mastery unlocked!</p>
				<p className="text-xs text-slate-400">Student completed all practice questions.</p>
			</div>

			{/* Below toggle */}
			<BelowToggle grade={response.gradePrereq?.grade ?? "lower"}>
				<div className="flex flex-col gap-2">
					<BelowBlock
						gradePrereq={response.gradePrereq}
						below={response.below}
						modality="auditory"
						sessionId={sessionId}
						standardCode={standardCode}
					/>
					<BelowBlock
						gradePrereq={response.gradePrereq}
						below={response.below}
						modality="visual"
						sessionId={sessionId}
						standardCode={standardCode}
					/>
					<BelowBlock
						gradePrereq={response.gradePrereq}
						below={response.below}
						modality="kinesthetic"
						sessionId={sessionId}
						standardCode={standardCode}
					/>
				</div>
			</BelowToggle>

			{onDeepen && <StillConfusedPanel onDeepen={onDeepen} />}
		</div>
	);
}

// ─── RemediationFlow ──────────────────────────────────────────────────────────

export function RemediationFlow({
	response,
	onDeepen,
	onGradeChange,
	sessionId,
	standardCode,
	transcript,
	isRefetching,
}: RemediationFlowProps) {
	const aiDetectedGrade = deriveDefaultGrade(response);
	const [stage, setStage] = useState<RemediationStage>("intro");
	const [completed, setCompleted] = useState<Set<RemediationStage>>(new Set());
	const [scaffoldGrade, setScaffoldGrade] = useState<GradeLevel>(aiDetectedGrade);
	const [sharedAnimUrl, setSharedAnimUrl] = useState<string | null>(null);
	const [narrationEnabled, setNarrationEnabled] = useState(true);
	const { speak, stop } = useNarration();

	// Guard to avoid double-firing narration
	const narrationKeyRef = useRef("");
	// Keep narration texts in a ref so the stage useEffect doesn't re-fire on every response field change
	const narrationTextsRef = useRef<Record<RemediationStage, string | null>>({
		intro: null,
		animation: null,
		manipulative: null,
		practice: null,
		mastery: "Great work! Let's check for understanding.",
	});

	// Sync narration texts ref whenever response changes
	useEffect(() => {
		narrationTextsRef.current = {
			intro: response.script,
			animation: null,
			manipulative: response.manipulative?.caption ?? null,
			practice: response.scaffoldQuestions[0]?.question ?? null,
			mastery: "Great work! Let's check for understanding.",
		};
	}, [response.script, response.manipulative?.caption, response.scaffoldQuestions]);

	// Reset on response change (new fetch), but preserve scaffoldGrade
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only response identity should trigger reset
	useEffect(() => {
		setStage("intro");
		setCompleted(new Set());
		setSharedAnimUrl(null);
		stop();
	}, [response]);

	// Narrate on stage mount with 400ms delay
	useEffect(() => {
		const key = `${stage}`;
		if (narrationKeyRef.current === key) return;
		narrationKeyRef.current = key;

		const text = narrationTextsRef.current[stage];
		if (!text || !narrationEnabled) return;

		const t = setTimeout(() => speak(text), 400);
		return () => clearTimeout(t);
	}, [stage, speak, narrationEnabled]);

	const hasManipulative = response.manipulative !== null;

	function markCompleted(s: RemediationStage) {
		setCompleted((prev) => new Set([...prev, s]));
	}

	function advanceTo(next: RemediationStage) {
		markCompleted(stage);
		stop();
		setStage(next);
	}

	function getNextStage(current: RemediationStage): RemediationStage {
		if (current === "intro") return "animation";
		if (current === "animation") return hasManipulative ? "manipulative" : "practice";
		if (current === "manipulative") return "practice";
		if (current === "practice") return "mastery";
		return "mastery";
	}

	function handleGradeChange(g: GradeLevel) {
		setScaffoldGrade(g);
		setStage("intro");
		setCompleted(new Set());
		setSharedAnimUrl(null);
		stop();
		onGradeChange?.(g);
	}

	function handleSkipToHands() {
		markCompleted("intro");
		if (hasManipulative) {
			markCompleted("animation");
			stop();
			setStage("manipulative");
		} else {
			markCompleted("animation");
			stop();
			setStage("practice");
		}
	}

	function handleJump(s: RemediationStage) {
		stop();
		setStage(s);
	}

	if (isRefetching) {
		return (
			<div className="flex flex-col gap-3 animate-pulse">
				<div className="h-5 rounded-lg bg-slate-800/60 w-1/2" />
				<div className="h-20 rounded-xl bg-slate-800/40" />
				<div className="h-12 rounded-xl bg-slate-800/40" />
				<div className="h-24 rounded-xl bg-slate-800/40" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{/* Stage bar + voice toggle */}
			<div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3.5 py-2.5 flex items-center justify-between gap-2">
				<StageBar
					stage={stage}
					completed={completed}
					hasManipulative={hasManipulative}
					onJump={handleJump}
				/>
				<button
					type="button"
					onClick={() => {
						if (narrationEnabled) stop();
						setNarrationEnabled((v) => !v);
					}}
					title={narrationEnabled ? "Voice narration on — tap to mute" : "Voice narration muted"}
					className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${narrationEnabled ? "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25" : "text-slate-600 hover:text-slate-400 hover:bg-slate-800"}`}
				>
					{narrationEnabled ? (
						<Volume2Icon className="h-3.5 w-3.5" />
					) : (
						<VolumeXIcon className="h-3.5 w-3.5" />
					)}
					{narrationEnabled ? "Voice" : "Muted"}
				</button>
			</div>

			{/* Stage content */}
			{stage === "intro" && (
				<IntroStage
					response={response}
					scaffoldGrade={scaffoldGrade}
					aiDetectedGrade={aiDetectedGrade}
					onGradeChange={handleGradeChange}
					onNext={() => advanceTo(getNextStage("intro"))}
					onSkipToHands={handleSkipToHands}
				/>
			)}

			{stage === "animation" && (
				<AnimationStage
					response={response}
					transcript={transcript}
					sharedAnimUrl={sharedAnimUrl}
					onReady={setSharedAnimUrl}
					onNext={() => advanceTo(getNextStage("animation"))}
				/>
			)}

			{stage === "manipulative" && hasManipulative && (
				<ManipulativeStage
					response={response}
					sessionId={sessionId}
					standardCode={standardCode}
					onNext={() => advanceTo(getNextStage("manipulative"))}
				/>
			)}

			{stage === "practice" && (
				<PracticeStage response={response} onComplete={() => advanceTo("mastery")} />
			)}

			{stage === "mastery" && (
				<MasteryStage
					response={response}
					sessionId={sessionId}
					standardCode={standardCode}
					onDeepen={onDeepen}
				/>
			)}
		</div>
	);
}
