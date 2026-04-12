"use client";

import gsap from "gsap";
import {
	CheckIcon,
	ClipboardIcon,
	MicIcon,
	SendIcon,
	SquareIcon,
	Volume2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";
import type { BehaviorResponse } from "@/app/api/coach/behavior/route";
import { RamBuckBurst } from "@/components/coach/ram-buck-burst";
import { useMicSlot } from "@/hooks/use-mic-manager";
import { GLOBAL_VOICE_ONLY_MODE_KEY, readBooleanPreference } from "@/lib/ui-prefs";

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* clipboard unavailable */
		}
	}
	return (
		<button
			type="button"
			onClick={handleCopy}
			className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 transition-colors shrink-0"
		>
			{copied ? (
				<>
					<CheckIcon className="h-3 w-3 text-green-600" />
					<span className="text-green-700">Copied</span>
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

// ─── SMS send button ──────────────────────────────────────────────────────────

type SmsState = "idle" | "loading" | "sent" | "error";

function SmsSendButton({
	classId,
	rosterId,
	body,
}: {
	classId: string;
	rosterId: string;
	body: string;
}) {
	const [state, setState] = useState<SmsState>("idle");
	const [errorMsg, setErrorMsg] = useState("");
	async function handleSend() {
		if (state !== "idle") return;
		setState("loading");
		try {
			const res = await fetch(`/api/classes/${classId}/parent-message`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId, body, triggeredBy: "manual" }),
			});
			const json = await res.json();
			if (!res.ok || json.error) {
				setErrorMsg(json.error ?? "Failed");
				setState("error");
			} else setState("sent");
		} catch {
			setErrorMsg("Network error");
			setState("error");
		}
	}
	if (state === "sent")
		return (
			<span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
				<CheckIcon className="h-3 w-3" />
				Sent
			</span>
		);
	if (state === "error")
		return (
			<span className="text-xs text-red-600 shrink-0" title={errorMsg}>
				SMS failed
			</span>
		);
	return (
		<button
			type="button"
			onClick={handleSend}
			disabled={state === "loading"}
			className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 transition-colors shrink-0 disabled:opacity-50"
		>
			<SendIcon className="h-3 w-3" />
			{state === "loading" ? "Sending…" : "Send SMS"}
		</button>
	);
}

// ─── Inline speak button (TTS) ────────────────────────────────────────────────

function SpeakButton({ text }: { text: string }) {
	const [speaking, setSpeaking] = useState(false);
	const [supported, setSupported] = useState(false);
	useEffect(() => {
		setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
	}, []);
	if (!supported) return null;

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
			aria-label={speaking ? "Stop" : "Hear response"}
			className={`flex items-center gap-1 text-xs transition-colors shrink-0 ${speaking ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
		>
			<Volume2Icon className="h-3 w-3" />
			{speaking ? "Stop" : "Hear"}
		</button>
	);
}

// ─── Action badge ─────────────────────────────────────────────────────────────

function ActionBadge({ response }: { response: BehaviorResponse }) {
	if (response.actionType === "general" || response.actionType === "advice") return null;
	const badgeMap: Record<string, { label: string; className: string }> = {
		"ram-buck-award": {
			label: response.ramBuck ? `+${response.ramBuck.amount} RAM Bucks` : "RAM Buck Award",
			className: "bg-green-100 text-green-800 border-green-200",
		},
		"ram-buck-deduction": {
			label: response.ramBuck ? `-${response.ramBuck.amount} RAM Bucks` : "RAM Buck Deduction",
			className: "bg-red-100 text-red-800 border-red-200",
		},
		incident: {
			label: "Incident Logged",
			className: "bg-orange-100 text-orange-800 border-orange-200",
		},
		"parent-msg": {
			label: "Parent Message",
			className: "bg-amber-100 text-amber-800 border-amber-200",
		},
		iready: { label: "iReady Goal ✓", className: "bg-blue-100 text-blue-800 border-blue-200" },
	};
	const badge = badgeMap[response.actionType];
	if (!badge) return null;
	return (
		<span
			className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${badge.className}`}
		>
			{badge.label}
		</span>
	);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryEntry = { role: "user" | "assistant"; content: string };
