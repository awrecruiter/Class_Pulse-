"use client";

import {
	BanknoteIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ClipboardIcon,
	MicIcon,
	SendIcon,
	Volume2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";
import type { BehaviorResponse } from "@/app/api/coach/behavior/route";
import type { VisualResponse } from "@/app/api/coach/visualize/route";
import { AmbientHud } from "@/components/coach/ambient-hud";
import { ComprehensionPanel } from "@/components/coach/comprehension-panel";
import { DiPanel } from "@/components/coach/di-panel";
import { GroupsSidebarPanel } from "@/components/coach/groups-sidebar-panel";
import { LectureVisualizer } from "@/components/coach/lecture-visualizer";
import type { MicState } from "@/components/coach/mic-button";
import { ParentCommsPanel } from "@/components/coach/parent-comms-panel";
import { RemediationFlow } from "@/components/coach/remediation-flow";
import { StandardPicker } from "@/components/coach/standard-picker";
import { WaveformMeter } from "@/components/coach/waveform-meter";
import { useVoiceQueue } from "@/contexts/voice-queue";
import { parseCommand } from "@/hooks/use-global-voice-commands";
import { useLectureTranscript } from "@/hooks/use-lecture-transcript";
import { useMicAnalyser } from "@/hooks/use-mic-analyser";
import { useMicSlot } from "@/hooks/use-mic-manager";
import type { CoachResponse } from "@/lib/ai/coach";
import { playActivationChime } from "@/lib/chime";

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
const _avatarAnimal = (id: string) => AVATAR_ANIMALS[(hashId(id) >> 4) % AVATAR_ANIMALS.length];

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
			className={`relative flex flex-col items-center gap-1 rounded-xl p-2 transition-all active:scale-95 border ${
				active
					? "bg-indigo-500/20 border-indigo-500 ring-1 ring-indigo-500"
					: "bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600"
			}`}
		>
			{/* Behavior dot — top right */}
			<span
				className={`absolute top-1 right-1 w-2 h-2 rounded-full ${stepDotColor(student.behaviorStep)} ${student.behaviorStep >= 5 ? "animate-pulse" : ""}`}
			/>
			{/* Avatar */}
			<div
				className={`h-9 w-9 rounded-lg ${avatarColor(student.rosterId)} flex items-center justify-center shrink-0`}
			>
				<span className="text-[12px] font-bold leading-none select-none text-white/90">
					{(student.firstName ? student.firstName[0] : student.firstInitial).toUpperCase()}
					{student.lastInitial.toUpperCase()}
				</span>
			</div>
			{/* Name */}
			<span className="text-[10px] font-medium text-slate-200 leading-tight text-center w-full truncate px-0.5">
				{student.displayName}
			</span>
			{/* Balance */}
			<span
				className={`inline-flex items-center gap-0.5 text-[9px] tabular-nums leading-none ${student.balance > 0 ? "text-amber-400 font-bold" : "text-slate-500"}`}
			>
				<BanknoteIcon className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
				{student.balance}
			</span>
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
type ClassRow = { id: string; label: string; gradeLevel?: string; activeSessionId?: string };

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CoachPage() {
	// Voice queue — used to pipe lecture finals through command parser
	const {
		queue,
		enqueue,
		confirm,
		setDrawerOpen,
		setLectureMicActive,
		setActiveClassId,
		stopCommandsNow,
	} = useVoiceQueue();

	const handleFinalResult = useCallback(
		(text: string) => {
			const cmd = parseCommand(text);
			if (!cmd) return;
			let label = "";
			switch (cmd.type) {
				case "consequence":
					label = `Queued: ${cmd.stepLabel} for ${cmd.studentName}`;
					break;
				case "ram_bucks":
					label = `Queued: +${cmd.amount} RAM Bucks for ${cmd.studentName}`;
					break;
				case "group_coins":
					label = `Queued: +${cmd.amount} coins for ${cmd.group}`;
					break;
				case "parent_message":
					label = `Queued: message to ${cmd.studentName}'s parent`;
					break;
			}
			enqueue(cmd, text);
			toast.success(label, {
				description: "Tap Voice Queue to review",
				duration: 4000,
				action: { label: "Review", onClick: () => setDrawerOpen(true) },
			});
		},
		[enqueue, setDrawerOpen],
	);

	// Lecture transcript
	const {
		transcript,
		isListening,
		wordCount,
		isSupported,
		startListening,
		stopListening,
		clearTranscript,
	} = useLectureTranscript({ onFinalResult: handleFinalResult });

	// Signal to VoiceCommandProvider to yield its mic while lecture is active
	useEffect(() => {
		setLectureMicActive(isListening);
		return () => setLectureMicActive(false);
	}, [isListening, setLectureMicActive]);

	// Flash "saved" indicator when mic stops with captured words
	const [savedWordCount, setSavedWordCount] = useState(0);
	const [showSaved, setShowSaved] = useState(false);
	const prevListeningRef = useRef(false);
	useEffect(() => {
		if (prevListeningRef.current && !isListening && wordCount > 0) {
			setSavedWordCount(wordCount);
			setShowSaved(true);
			const t = setTimeout(() => setShowSaved(false), 4000);
			return () => clearTimeout(t);
		}
		prevListeningRef.current = isListening;
	}, [isListening, wordCount]);

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

	// Groups for differentiated instruction filtering
	type GroupRow = { id: string; name: string; emoji: string; memberRosterIds: string[] };
	const [_groups, setGroups] = useState<GroupRow[]>([]);
	const [_selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
	const [showGroups, setShowGroups] = useState(true);

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

	useEffect(() => {
		if (selectedClassId) setActiveClassId(selectedClassId);
	}, [selectedClassId, setActiveClassId]);

	// Sync selected class to localStorage for board view
	useEffect(() => {
		if (selectedClassId) localStorage.setItem("board-class-id", selectedClassId);
	}, [selectedClassId]);

	// Route parent_message voice commands → Parent Comms panel
	useEffect(() => {
		const item = queue.find((q) => q.data.type === "parent_message");
		if (!item || item.data.type !== "parent_message") return;
		const { studentName, messageText } = item.data;
		const needle = studentName.toLowerCase();
		const match = students.find(
			(s) => s.firstName?.toLowerCase() === needle || s.firstInitial.toLowerCase() === needle[0],
		);
		if (!match) return;
		confirm(item.id);
		setRightOpen(true);
		setParentCommsPreselect({ rosterId: match.rosterId, text: messageText, nonce: Date.now() });
		playActivationChime();
		setTimeout(() => {
			const utt = new SpeechSynthesisUtterance("Go ahead");
			window.speechSynthesis.speak(utt);
		}, 500);
	}, [queue, students, confirm]);

	useEffect(() => {
		if (!selectedClassId) return;
		setSelectedGroupId(null);
		fetch(`/api/classes/${selectedClassId}/groups`)
			.then((r) => r.json())
			.then((j) =>
				setGroups(
					(j.groups ?? []).map(
						(g: { id: string; name: string; emoji: string; members: { rosterId: string }[] }) => ({
							id: g.id,
							name: g.name,
							emoji: g.emoji,
							memberRosterIds: g.members.map((m) => m.rosterId),
						}),
					),
				),
			)
			.catch(() => setGroups([]));
	}, [selectedClassId]);

	// Track whether DiPanel has a live session (so we keep it visible when user switches modes)
	const [diSessionActive, setDiSessionActive] = useState(false);

	// Orb + input state
	const [inputMode, setInputMode] = useState<"behavior" | "ask" | "di">("ask");
	const [isOrbRecording, setIsOrbRecording] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [textInput, setTextInput] = useState("");
	const [, setShowTextInput] = useState(false);
	// Panel collapse state
	const [leftOpen, setLeftOpen] = useState(true);
	const [studentsOpen, setStudentsOpen] = useState(true);
	const [rightOpen, setRightOpen] = useState(true);
	const [parentCommsPreselect, setParentCommsPreselect] = useState<{
		rosterId: string;
		text: string;
		nonce: number;
	} | null>(null);
	// Auto command mode — activates when lecture mic is off
	const autoCommandRef = useRef(false);
	const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isLoadingRef = useRef(false);
	isLoadingRef.current = isLoading;
	const startOrbRef = useRef<() => void>(() => {});
	// Only auto-enable command mode after teacher has used lecture recording at least once
	const _hasEverListenedRef = useRef(false);

	// Derive mic button state
	const micState: MicState = isOrbRecording ? "listening" : isLoading ? "processing" : "idle";
	const _micLevels = useMicAnalyser(isOrbRecording);

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

	// biome-ignore lint/correctness/noUnusedVariables: chip helper — used by future behavior chip buttons
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
					body: JSON.stringify({
						message: trimmed,
						history: historyRef.current.slice(-20),
						lessonTranscript: transcript || undefined,
					}),
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
		async (query: string, priorAttempts: typeof scaffoldAttempts = [], grade?: number) => {
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
							scaffoldGrade: grade,
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

	const handleGradeChange = useCallback(
		(grade: number) => {
			sendAcademic(lastAcademicQuery, scaffoldAttempts, grade);
		},
		[lastAcademicQuery, scaffoldAttempts, sendAcademic],
	);

	// DI voice dispatch ref — DiPanel sets this so global mic can route commands to it
	const diDispatchRef = useRef<((transcript: string) => void) | null>(null);

	// ── Orb recording via mic manager ────────────────────────────────────────────
	// inputMode and dispatch refs for use inside config callback
	const inputModeRef = useRef(inputMode);
	inputModeRef.current = inputMode;
	const sendAcademicRef = useRef(sendAcademic);
	sendAcademicRef.current = sendAcademic;
	const sendBehaviorRef = useRef(sendBehavior);
	sendBehaviorRef.current = sendBehavior;

	const orbConfig = {
		continuous: false as const,
		interimResults: false as const,
		onResult: (t: string, isFinal: boolean) => {
			if (!isFinal || !t.trim()) return;
			if (inputModeRef.current === "di" && diDispatchRef.current) {
				diDispatchRef.current(t);
			} else if (inputModeRef.current === "ask") {
				sendAcademicRef.current(t);
			} else {
				sendBehaviorRef.current(t);
			}
		},
		onNaturalEnd: () => setIsOrbRecording(false),
	};

	const { isActive: orbActive, start: orbStart, stop: orbStop } = useMicSlot("orb", orbConfig);

	// Keep isOrbRecording in sync with actual mic ownership
	useEffect(() => {
		if (!orbActive && isOrbRecording) setIsOrbRecording(false);
	}, [orbActive, isOrbRecording]);

	function toggleOrb() {
		if (isLoading) return;
		if (isOrbRecording) {
			autoCommandRef.current = false;
			orbStop();
			setIsOrbRecording(false);
			return;
		}
		const hasSpeech =
			typeof window !== "undefined" &&
			!!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
		if (!hasSpeech) {
			setShowTextInput(true);
			return;
		}
		orbStart();
		setIsOrbRecording(true);
	}
	startOrbRef.current = toggleOrb;

	// Auto command mode: off when lecture is on, on when lecture is off
	// The mic manager handles priority — orb will naturally yield to lecture (priority 4 > 2)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		if (isListening) {
			autoCommandRef.current = false;
			if (restartTimerRef.current) {
				clearTimeout(restartTimerRef.current);
				restartTimerRef.current = null;
			}
			setIsOrbRecording(false);
		} else {
			autoCommandRef.current = true;
			restartTimerRef.current = setTimeout(() => {
				if (autoCommandRef.current && !isLoadingRef.current) startOrbRef.current();
			}, 700);
		}
		return () => {
			if (restartTimerRef.current) {
				clearTimeout(restartTimerRef.current);
				restartTimerRef.current = null;
			}
		};
	}, [isListening]);

	const lectureMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / 130)) : 0;
	const showOrbArea = true;
	const selectedClass = classes.find((c) => c.id === selectedClassId);

	return (
		<div className="h-[calc(100vh-3.5rem)] bg-[#0d1525] flex flex-col overflow-hidden">
			{/* ── Top bar ──────────────────────────────────────────────── */}
			<div className="shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center gap-3 flex-wrap">
				{/* Session status dot */}
				<span
					className={`flex items-center gap-1.5 text-xs font-medium ${activeSessionId ? "text-emerald-400" : "text-slate-500"}`}
				>
					<span
						className={`w-2 h-2 rounded-full ${activeSessionId ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}
					/>
					{activeSessionId ? "Session live" : "No active session"}
				</span>

				{/* Panels toggle */}
				<button
					type="button"
					onClick={() => {
						const anyOpen = leftOpen || rightOpen;
						setLeftOpen(!anyOpen);
						setRightOpen(!anyOpen);
					}}
					className="text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-slate-800"
				>
					{leftOpen || rightOpen ? "⊟ Panels" : "⊞ Panels"}
				</button>

				<div className="ml-auto flex items-center gap-2">
					{/* Saved flash */}
					{showSaved && (
						<span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 animate-pulse">
							<CheckIcon className="h-3 w-3" />
							{savedWordCount.toLocaleString()} words captured
						</span>
					)}
					{/* Record lesson */}
					{isSupported && (
						<button
							type="button"
							onClick={() => {
								if (isListening) {
									stopListening();
								} else {
									// Kill command mode before starting lecture recording
									autoCommandRef.current = false;
									if (restartTimerRef.current) {
										clearTimeout(restartTimerRef.current);
										restartTimerRef.current = null;
									}
									stopCommandsNow();
									setIsOrbRecording(false);
									playActivationChime();
									setTimeout(startListening, 350);
								}
							}}
							className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
								isListening
									? "bg-red-500/20 text-red-300 ring-1 ring-red-500/50"
									: "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
							}`}
						>
							{isListening ? (
								<>
									<span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
									Stop · {lectureMinutes}m
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
			<div
				className="flex-1 min-h-0 grid gap-0"
				style={{
					gridTemplateColumns: [
						leftOpen ? "320px" : "2rem",
						"1fr",
						selectedClassId ? (rightOpen ? "300px" : "2rem") : "0px",
					].join(" "),
				}}
			>
				{/* ── LEFT: Roster + Comprehension ─────────────────────── */}
				<div
					className={`border-r border-slate-800 flex flex-col gap-0 min-h-0 overflow-hidden relative ${leftOpen ? "overflow-y-auto" : "items-center py-3"}`}
				>
					{leftOpen ? (
						<>
							{/* Sidebar header — collapse arrow only */}
							<div className="sticky top-0 z-10 bg-[#0d1525] border-b border-slate-800 flex items-center justify-end px-3 py-2">
								<button
									type="button"
									onClick={() => setLeftOpen(false)}
									title="Collapse sidebar"
									className="h-6 w-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-400 hover:bg-slate-700/50 transition-colors"
								>
									<ChevronLeftIcon className="h-3.5 w-3.5" />
								</button>
							</div>

							{/* Comprehension panel — Student Understanding */}
							<div className="p-4 border-b border-slate-800">
								{selectedClassId && (
									<ComprehensionPanel classId={selectedClassId} activeSessionId={activeSessionId} />
								)}
							</div>

							{/* Student roster — collapsible */}
							<div className="border-b border-slate-800">
								<button
									type="button"
									onClick={() => setStudentsOpen((o) => !o)}
									className="w-full flex items-center gap-1.5 px-4 py-2 hover:bg-slate-800/50 transition-colors group"
								>
									<ChevronDownIcon
										className={`h-3 w-3 text-slate-600 group-hover:text-slate-400 transition-transform shrink-0 ${studentsOpen ? "" : "-rotate-90"}`}
									/>
									<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 group-hover:text-slate-400">
										{studentsLoading ? "Loading…" : `${students.length} Students`}
									</p>
								</button>
								{studentsOpen && (
									<div className="px-4 pb-3 pt-2">
										{students.length > 0 ? (
											<div className="grid grid-cols-3 gap-1.5">
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
								)}
							</div>
						</>
					) : (
						<button
							type="button"
							onClick={() => setLeftOpen(true)}
							title="Expand left panel"
							className="h-6 w-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-400 hover:bg-slate-700/50 transition-colors"
						>
							<ChevronRightIcon className="h-3.5 w-3.5" />
						</button>
					)}
				</div>

				{/* ── CENTER: Voice cockpit ─────────────────────────────── */}
				<div className="flex flex-col min-h-0 overflow-hidden">
					{/* Mode toggle — always visible */}
					<div
						className={`flex justify-center px-6 ${scaffoldResponse ? "pt-3 pb-3" : "pt-6 pb-2"}`}
					>
						<div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs font-semibold">
							<button
								type="button"
								onClick={() => {
									if (inputMode === "ask") {
										setInputMode("di");
									} else if (inputMode === "di") {
										setInputMode("ask");
									} else {
										setInputMode("ask");
										setShowTextInput(true);
									}
								}}
								className={`px-4 py-2 transition-colors ${
									inputMode === "ask" || inputMode === "di"
										? "bg-indigo-600/30 text-indigo-300"
										: "bg-slate-800 text-slate-400 hover:text-slate-200"
								}`}
							>
								🎓 Instruction
								{inputMode === "ask" || inputMode === "di"
									? inputMode === "di"
										? " ▴"
										: " ▾"
									: ""}
							</button>
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
						</div>
					</div>

					{/* DI Panel */}
					{(inputMode === "di" || diSessionActive) && (
						<div className={`flex-1 min-h-0 overflow-y-auto${inputMode !== "di" ? " hidden" : ""}`}>
							{selectedClassId ? (
								<DiPanel
									classId={selectedClassId}
									students={students}
									onSessionEnd={() => fetchStudents(selectedClassId)}
									dispatchRef={diDispatchRef}
									onActiveSessionChange={setDiSessionActive}
								/>
							) : (
								<div className="flex items-center justify-center h-32">
									<p className="text-sm text-slate-500">Select a class to use DI groups.</p>
								</div>
							)}
						</div>
					)}

					{/* Reserved space — mic button at rest, waveform when capturing */}
					{showOrbArea && inputMode !== "di" && !(inputMode === "ask" && scaffoldResponse) && (
						<div className="shrink-0 flex items-center justify-center px-6" style={{ height: 160 }}>
							{isListening || isOrbRecording ? (
								<WaveformMeter
									active={isListening || isOrbRecording}
									height={136}
									className="w-full"
								/>
							) : (
								<div className="relative flex items-center justify-center">
									<span className="absolute h-20 w-20 rounded-full border border-slate-600/40 [animation:mic-center-pulse_2.8s_ease-in-out_infinite]" />
									<span className="absolute h-24 w-24 rounded-full border border-slate-700/25 [animation:mic-center-pulse_2.8s_ease-in-out_infinite_0.4s]" />
									<button
										type="button"
										onClick={toggleOrb}
										disabled={isLoading}
										title="Voice input"
										className="relative z-10 h-16 w-16 rounded-full flex items-center justify-center border-2 border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:border-slate-500 hover:text-slate-200 transition-all active:scale-95 disabled:opacity-40"
									>
										<MicIcon className="h-7 w-7" />
									</button>
								</div>
							)}
						</div>
					)}

					{/* Groups zone — fixed height, no scroll */}
					{showOrbArea && inputMode !== "di" && (
						<div className="shrink-0 flex flex-col">
							{/* Class selector + group cards */}
							{classes.length > 0 && (
								<div className="flex gap-1.5 justify-center px-4 pt-3 pb-2">
									{classes.map((c) => (
										<button
											key={c.id}
											type="button"
											onClick={() => {
												if (selectedClassId === c.id) {
													setShowGroups((v) => !v);
												} else {
													setSelectedClassId(c.id);
													setShowGroups(true);
													setSelectedGroupId(null);
												}
											}}
											className={`rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95 ${selectedClassId === c.id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700"}`}
										>
											{c.label}
											{selectedClassId === c.id ? (showGroups ? " ▴" : " ▾") : ""}
										</button>
									))}
								</div>
							)}
							{showGroups && selectedClassId && (
								<div style={{ animation: "slide-down 0.2s ease" }}>
									<GroupsSidebarPanel classId={selectedClassId} />
								</div>
							)}
						</div>
					)}
					{/* Response content — flex-1 in ask/behavior; hidden in DI (DI panel owns all space) */}
					<div className={`min-h-0 overflow-y-auto flex flex-col ${inputMode === "di" ? "hidden" : "flex-1"}`}>
						{showOrbArea && (
							<>
								{/* Ask mode: loading + response appear immediately below input */}
								{inputMode === "ask" && isLoading && (
									<div className="flex items-center justify-center gap-2 py-4">
										{[0, 1, 2].map((i) => (
											<span
												key={i}
												className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
												style={{ animationDelay: `${i * 150}ms` }}
											/>
										))}
										<span className="text-xs text-indigo-400">Thinking...</span>
									</div>
								)}
								{inputMode === "ask" && scaffoldError && (
									<div className="mx-6 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
										{scaffoldError}
									</div>
								)}
								{inputMode === "ask" && scaffoldResponse && !isLoading && (
									<div className="px-6 pb-4">
										<div className="flex justify-end mb-2">
											<button
												type="button"
												onClick={() => {
													setScaffoldResponse(null);
													setScaffoldError(null);
												}}
												className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
											>
												<XIcon className="h-3 w-3" />
												Close
											</button>
										</div>
										<RemediationFlow
											response={scaffoldResponse}
											onDeepen={handleDeepen}
											onGradeChange={handleGradeChange}
											sessionId={activeSessionId}
											standardCode={pinnedStandards[0]}
											transcript={transcript}
											isRefetching={isLoading}
										/>
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
																	<p className="text-sm text-slate-200 leading-snug flex-1">
																		{msg.text}
																	</p>
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
															{msg.response?.toneAnalysis && (
																<div className="rounded border-l-2 border-violet-500 bg-slate-800/80 px-2 py-1.5">
																	<p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400 mb-0.5">
																		Situation
																	</p>
																	<p className="text-xs text-slate-300 leading-snug">
																		{msg.response.toneAnalysis}
																	</p>
																</div>
															)}
															{msg.response?.nextSteps && msg.response.nextSteps.length > 0 && (
																<div className="rounded border-l-2 border-emerald-500 bg-slate-800/80 px-2 py-1.5">
																	<p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-1">
																		Next steps
																	</p>
																	<ol className="flex flex-col gap-1">
																		{msg.response.nextSteps.map((step, i) => (
																			<li
																				// biome-ignore lint/suspicious/noArrayIndexKey: ordered steps have no stable id
																				key={i}
																				className="flex items-start gap-1.5 text-xs text-slate-300 leading-snug"
																			>
																				<span className="shrink-0 font-bold text-emerald-500 tabular-nums">
																					{i + 1}.
																				</span>
																				{step}
																			</li>
																		))}
																	</ol>
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
							</>
						)}
					</div>

					{/* Input row — pinned to bottom of center column */}
					<div className="shrink-0 border-t border-slate-800 px-4 py-3 flex flex-col gap-2 group/inputrow relative">
						{/* Standards picker — floats above input on hover, does NOT push input down */}
						{inputMode === "ask" && (
							<div className="absolute bottom-full left-0 right-0 px-4 pb-1 hidden group-hover/inputrow:block">
								<StandardPicker
									value={pinnedStandards}
									onChange={setPinnedStandards}
									defaultGrade={
										selectedClass?.gradeLevel
											? (Number(selectedClass.gradeLevel) as 3 | 4 | 5)
											: undefined
									}
								/>
							</div>
						)}
						{/* Done recording — prominent stop button while lecture capture is active */}
						{isListening && (
							<button
								type="button"
								onClick={stopListening}
								className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-semibold py-2 hover:bg-red-500/25 transition-colors"
							>
								<span className="h-2 w-2 rounded-full bg-red-400 animate-pulse shrink-0" />
								Done —{" "}
								{lectureMinutes > 0 ? `${lectureMinutes}m captured` : "stop lecture recording"}
							</button>
						)}
						<div className="flex gap-2 items-end">
							<textarea
								rows={2}
								value={textInput}
								onChange={(e) => setTextInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										if (inputMode === "di") {
											diDispatchRef.current?.(textInput);
											setTextInput("");
										} else if (inputMode === "ask") {
											sendAcademic(textInput);
										} else {
											sendBehavior(textInput);
										}
									}
								}}
								placeholder={
									inputMode === "di"
										? '"Put Marcus in Red" or "Give Blue 2 points"'
										: inputMode === "ask"
											? "What are your students struggling with?"
											: '"Give Jordan 15 bucks for great focus"'
								}
								className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
								disabled={isLoading}
							/>
							<button
								type="button"
								onClick={toggleOrb}
								disabled={isLoading}
								title={isOrbRecording ? "Stop" : "Voice input"}
								className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center border transition-all disabled:opacity-40 ${isOrbRecording ? "bg-blue-500 border-blue-400 text-white [animation:mic-center-pulse_1.4s_ease-in-out_infinite]" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"}`}
							>
								<MicIcon className="h-4 w-4" />
							</button>
							<button
								type="button"
								disabled={!textInput.trim() || isLoading}
								onClick={() => {
									if (inputMode === "di") {
										diDispatchRef.current?.(textInput);
										setTextInput("");
									} else if (inputMode === "ask") {
										sendAcademic(textInput);
									} else {
										sendBehavior(textInput);
									}
								}}
								className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 transition-colors"
							>
								<SendIcon className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>

				{/* ── RIGHT: Parent Comms ──────────────────────────────── */}
				{selectedClassId && (
					<div className="border-l border-slate-800 flex flex-col overflow-hidden min-h-0">
						{rightOpen ? (
							<ParentCommsPanel
								classId={selectedClassId}
								students={students}
								externalPreselect={parentCommsPreselect}
								onCollapse={() => setRightOpen(false)}
							/>
						) : (
							<div className="flex items-center justify-center py-3">
								<button
									type="button"
									onClick={() => setRightOpen(true)}
									title="Expand Parent Comms"
									className="h-6 w-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-400 hover:bg-slate-700/50 transition-colors"
								>
									<ChevronLeftIcon className="h-3.5 w-3.5" />
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
