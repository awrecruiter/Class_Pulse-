"use client";

import { CheckIcon, ClipboardIcon, MicIcon, SendIcon, Volume2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";
import type { BehaviorResponse } from "@/app/api/coach/behavior/route";
import type { VisualResponse } from "@/app/api/coach/visualize/route";
import { AmbientHud } from "@/components/coach/ambient-hud";
import { ComprehensionPanel } from "@/components/coach/comprehension-panel";
import { LectureVisualizer } from "@/components/coach/lecture-visualizer";
import { MicButton, type MicState } from "@/components/coach/mic-button";
import { ParentCommsPanel } from "@/components/coach/parent-comms-panel";
import { ScaffoldCard } from "@/components/coach/scaffold-card";
import { StandardPicker } from "@/components/coach/standard-picker";
import { useLectureTranscript } from "@/hooks/use-lecture-transcript";
import type { CoachResponse } from "@/lib/ai/coach";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
	"bg-red-400",
	"bg-orange-400",
	"bg-amber-400",
	"bg-lime-500",
	"bg-emerald-400",
	"bg-teal-400",
	"bg-cyan-500",
	"bg-blue-400",
	"bg-indigo-400",
	"bg-violet-400",
	"bg-purple-400",
	"bg-pink-400",
	"bg-rose-400",
	"bg-sky-400",
	"bg-green-500",
	"bg-fuchsia-400",
];
const AVATAR_ANIMALS = [
	"🐶",
	"🐱",
	"🐰",
	"🦊",
	"🐻",
	"🐼",
	"🐯",
	"🦁",
	"🐸",
	"🐧",
	"🦋",
	"🐮",
	"🐷",
	"🦄",
	"🐨",
	"🐵",
];

function hashId(id: string) {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return h;
}
const avatarColor = (id: string) => AVATAR_COLORS[hashId(id) % AVATAR_COLORS.length];
const avatarAnimal = (id: string) => AVATAR_ANIMALS[(hashId(id) >> 4) % AVATAR_ANIMALS.length];

// ─── Behavior step color ───────────────────────────────────────────────────────

function stepDotColor(step: number) {
	if (step === 0) return "bg-emerald-500";
	if (step <= 2) return "bg-amber-400";
	if (step <= 4) return "bg-orange-500";
	if (step <= 6) return "bg-red-500";
	return "bg-violet-600";
}

// ─── Student chip ──────────────────────────────────────────────────────────────