type Message = {
	id: string;
	role: "teacher" | "coach";
	text: string;
	response?: BehaviorResponse;
	rosterId?: string;
};
type ClassRow = { id: string; label: string };
type GuidanceResult = {
	talkingPoints: string[];
	practiceGuidance: string;
	parentMessageDraft: string;
};

// ─── Animated message wrapper ─────────────────────────────────────────────────

function AnimatedMessage({
	role,
	children,
}: {
	role: "teacher" | "coach";
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!ref.current) return;
		const anim = gsap.from(ref.current, {
			x: role === "teacher" ? 18 : -18,
			opacity: 0,
			duration: 0.28,
			ease: "power2.out",
		});
		return () => {
			anim.kill();
		};
	}, [role]);
	return (
		<div ref={ref} className={`flex ${role === "teacher" ? "justify-end" : "justify-start"}`}>
			{children}
		</div>
	);
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function BehaviorPanel() {
	const [classes, setClasses] = useState<ClassRow[]>([]);
	const [selectedClassId, setSelectedClassId] = useState("");
	const [students, setStudents] = useState<StudentOverview[]>([]);
	const [_studentsLoading, setStudentsLoading] = useState(false);

	const [activeStudent, setActiveStudent] = useState<StudentOverview | null>(null);
	const [guidanceLoading, setGuidanceLoading] = useState(false);
	const [guidance, setGuidance] = useState<GuidanceResult | null>(null);

	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [showTypeInput, setShowTypeInput] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isRecording, setIsRecording] = useState(false);

	const [burst, setBurst] = useState<{ amount: number; type: "award" | "deduction" } | null>(null);

	const bottomRef = useRef<HTMLDivElement>(null);
	const historyRef = useRef<HistoryEntry[]>([]);
	const pendingStudentRef = useRef<StudentOverview | null>(null);
	const orbRef = useRef<HTMLButtonElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
	useEffect(() => {
		fetch("/api/classes")
			.then((r) => r.json())
			.then((j) => {
				const active = (j.classes ?? []).filter(
					(c: ClassRow & { isArchived: boolean }) => !c.isArchived,
				);
				setClasses(active);
				if (active.length > 0 && !selectedClassId) setSelectedClassId(active[0].id);
			})
			.catch(() => {});
	}, []);

	const fetchStudents = useCallback(async (classId: string) => {
		setStudentsLoading(true);
		try {
			const res = await fetch(`/api/classes/${classId}/roster-overview`);
			if (!res.ok) return;
			const json = await res.json();
			setStudents(json.students ?? []);
		} catch {
			/* silently fail */
		} finally {
			setStudentsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (selectedClassId) fetchStudents(selectedClassId);
	}, [selectedClassId, fetchStudents]);

	useEffect(() => {
		function handleRamBucksUpdated() {
			if (selectedClassId) fetchStudents(selectedClassId);
		}
		window.addEventListener("ram-bucks-updated", handleRamBucksUpdated);
		return () => window.removeEventListener("ram-bucks-updated", handleRamBucksUpdated);
	}, [selectedClassId, fetchStudents]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: isLoading triggers scroll
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	function findStudentInText(text: string): StudentOverview | null {
		const upper = text.toUpperCase();
		for (const s of students) {
			const dotted = `${s.firstInitial.toUpperCase()}.${s.lastInitial.toUpperCase()}.`;
			const plain = `${s.firstInitial.toUpperCase()}${s.lastInitial.toUpperCase()}`;
			if (upper.includes(dotted) || upper.includes(plain)) return s;
		}
		return null;
	}

	function _handleStudentTap(student: StudentOverview) {
		pendingStudentRef.current = student;
		setActiveStudent(student);
		setGuidance(null);
		const initials = `${student.firstInitial}.${student.lastInitial}.`;
		setInput((prev) => {
			if (prev.includes(initials)) return prev;
			return prev ? `${initials} ${prev}` : `${initials} `;
		});
	}

	// Quick action chips — pre-fill or auto-send common narrations
	function applyChip(template: string, autoSend = false) {
		const initials = activeStudent
			? `${activeStudent.firstInitial}.${activeStudent.lastInitial}.`
			: null;
		const phrase = initials
			? template.replace("{}", initials)
			: template.replace("{} ", "").replace("{}", "");
		if (autoSend && initials) {
			handleSend(phrase);
		} else {
			setInput(phrase);
			setShowTypeInput(true);
		}
	}

	async function fetchGuidance(student: StudentOverview) {
		if (!selectedClassId) return;
		setGuidanceLoading(true);
		setGuidance(null);
		try {
			const res = await fetch("/api/coach/academic-guidance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId: student.rosterId, classId: selectedClassId }),
			});
			if (res.ok) setGuidance((await res.json()) as GuidanceResult);
		} catch {
			/* silently fail */
		} finally {
			setGuidanceLoading(false);
		}
	}

	async function handleSend(text: string) {
		const trimmed = text.trim();
		if (!trimmed || isLoading) return;

		setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "teacher", text: trimmed }]);
		setInput("");
		setShowTypeInput(false);
		setIsLoading(true);

		const history = historyRef.current.slice(-20);
		try {
			const res = await fetch("/api/coach/behavior", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: trimmed, history }),
			});
			if (!res.ok) throw new Error("Request failed");
			const data = (await res.json()) as BehaviorResponse;

			const target = pendingStudentRef.current ?? findStudentInText(trimmed);
			pendingStudentRef.current = null;

			setMessages((prev) => [
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
					setBurst({ amount: Math.abs(data.ramBuck.amount), type: "award" });
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
					setBurst({ amount: Math.abs(data.ramBuck.amount), type: "deduction" });
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
		} catch {
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "coach",
					text: "Something went wrong. Try again.",
					response: { message: "Error", actionType: "general" },
				},
			]);
		} finally {
			setIsLoading(false);
		}
	}

	// Dictation via mic manager — priority 3 (below lecture, above orb/globalVoice)
	const handleSendRef = useRef(handleSend);
	handleSendRef.current = handleSend;

	const dictConfig = {
		continuous: false as const,
		interimResults: false as const,
		onResult: (t: string, isFinal: boolean) => {
			if (isFinal && t.trim()) handleSendRef.current(t.trim());
		},
		onNaturalEnd: () => setIsRecording(false),
		onError: () => setIsRecording(false),
	};

	const { start: dictStart, stop: dictStop } = useMicSlot("dictation", dictConfig);

	function startRecording() {
		if (readBooleanPreference(GLOBAL_VOICE_ONLY_MODE_KEY, false)) {
			toast.error("Global voice only mode is on — use the Command listener instead");
			return;
		}
		dictStart();
		setIsRecording(true);
	}

	function stopRecording() {
		dictStop();
		setIsRecording(false);
	}

	function toggleOrb() {
		if (isLoading) return;
		if (isRecording) stopRecording();
		else startRecording();
	}

	const hasSpeech =
		typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

	return (
		<div className="flex flex-col gap-5">
			{/* ── Class selector ─────────────────────────────────── */}
			{classes.length > 1 && (
				<select
					value={selectedClassId}
					onChange={(e) => setSelectedClassId(e.target.value)}
					className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				>
					{classes.map((c) => (
						<option key={c.id} value={c.id}>
							{c.label}
						</option>
					))}
				</select>
			)}

			{/* ── Hero orb ───────────────────────────────────────── */}
			<div className="flex flex-col items-center gap-3 pt-2">
				<button
					ref={orbRef}
					type="button"
					onClick={toggleOrb}
					disabled={isLoading}
					aria-label={isRecording ? "Stop" : "Narrate to coach"}
					className={`relative h-28 w-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl active:scale-95 ${
						isRecording
							? "bg-red-500 shadow-red-300"
							: isLoading
								? "bg-amber-300 shadow-amber-200 cursor-wait"
								: "bg-amber-500 hover:bg-amber-600 shadow-amber-300"
					}`}
				>
					{/* Pulse rings */}
					{isRecording && (
						<>
							<span className="absolute inset-0 rounded-full bg-red-400/40 animate-ping" />
							<span className="absolute inset-[-10px] rounded-full border-2 border-red-300/30 animate-pulse" />
						</>
					)}
					{isLoading && (
						<span className="absolute inset-0 rounded-full bg-amber-300/40 animate-pulse" />
					)}

					{/* Icon */}
					{isRecording ? (
						<SquareIcon className="h-10 w-10 text-white" />
					) : isLoading ? (
						<div className="flex gap-1.5">
							{[0, 1, 2].map((i) => (
								<span
									key={i}
									className="h-2.5 w-2.5 rounded-full bg-white animate-bounce"
									style={{ animationDelay: `${i * 150}ms` }}
								/>
							))}
						</div>
					) : (
						<MicIcon className="h-11 w-11 text-white" />
					)}
				</button>

				<p
					className={`text-sm font-semibold transition-colors ${isRecording ? "text-red-600" : isLoading ? "text-amber-600" : "text-muted-foreground"}`}
				>
					{isRecording
						? "Listening…"
						: isLoading
							? "Thinking…"
							: hasSpeech
								? "Tap to narrate"
								: "Tap to narrate"}
				</p>
			</div>

			{/* ── Quick action chips ─────────────────────────────── */}
			<div className="flex flex-wrap gap-2 justify-center">
				<button
					type="button"
					onClick={() => applyChip("Give {} bucks for ")}
					className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200 active:scale-95 transition-all"
				>
					🏆 Reward
				</button>
				<button
					type="button"
					onClick={() => applyChip("Step up for {}", !!activeStudent)}
					className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-200 active:scale-95 transition-all"
				>
					⚠️ Step Up
				</button>
				<button
					type="button"
					onClick={() => applyChip("Call home for {}", !!activeStudent)}
					className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200 active:scale-95 transition-all"
				>
					📞 Call Home
				</button>
				{activeStudent ? (
					<button
						type="button"
						onClick={() => fetchGuidance(activeStudent)}
						disabled={guidanceLoading}
						className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-200 active:scale-95 transition-all disabled:opacity-50"
					>
						{guidanceLoading ? "Loading…" : "📊 Guidance"}
					</button>
				) : (
					<button
						type="button"
						onClick={() => {
							setShowTypeInput((v) => !v);
						}}
						className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80 active:scale-95 transition-all"
					>
						✏️ Type
					</button>
				)}
			</div>

			{/* ── Type input (collapsible) ───────────────────────── */}
			{showTypeInput && (
				<div className="flex gap-2 items-end">
					<textarea
						rows={2}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSend(input);
							}
						}}
						placeholder='"Give J.M. 15 bucks for great focus"'
						className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400"
						disabled={isLoading}
					/>
					<button
						type="button"
						onClick={() => handleSend(input)}
						disabled={!input.trim() || isLoading}
						className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors"
					>
						<SendIcon className="h-4 w-4" />
					</button>
				</div>
			)}

			{/* ── Student strip ──────────────────────────────────── */}

			{/* ── Active student dismiss + guidance ─────────────── */}
			{activeStudent && (
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs font-medium text-amber-700">
						Focused: {activeStudent.firstInitial}.{activeStudent.lastInitial}. — 🐏
						{activeStudent.balance} · Step {activeStudent.behaviorStep}
					</span>
					<button
						type="button"
						onClick={() => {
							setActiveStudent(null);
							setGuidance(null);
						}}
						className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<XIcon className="h-3 w-3" />
						Dismiss
					</button>
				</div>
			)}

			{/* Guidance card */}
			{guidance && activeStudent && (
				<div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex flex-col gap-3">
					<p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
						Academic Guidance
					</p>

					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 mb-1">
							Talking Points
						</p>
						<ul className="flex flex-col gap-0.5">
							{guidance.talkingPoints.map((pt) => (
								<li key={pt} className="text-xs text-blue-900 leading-snug flex gap-1">
									<span className="shrink-0">•</span>
									{pt}
								</li>
							))}
						</ul>
					</div>

					<div>
						<p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 mb-1">
							At-Home Practice
						</p>
						<p className="text-xs text-blue-900 leading-snug">{guidance.practiceGuidance}</p>
					</div>

					<div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 flex flex-col gap-1">
						<div className="flex items-center justify-between gap-2">
							<span className="text-xs font-medium text-amber-800">Parent message draft</span>
							<div className="flex items-center gap-2">
								<CopyButton text={guidance.parentMessageDraft} />
								<SmsSendButton
									classId={selectedClassId}
									rosterId={activeStudent.rosterId}
									body={guidance.parentMessageDraft}
								/>
							</div>
						</div>
						<p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">
							{guidance.parentMessageDraft}
						</p>
					</div>
				</div>
			)}

			{/* ── Message log ────────────────────────────────────── */}
			{messages.length > 0 && (
				<div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto">
					{messages.map((msg) => (
						<AnimatedMessage key={msg.id} role={msg.role}>
							{msg.role === "teacher" ? (
								<div className="max-w-[80%] rounded-xl rounded-tr-sm bg-primary px-3 py-2">
									<p className="text-sm text-primary-foreground leading-snug">{msg.text}</p>
								</div>
							) : (
								<div className="max-w-[90%] flex flex-col gap-1.5">
									<div className="rounded-xl rounded-tl-sm border border-amber-200 bg-white px-3 py-2">
										<div className="flex items-start justify-between gap-2">
											<p className="text-sm text-foreground leading-snug flex-1">{msg.text}</p>
											<SpeakButton text={msg.text} />
										</div>
										{msg.response?.ramBuck?.reason && (
											<p className="text-xs text-muted-foreground mt-1 italic">
												{msg.response.ramBuck.reason}
											</p>
										)}
									</div>
									{msg.response && <ActionBadge response={msg.response} />}
									{msg.response?.incidentNote && (
										<div className="rounded border border-orange-200 bg-orange-50 px-2 py-1.5 flex items-start justify-between gap-2">
											<p className="text-xs text-orange-800 leading-snug flex-1">
												<span className="font-medium">Behavior note: </span>
												{msg.response.incidentNote}
											</p>
											<CopyButton text={msg.response.incidentNote} />
										</div>
									)}
									{msg.response?.parentMessage && (
										<div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 flex flex-col gap-1">
											<div className="flex items-center justify-between gap-2">
												<span className="text-xs font-medium text-amber-800">
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
											<p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">
												{msg.response.parentMessage}
											</p>
										</div>
									)}
									{msg.response?.toneAnalysis && (
										<div className="rounded border-l-2 border-violet-300 bg-violet-50 px-2 py-1.5">
											<p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 mb-0.5">
												Situation
											</p>
											<p className="text-xs text-violet-900 leading-snug">
												{msg.response.toneAnalysis}
											</p>
										</div>
									)}
									{msg.response?.nextSteps && msg.response.nextSteps.length > 0 && (
										<div className="rounded border-l-2 border-emerald-300 bg-emerald-50 px-2 py-1.5">
											<p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 mb-1">
												Next steps
											</p>
											<ol className="flex flex-col gap-1">
												{msg.response.nextSteps.map((step, i) => (
													<li
														// biome-ignore lint/suspicious/noArrayIndexKey: ordered steps have no stable id
														key={i}
														className="flex items-start gap-1.5 text-xs text-emerald-900 leading-snug"
													>
														<span className="shrink-0 font-bold text-emerald-600 tabular-nums">
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
						</AnimatedMessage>
					))}

					{isLoading && (
						<div className="flex justify-start">
							<div className="rounded-xl rounded-tl-sm border border-amber-200 bg-white px-3 py-2.5">
								<div className="flex gap-1 items-center">
									<span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
									<span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
									<span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
								</div>
							</div>
						</div>
					)}
					<div ref={bottomRef} />
				</div>
			)}

			{messages.length > 0 && (
				<button
					type="button"
					onClick={() => {
						setMessages([]);
						historyRef.current = [];
					}}
					className="self-center text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					Clear session log
				</button>
			)}

			{/* RAM Buck burst animation */}
			{burst && (
				<RamBuckBurst
					amount={burst.amount}
					type={burst.type}
					anchorRef={orbRef}
					onDone={() => setBurst(null)}
				/>
			)}
		</div>
	);
}
