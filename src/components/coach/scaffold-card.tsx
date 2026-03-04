"use client";

import { CheckIcon, ChevronDownIcon, ClipboardIcon } from "lucide-react";
import { useState } from "react";
import { DoItInteractive } from "@/components/coach/do-it-interactive";
import { DrawCanvas } from "@/components/coach/draw-canvas";
import { Manipulative } from "@/components/coach/manipulatives";
import { VoiceOrb } from "@/components/coach/voice-orb";
import type { CoachResponse } from "@/lib/ai/coach";

type CopyButtonProps = { text: string };

function CopyButton({ text }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);
	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard not available
		}
	}
	return (
		<button
			type="button"
			onClick={handleCopy}
			className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
		>
			{copied ? (
				<>
					<CheckIcon className="h-3.5 w-3.5 text-green-600" />
					<span className="text-green-600">Copied</span>
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

type GradeBelowSectionProps = {
	gradePrereq: CoachResponse["gradePrereq"];
	below: CoachResponse["below"];
	cardId: "say" | "ask" | "draw" | "do";
};

function GradeBelowSection({ gradePrereq, below, cardId }: GradeBelowSectionProps) {
	const grade = gradePrereq?.grade ?? "lower";
	const colorMap = {
		say: "border-blue-200/60 bg-blue-50/30",
		ask: "border-violet-200/60 bg-violet-50/30",
		draw: "border-green-200/60 bg-green-50/30",
		do: "border-orange-200/60 bg-orange-50/30",
	};
	const contentMap = {
		say: below.script,
		ask: "",
		draw: below.visual,
		do: below.microIntervention,
	};

	return (
		<div className={`rounded border ${colorMap[cardId]} px-2.5 py-2 flex flex-col gap-1`}>
			<p className="text-xs font-medium text-muted-foreground">
				Grade {grade} level — if they still can't access it:
			</p>
			{cardId === "ask" ? (
				<ol className="flex flex-col gap-1">
					{below.guidingQuestions.map((q, i) => (
						<li key={q} className="flex items-start gap-1.5 text-xs text-foreground leading-snug">
							<span className="shrink-0 font-semibold text-xs mt-0.5">{i + 1}.</span>
							<span>{q}</span>
						</li>
					))}
				</ol>
			) : (
				<p className="text-xs text-foreground leading-relaxed">{contentMap[cardId]}</p>
			)}
		</div>
	);
}

type ApproachCardProps = {
	id: string;
	emoji: string;
	label: string;
	sublabel: string;
	color: string;
	copyText: string;
	isOpen: boolean;
	onToggle: () => void;
	children: React.ReactNode;
	interactive?: React.ReactNode;
};

function ApproachCard({
	emoji,
	label,
	sublabel,
	color,
	copyText,
	isOpen,
	onToggle,
	children,
	interactive,
}: ApproachCardProps) {
	return (
		<div className={`rounded-lg border ${color} overflow-hidden`}>
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center justify-between gap-2 px-3 py-2.5"
			>
				<div className="flex items-center gap-1.5">
					<span className="text-base leading-none">{emoji}</span>
					<span className="text-sm font-semibold text-foreground">{label}</span>
					<span className="text-xs text-muted-foreground">{sublabel}</span>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					{/* biome-ignore lint/a11y/noStaticElementInteractions: stop-propagation wrapper for copy button inside toggle button */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: stop-propagation wrapper for copy button inside toggle button */}
					<span onClick={(e) => e.stopPropagation()}>
						<CopyButton text={copyText} />
					</span>
					<ChevronDownIcon
						className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
					/>
				</div>
			</button>
			{isOpen && (
				<div className="px-3 pb-3 flex flex-col gap-3 border-t border-current/10">
					<div className="pt-2">{children}</div>
					{interactive}
				</div>
			)}
		</div>
	);
}

const APPROACHES = ["Say It", "Ask It", "Draw It", "Do It"] as const;

type StillConfusedPanelProps = {
	onDeepen: (triedApproach: string, deeperContext: string) => void;
};

function StillConfusedPanel({ onDeepen }: StillConfusedPanelProps) {
	const [selected, setSelected] = useState<string | null>(null);
	const [context, setContext] = useState("");

	function handleDig() {
		if (!selected) return;
		onDeepen(selected, context);
		setSelected(null);
		setContext("");
	}

	return (
		<div className="rounded-lg border border-border px-3 py-2.5 flex flex-col gap-2">
			<p className="text-xs font-medium text-muted-foreground">Still confused?</p>
			<div className="flex flex-wrap gap-1.5">
				{APPROACHES.map((approach) => (
					<button
						key={approach}
						type="button"
						onClick={() => setSelected(approach === selected ? null : approach)}
						className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
							selected === approach
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground hover:bg-muted/80"
						}`}
					>
						{approach}
					</button>
				))}
			</div>
			<textarea
				rows={2}
				value={context}
				onChange={(e) => setContext(e.target.value)}
				placeholder="What happened next? (optional)"
				className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
			/>
			<button
				type="button"
				onClick={handleDig}
				disabled={!selected}
				className="self-end rounded px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
			>
				Dig Deeper →
			</button>
		</div>
	);
}

type ScaffoldCardProps = {
	response: CoachResponse;
	onDeepen?: (triedApproach: string, deeperContext: string) => void;
};

export function ScaffoldCard({ response, onDeepen }: ScaffoldCardProps) {
	const [activeCard, setActiveCard] = useState<string | null>(null);

	function toggleCard(id: string) {
		setActiveCard((prev) => (prev === id ? null : id));
	}

	return (
		<div className="flex flex-col gap-3">
			{/* Interpretation — what the AI understood */}
			<div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
				<p className="text-xs font-medium text-muted-foreground mb-1">AI understood:</p>
				<p className="text-sm text-foreground leading-relaxed italic">
					{response.studentInterpretation}
				</p>
			</div>

			{/* Gap — always shown, diagnostic anchor */}
			<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
				<div className="flex items-center gap-2 mb-1">
					<span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-xs font-mono font-bold">
						{response.missingConcept.code}
					</span>
					<span className="text-xs text-amber-700 font-medium">
						Grade {response.missingConcept.grade} gap
					</span>
				</div>
				<p className="text-xs text-amber-900 leading-relaxed">
					{response.missingConcept.explanation}
				</p>
				{response.gradePrereq && (
					<div className="mt-2 pt-2 border-t border-amber-200/60">
						<p className="text-xs text-amber-700 font-medium mb-0.5">
							Grade {response.gradePrereq.grade} prerequisite:
						</p>
						<span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-xs font-mono font-bold mr-1.5">
							{response.gradePrereq.code}
						</span>
						<span className="text-xs text-amber-800 leading-relaxed">
							{response.gradePrereq.connection}
						</span>
					</div>
				)}
			</div>

			{/* See It — visual manipulative (only renders if AI returned one) */}
			<Manipulative spec={response.manipulative} />

			{/* Remediation approaches — accordion */}
			<p className="text-xs font-medium text-muted-foreground px-0.5">Pick your approach:</p>

			{/* Say It */}
			<ApproachCard
				id="say"
				emoji="💬"
				label="Say It"
				sublabel="exact words"
				color="border-blue-200 bg-blue-50/50"
				copyText={response.script}
				isOpen={activeCard === "say"}
				onToggle={() => toggleCard("say")}
				interactive={
					<>
						<VoiceOrb text={response.script} />
						<GradeBelowSection
							gradePrereq={response.gradePrereq}
							below={response.below}
							cardId="say"
						/>
					</>
				}
			>
				<p className="text-sm font-medium text-foreground leading-relaxed">
					&ldquo;{response.script}&rdquo;
				</p>
			</ApproachCard>

			{/* Ask It */}
			<ApproachCard
				id="ask"
				emoji="❓"
				label="Ask It"
				sublabel="guide them to it"
				color="border-violet-200 bg-violet-50/50"
				copyText={response.guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}
				isOpen={activeCard === "ask"}
				onToggle={() => toggleCard("ask")}
				interactive={
					<>
						<VoiceOrb text={response.guidingQuestions.join(". ")} label="Tap to hear all" />
						<GradeBelowSection
							gradePrereq={response.gradePrereq}
							below={response.below}
							cardId="ask"
						/>
					</>
				}
			>
				<ol className="flex flex-col gap-1.5">
					{response.guidingQuestions.map((q, i) => (
						<li key={q} className="flex items-start gap-2 text-sm text-foreground leading-snug">
							<span className="shrink-0 font-semibold text-violet-600 text-xs mt-0.5">
								{i + 1}.
							</span>
							<span>{q}</span>
						</li>
					))}
				</ol>
			</ApproachCard>

			{/* Draw It */}
			<ApproachCard
				id="draw"
				emoji="✏️"
				label="Draw It"
				sublabel="whiteboard sketch"
				color="border-green-200 bg-green-50/50"
				copyText={response.visual}
				isOpen={activeCard === "draw"}
				onToggle={() => toggleCard("draw")}
				interactive={
					<>
						<DrawCanvas />
						<GradeBelowSection
							gradePrereq={response.gradePrereq}
							below={response.below}
							cardId="draw"
						/>
					</>
				}
			>
				<p className="text-sm text-foreground leading-relaxed">{response.visual}</p>
			</ApproachCard>

			{/* Do It */}
			<ApproachCard
				id="do"
				emoji="🖐"
				label="Do It"
				sublabel="30 sec, desk materials"
				color="border-orange-200 bg-orange-50/50"
				copyText={response.microIntervention}
				isOpen={activeCard === "do"}
				onToggle={() => toggleCard("do")}
				interactive={
					<>
						<DoItInteractive instructions={response.microIntervention} />
						<GradeBelowSection
							gradePrereq={response.gradePrereq}
							below={response.below}
							cardId="do"
						/>
					</>
				}
			>
				<p className="text-sm text-foreground leading-relaxed">{response.microIntervention}</p>
			</ApproachCard>

			{/* Still confused? — progressive deepening */}
			{onDeepen && <StillConfusedPanel onDeepen={onDeepen} />}
		</div>
	);
}