function StudentChip({
	student,
	active,
	onTap,
}: {
	student: StudentOverview;
	active: boolean;
	onTap: (s: StudentOverview) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onTap(student)}
			className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-all shrink-0 active:scale-95 border ${
				active
					? "bg-indigo-500/20 border-indigo-500 ring-1 ring-indigo-500"
					: "bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600"
			}`}
		>
			{/* Behavior dot */}
			<span
				className={`w-2 h-2 rounded-full shrink-0 ${stepDotColor(student.behaviorStep)} ${student.behaviorStep >= 5 ? "animate-pulse" : ""}`}
			/>
			{/* Avatar */}
			<div
				className={`h-7 w-7 rounded-lg ${avatarColor(student.rosterId)} flex items-center justify-center shrink-0`}
			>
				<span className="text-sm leading-none select-none">{avatarAnimal(student.rosterId)}</span>
			</div>
			{/* Name + balance */}
			<div className="flex flex-col">
				<span className="text-xs font-medium text-slate-200 leading-none">
					{student.displayName}
				</span>
				<span
					className={`text-[10px] tabular-nums leading-none mt-0.5 ${student.balance > 0 ? "text-amber-400 font-bold" : "text-slate-500"}`}
				>
					🐏 {student.balance}
				</span>
			</div>
		</button>
	);
}

// ─── Utility buttons ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* noop */
		}
	}
	return (
		<button
			type="button"
			onClick={handleCopy}
			className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors shrink-0"
		>
			{copied ? (
				<>
					<CheckIcon className="h-3 w-3 text-emerald-400" />
					<span className="text-emerald-400">Copied</span>
				</>
			) : (
				<>
					<ClipboardIcon className="h-3 w-3" />
					Copy
				</>
			)}
		</button>
	);
}

function SmsSendButton({
	classId,
	rosterId,
	body,
}: {
	classId: string;
	rosterId: string;
	body: string;
}) {
	const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
	async function send() {
		if (state !== "idle") return;
		setState("loading");
		try {
			const res = await fetch(`/api/classes/${classId}/parent-message`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId, body, triggeredBy: "manual" }),
			});
			setState((await res.json()).error ? "error" : "sent");
		} catch {
			setState("error");
		}
	}
	if (state === "sent")
		return (
			<span className="flex items-center gap-1 text-xs text-emerald-400">
				<CheckIcon className="h-3 w-3" />
				Sent
			</span>
		);
	if (state === "error") return <span className="text-xs text-red-400">SMS failed</span>;
	return (
		<button
			type="button"
			onClick={send}
			disabled={state === "loading"}
			className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
		>
			<SendIcon className="h-3 w-3" />
			{state === "loading" ? "Sending…" : "Send SMS"}
		</button>
	);
}

function SpeakButton({ text }: { text: string }) {
	const [speaking, setSpeaking] = useState(false);
	const [ok, setOk] = useState(false);
	useEffect(() => {
		setOk(typeof window !== "undefined" && "speechSynthesis" in window);
	}, []);
	if (!ok) return null;
	function toggle() {
		if (speaking) {
			window.speechSynthesis.cancel();
			setSpeaking(false);
			return;
		}
		const u = new SpeechSynthesisUtterance(text);
		u.onstart = () => setSpeaking(true);
		u.onend = () => setSpeaking(false);
		u.onerror = () => setSpeaking(false);
		window.speechSynthesis.speak(u);
	}
	return (
		<button
			type="button"
			onClick={toggle}
			className={`flex items-center gap-1 text-xs transition-colors shrink-0 ${speaking ? "text-indigo-400 font-medium" : "text-slate-500 hover:text-slate-300"}`}
		>
			<Volume2Icon className="h-3 w-3" />
			{speaking ? "Stop" : "Hear"}
		</button>
	);
}

function ActionBadge({ response }: { response: BehaviorResponse }) {
	if (response.actionType === "general" || response.actionType === "advice") return null;
	const map: Record<string, { label: string; cls: string }> = {
		"ram-buck-award": {
			label: response.ramBuck ? `+${response.ramBuck.amount} RAM Bucks` : "RAM Buck Award",
			cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
		},
		"ram-buck-deduction": {
			label: response.ramBuck ? `-${response.ramBuck.amount} RAM Bucks` : "RAM Buck Deduction",
			cls: "bg-red-500/20 text-red-300 border-red-500/30",
		},
		incident: {
			label: "Incident Logged",
			cls: "bg-orange-500/20 text-orange-300 border-orange-500/30",
		},
		"parent-msg": {
			label: "Parent Message",
			cls: "bg-amber-500/20 text-amber-300 border-amber-500/30",
		},
		iready: { label: "iReady Goal ✓", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
	};
	const b = map[response.actionType];
	if (!b) return null;
	return (
		<span
			className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${b.cls}`}
		>
			{b.label}
		</span>
	);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type HistoryEntry = { role: "user" | "assistant"; content: string };
type BehaviorMsg = {
	id: string;
	role: "teacher" | "coach";
	text: string;
	response?: BehaviorResponse;
	rosterId?: string;
};
type ClassRow = { id: string; label: string; activeSessionId?: string };

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CoachPage() {
	// Lecture transcript
	const {
		transcript,
		isListening,
		wordCount,
		isSupported,
		startListening,
		stopListening,
		clearTranscript,
	} = useLectureTranscript();

	// Lecture visualizer
	const [visual, setVisual] = useState<VisualResponse | null>(null);
	const [visualLoading, setVisualLoading] = useState(false);
	const visualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastVisualRef = useRef("");
	useEffect(() => {
		if (!isListening || wordCount < 20 || transcript === lastVisualRef.current) return;
		if (visualTimerRef.current) clearTimeout(visualTimerRef.current);
		visualTimerRef.current = setTimeout(async () => {
			lastVisualRef.current = transcript;
			setVisualLoading(true);
			try {
				const res = await fetch("/api/coach/visualize", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ transcript }),
				});
				if (res.ok) setVisual((await res.json()) as VisualResponse);
			} catch {
				/* non-critical */
			} finally {
				setVisualLoading(false);
			}
		}, 30_000);
		return () => {
			if (visualTimerRef.current) clearTimeout(visualTimerRef.current);
		};
	}, [transcript, isListening, wordCount]);

	// Classes + roster
	const [classes, setClasses] = useState<ClassRow[]>([]);
	const [selectedClassId, setSelectedClassId] = useState("");
	const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
	const [students, setStudents] = useState<StudentOverview[]>([]);
	const [studentsLoading, setStudentsLoading] = useState(false);
	const [activeStudent, setActiveStudent] = useState<StudentOverview | null>(null);

	useEffect(() => {
		fetch("/api/classes")
			.then((r) => r.json())
			.then((j) => {
				const active = (j.classes ?? []).filter(
					(c: ClassRow & { isArchived: boolean }) => !c.isArchived,
				);
				setClasses(active);
				if (active.length > 0) setSelectedClassId(active[0].id);
			})
			.catch(() => {});
	}, []);

	// Fetch active session when class changes
	useEffect(() => {
		if (!selectedClassId) return;
		fetch(`/api/classes/${selectedClassId}`)
			.then((r) => r.json())
			.then((j) => setActiveSessionId(j.activeSession?.id))
			.catch(() => {});
	}, [selectedClassId]);

	const fetchStudents = useCallback(async (classId: string) => {
		setStudentsLoading(true);
		try {
			const res = await fetch(`/api/classes/${classId}/roster-overview`);
			if (res.ok) setStudents((await res.json()).students ?? []);
		} catch {
			/* noop */
		} finally {
			setStudentsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (selectedClassId) fetchStudents(selectedClassId);
	}, [selectedClassId, fetchStudents]);

	// Orb + input state
	const [inputMode, setInputMode] = useState<"behavior" | "ask">("behavior");
	const [isOrbRecording, setIsOrbRecording] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [textInput, setTextInput] = useState("");
	const [showTextInput, setShowTextInput] = useState(false);

	// Derive mic button state
	const micState: MicState = isOrbRecording ? "listening" : isLoading ? "processing" : "idle";

	// Sync AI state to <html data-ai-state> so the AiPresenceBorder CSS reacts
	useEffect(() => {
		document.documentElement.dataset.aiState = micState;
		return () => {
			delete document.documentElement.dataset.aiState;
		};
	}, [micState]);

	// Behavior chat
	const [behaviorMsgs, setBehaviorMsgs] = useState<BehaviorMsg[]>([]);
	const historyRef = useRef<HistoryEntry[]>([]);
	const pendingStudentRef = useRef<StudentOverview | null>(null);

	// Academic coach
	const [scaffoldResponse, setScaffoldResponse] = useState<CoachResponse | null>(null);
	const [scaffoldError, setScaffoldError] = useState<string | null>(null);
	const [scaffoldAttempts, setScaffoldAttempts] = useState<
		Array<{ studentQuery: string; triedApproach: string; deeperContext: string }>
	>([]);
	const [lastAcademicQuery, setLastAcademicQuery] = useState("");
	const [pinnedStandards, setPinnedStandards] = useState<string[]>([]);

	const bottomRef = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: isLoading triggers scroll
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [behaviorMsgs, scaffoldResponse, isLoading]);

	function handleStudentTap(s: StudentOverview) {
		pendingStudentRef.current = s;
		setActiveStudent(s);
		const name = s.displayName;
		setTextInput((prev) => (prev.includes(name) ? prev : prev ? `${name} ${prev}` : `${name} `));
	}

	function findStudentInText(text: string) {
		const upper = text.toUpperCase();
		for (const s of students) {
			// Match first name or initials
			if (s.firstName && upper.includes(s.firstName.toUpperCase())) return s;
			if (upper.includes(`${s.firstInitial.toUpperCase()}.${s.lastInitial.toUpperCase()}.`))
				return s;
		}
		return null;
	}

	function applyChip(template: string, autoSend = false) {
		const name = activeStudent ? activeStudent.displayName : null;
		const phrase = name
			? template.replace("{}", name)
			: template.replace("{} ", "").replace("{}", "");
		if (autoSend && phrase.trim()) {
			sendBehavior(phrase);
		} else {
			setTextInput(phrase);
			setShowTextInput(true);
			setInputMode("behavior");
		}
	}

	async function sendBehavior(text: string) {
		const trimmed = text.trim();
		if (!trimmed || isLoading) return;
		setBehaviorMsgs((prev) => [
			...prev,
			{ id: crypto.randomUUID(), role: "teacher", text: trimmed },
		]);
		setTextInput("");
		setShowTextInput(false);
		setIsLoading(true);
		setScaffoldResponse(null);
		setScaffoldError(null);
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30_000);
			let res: Response;
			try {
				res = await fetch("/api/coach/behavior", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ message: trimmed, history: historyRef.current.slice(-20) }),
					signal: controller.signal,
				});
			} finally {
				clearTimeout(timeout);
			}
			if (!res.ok) throw new Error(`Coach unavailable (${res.status}). Try again.`);
			const data = (await res.json()) as BehaviorResponse;
			const target = pendingStudentRef.current ?? findStudentInText(trimmed);
			pendingStudentRef.current = null;
			setBehaviorMsgs((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "coach",
					text: data.message,
					response: data,
					rosterId: target?.rosterId,
				},
			]);
			historyRef.current = [
				...historyRef.current,
				{ role: "user", content: trimmed },
				{ role: "assistant", content: data.message },
			];

			if (selectedClassId && target) {
				if (
					(data.actionType === "ram-buck-award" || data.actionType === "iready") &&
					data.ramBuck
				) {
					await fetch(`/api/classes/${selectedClassId}/ram-bucks`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							rosterId: target.rosterId,
							amount: Math.abs(data.ramBuck.amount),
							type: data.actionType === "iready" ? "academic-iready" : "behavior-positive",
							reason: data.ramBuck.reason,
						}),
					});
				} else if (data.actionType === "ram-buck-deduction" && data.ramBuck) {
					await fetch(`/api/classes/${selectedClassId}/ram-bucks`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							rosterId: target.rosterId,
							amount: -Math.abs(data.ramBuck.amount),
							type: "behavior-fine",
							reason: data.ramBuck.reason,
						}),
					});
				} else if (data.actionType === "incident") {
					await fetch(`/api/classes/${selectedClassId}/behavior/incident`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ rosterId: target.rosterId, notes: data.incidentNote ?? "" }),
					});
				}
			}
			if (selectedClassId) fetchStudents(selectedClassId);
		} catch (err) {
			const msg =
				err instanceof DOMException && err.name === "AbortError"
					? "Request timed out — AI took too long. Try again."
					: err instanceof Error
						? err.message
						: "Something went wrong. Try again.";
			setBehaviorMsgs((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "coach",
					text: msg,
					response: { message: "Error", actionType: "general" },
				},
			]);
		} finally {
			setIsLoading(false);
		}
	}

	const sendAcademic = useCallback(
		async (query: string, priorAttempts: typeof scaffoldAttempts = []) => {
			const q = query.trim();
			if (!q || isLoading) return;
			setLastAcademicQuery(q);
			setTextInput("");
			setShowTextInput(false);
			setIsLoading(true);
			setScaffoldError(null);
			setScaffoldResponse(null);
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 45_000);
				let res: Response;
				try {
					res = await fetch("/api/coach", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							lessonTranscript: transcript,
							studentQuery: q,
							pinnedStandards,
							priorAttempts,
						}),
						signal: controller.signal,
					});
				} finally {
					clearTimeout(timeout);
				}
				if (!res.ok) {
					const d = await res.json().catch(() => ({}));
					throw new Error((d as { error?: string }).error ?? `Error ${res.status}`);
				}
				setScaffoldResponse((await res.json()) as CoachResponse);
			} catch (err) {
				setScaffoldError(err instanceof Error ? err.message : "Something went wrong.");
			} finally {
				setIsLoading(false);
			}
		},
		[isLoading, transcript, pinnedStandards],
	);

	const handleDeepen = useCallback(
		async (triedApproach: string, deeperContext: string) => {
			const next = [
				...scaffoldAttempts,
				{ studentQuery: lastAcademicQuery, triedApproach, deeperContext },
			];
			setScaffoldAttempts(next);
			await sendAcademic(lastAcademicQuery, next);
		},
		[scaffoldAttempts, lastAcademicQuery, sendAcademic],
	);

	// Orb recording
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	function toggleOrb() {
		if (isLoading) return;
		if (isOrbRecording) {
			recognitionRef.current?.stop();
			setIsOrbRecording(false);
			return;
		}
		const SR =
			typeof window !== "undefined"
				? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
				: null;
		if (!SR) {
			setShowTextInput(true);
			return;
		}
		const r = new SR();
		r.continuous = false;
		r.interimResults = false;
		r.lang = "en-US";
		r.onresult = (e: SpeechRecognitionEvent) => {
			const t = e.results[0]?.[0]?.transcript ?? "";
			if (t) {
				if (inputMode === "ask") sendAcademic(t);
				else sendBehavior(t);
			}
		};
		r.onend = () => setIsOrbRecording(false);
		r.onerror = () => setIsOrbRecording(false);
		recognitionRef.current = r;
		r.start();
		setIsOrbRecording(true);
	}

	const lectureMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / 130)) : 0;
	const selectedClass = classes.find((c) => c.id === selectedClassId);

	return (
		<div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col">
			{/* ── Top bar ──────────────────────────────────────────────── */}
			<div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center gap-3 flex-wrap">
				{/* Class selector */}
				{classes.length > 1 ? (
					<select
						value={selectedClassId}
						onChange={(e) => setSelectedClassId(e.target.value)}
						className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					>
						{classes.map((c) => (
							<option key={c.id} value={c.id}>
								{c.label}
							</option>
						))}
					</select>
				) : (
					<span className="text-sm font-semibold text-slate-200">
						{selectedClass?.label ?? "Coach"}
					</span>
				)}

				{/* Session status dot */}
				<span
					className={`flex items-center gap-1.5 text-xs font-medium ${activeSessionId ? "text-emerald-400" : "text-slate-500"}`}
				>
					<span
						className={`w-2 h-2 rounded-full ${activeSessionId ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}
					/>
					{activeSessionId ? "Session live" : "No active session"}
				</span>

				<div className="ml-auto flex items-center gap-2">
					{/* Record lesson */}
					{isSupported && (
						<button
							type="button"
							onClick={isListening ? stopListening : startListening}
							className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
								isListening
									? "bg-red-500/20 text-red-300 ring-1 ring-red-500/50"
									: "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
							}`}
						>
							{isListening ? (
								<>
									<span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
									{lectureMinutes}m recording
								</>
							) : (
								<>
									<MicIcon className="h-3 w-3" />
									Record lesson
								</>
							)}
						</button>
					)}
					{wordCount > 0 && (
						<button
							type="button"
							onClick={clearTranscript}
							className="text-slate-500 hover:text-slate-300 transition-colors"
						>
							<XIcon className="h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* ── Main grid ─────────────────────────────────────────────── */}
			<div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[320px_1fr_300px] gap-0">
				{/* ── LEFT: Roster + Comprehension ─────────────────────── */}
				<div className="border-r border-slate-800 flex flex-col gap-0 overflow-y-auto">
					{/* Student roster */}
					<div className="p-4 border-b border-slate-800">
						<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
							{studentsLoading ? "Loading…" : `${students.length} Students`}
						</p>
						{students.length > 0 ? (
							<div className="flex flex-col gap-1.5">
								{students.map((s) => (
									<StudentChip
										key={s.rosterId}
										student={s}
										active={activeStudent?.rosterId === s.rosterId}
										onTap={handleStudentTap}
									/>
								))}
							</div>
						) : !studentsLoading ? (
							<p className="text-xs text-slate-500">No students on roster yet.</p>
						) : null}
					</div>

					{/* Comprehension panel */}
					<div className="p-4">
						{selectedClassId && (
							<ComprehensionPanel classId={selectedClassId} activeSessionId={activeSessionId} />
						)}
					</div>
				</div>

				{/* ── CENTER: Voice cockpit ─────────────────────────────── */}
				<div className="flex flex-col overflow-y-auto">
					{/* Active student bar */}
					{activeStudent && (
						<div className="bg-indigo-500/10 border-b border-indigo-500/20 px-4 py-2 flex items-center justify-between">
							<span className="text-xs font-medium text-indigo-300">
								<span className="text-slate-400 mr-1">Focused:</span>
								{activeStudent.displayName}
								<span className="text-slate-500 mx-1.5">·</span>
								<span className="text-amber-400">🐏 {activeStudent.balance}</span>
								<span className="text-slate-500 mx-1.5">·</span>
								<span
									className={
										activeStudent.behaviorStep > 0 ? "text-orange-400" : "text-emerald-400"
									}
								>
									Step {activeStudent.behaviorStep}
								</span>
							</span>
							<button
								type="button"
								onClick={() => {
									setActiveStudent(null);
									pendingStudentRef.current = null;
								}}
								className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
							>
								<XIcon className="h-3 w-3" />
								Dismiss
							</button>
						</div>
					)}

					{/* Orb area */}
					<div className="flex flex-col items-center justify-center gap-6 px-6 py-10 min-h-[360px]">
						{/* Mode toggle */}
						<div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs font-semibold">
							<button
								type="button"
								onClick={() => {
									setInputMode("behavior");
									setScaffoldResponse(null);
									setScaffoldError(null);
								}}
								className={`px-4 py-2 transition-colors ${inputMode === "behavior" ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}
							>
								🧑‍🏫 Behavior
							</button>
							<button
								type="button"
								onClick={() => {
									setInputMode("ask");
									setShowTextInput(true);
								}}
								className={`px-4 py-2 transition-colors ${inputMode === "ask" ? "bg-indigo-600/30 text-indigo-300" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}
							>
								🎓 Ask Coach
							</button>
						</div>

						{/* Mic button */}
						<MicButton state={micState} onClick={toggleOrb} disabled={isLoading} size="lg" />

						{/* Quick action chips */}
						{inputMode === "behavior" && (
							<div className="flex flex-wrap gap-2 justify-center">
								<button
									type="button"
									onClick={() => applyChip("Give {} bucks for ")}
									className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all"
								>
									🏆 Reward
								</button>
								<button
									type="button"
									onClick={() => applyChip("Step up for {}", !!activeStudent)}
									className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 active:scale-95 transition-all"
								>
									⚠️ Step Up
								</button>
								<button
									type="button"
									onClick={() => applyChip("Call home for {}", !!activeStudent)}
									className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 active:scale-95 transition-all"
								>
									📞 Call Home
								</button>
								<button
									type="button"
									onClick={() => setShowTextInput((v) => !v)}
									className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-700 active:scale-95 transition-all"
								>
									✏️ Type
								</button>
							</div>
						)}

						{/* Standard picker — ask mode only */}
						{inputMode === "ask" && (
							<div className="w-full max-w-md">
								<StandardPicker value={pinnedStandards} onChange={setPinnedStandards} />
							</div>
						)}

						{/* Text input */}
						{(showTextInput || inputMode === "ask") && (
							<div className="flex gap-2 items-end w-full max-w-md">
								<textarea
									rows={2}
									value={textInput}
									onChange={(e) => setTextInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											if (inputMode === "ask") sendAcademic(textInput);
											else sendBehavior(textInput);
										}
									}}
									placeholder={
										inputMode === "ask"
											? "What are your students struggling with?"
											: '"Give Jordan 15 bucks for great focus"'
									}
									autoFocus={inputMode === "ask"}
									className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
									disabled={isLoading}
								/>
								<button
									type="button"
									disabled={!textInput.trim() || isLoading}
									onClick={() => {
										if (inputMode === "ask") sendAcademic(textInput);
										else sendBehavior(textInput);
									}}
									className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 transition-colors"
								>
									<SendIcon className="h-4 w-4" />
								</button>
							</div>
						)}
					</div>

					{/* Scaffold (Ask mode) */}
					{scaffoldError && (
						<div className="mx-6 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
							{scaffoldError}
						</div>
					)}
					{scaffoldResponse && !isLoading && (
						<div className="px-6 pb-4">
							<ScaffoldCard response={scaffoldResponse} onDeepen={handleDeepen} />
						</div>
					)}

					{/* Lecture visualizer */}
					{(visual || visualLoading) && (
						<div className="px-6 pb-4">
							<LectureVisualizer visual={visual} loading={visualLoading} />
						</div>
					)}

					{/* Ambient HUD */}
					{isListening && (
						<div className="px-6 pb-4">
							<AmbientHud
								transcript={transcript}
								isListening={isListening}
								sessionId={activeSessionId}
							/>
						</div>
					)}

					{/* Behavior message log */}
					{behaviorMsgs.length > 0 && (
						<div className="px-6 pb-4 flex flex-col gap-2">
							<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
								Session Log
							</p>
							<div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
								{behaviorMsgs.map((msg) => (
									<div
										key={msg.id}
										className={`flex ${msg.role === "teacher" ? "justify-end" : "justify-start"}`}
									>
										{msg.role === "teacher" ? (
											<div className="max-w-[80%] rounded-xl rounded-tr-sm bg-indigo-600 px-3 py-2">
												<p className="text-sm text-white leading-snug">{msg.text}</p>
											</div>
										) : (
											<div className="max-w-[90%] flex flex-col gap-1.5">
												<div className="rounded-xl rounded-tl-sm border border-slate-700 bg-slate-800 px-3 py-2">
													<div className="flex items-start justify-between gap-2">
														<p className="text-sm text-slate-200 leading-snug flex-1">{msg.text}</p>
														<SpeakButton text={msg.text} />
													</div>
													{msg.response?.ramBuck?.reason && (
														<p className="text-xs text-slate-400 mt-1 italic">
															{msg.response.ramBuck.reason}
														</p>
													)}
												</div>
												{msg.response && <ActionBadge response={msg.response} />}
												{msg.response?.incidentNote && (
													<div className="rounded border-l-2 border-orange-500 bg-slate-800 px-2 py-1.5 flex items-start justify-between gap-2">
														<p className="text-xs text-orange-300 leading-snug flex-1">
															<span className="font-medium">Behavior note: </span>
															{msg.response.incidentNote}
														</p>
														<CopyButton text={msg.response.incidentNote} />
													</div>
												)}
												{msg.response?.parentMessage && (
													<div className="rounded border-l-2 border-amber-500 bg-slate-800 px-2 py-1.5 flex flex-col gap-1">
														<div className="flex items-center justify-between gap-2">
															<span className="text-xs font-medium text-amber-300">
																ClassDojo message
															</span>
															<div className="flex items-center gap-2">
																<CopyButton text={msg.response.parentMessage} />
																{msg.rosterId && selectedClassId && (
																	<SmsSendButton
																		classId={selectedClassId}
																		rosterId={msg.rosterId}
																		body={msg.response.parentMessage}
																	/>
																)}
															</div>
														</div>
														<p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
															{msg.response.parentMessage}
														</p>
													</div>
												)}
											</div>
										)}
									</div>
								))}
								{isLoading && (
									<div className="flex justify-start">
										<div className="rounded-xl rounded-tl-sm border border-slate-700 bg-slate-800 px-3 py-2.5">
											<div className="flex gap-1">
												{[0, 1, 2].map((i) => (
													<span
														key={i}
														className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
														style={{ animationDelay: `${i * 150}ms` }}
													/>
												))}
											</div>
										</div>
									</div>
								)}
								<div ref={bottomRef} />
							</div>
							<button
								type="button"
								onClick={() => {
									setBehaviorMsgs([]);
									historyRef.current = [];
								}}
								className="self-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
							>
								Clear session log
							</button>
						</div>
					)}
				</div>

				{/* ── RIGHT: Parent Comms ──────────────────────────────── */}
				{selectedClassId && (
					<div className="hidden xl:flex xl:flex-col border-l border-slate-800 overflow-hidden">
						<ParentCommsPanel classId={selectedClassId} />
					</div>
				)}
			</div>
		</div>
	);
}
