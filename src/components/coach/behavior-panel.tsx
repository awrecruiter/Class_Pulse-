"use client";

import { CheckIcon, ClipboardIcon, MicIcon, SendIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";
import type { BehaviorResponse } from "@/app/api/coach/behavior/route";

// ─── Avatar helpers ───────────────────────────────────────────────────────────

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

function hashId(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return h;
}

function avatarColor(rosterId: string) {
	return AVATAR_COLORS[hashId(rosterId) % AVATAR_COLORS.length];
}

function avatarAnimal(rosterId: string) {
	return AVATAR_ANIMALS[(hashId(rosterId) >> 4) % AVATAR_ANIMALS.length];
}

// ─── Student card ─────────────────────────────────────────────────────────────

function StudentCard({
	student,
	onTap,
}: {
	student: StudentOverview;
	onTap: (student: StudentOverview) => void;
}) {
	const step = student.behaviorStep;
	const balance = student.balance;
	const stepColor = step >= 5 ? "bg-red-500" : step >= 3 ? "bg-orange-500" : "bg-yellow-400";

	return (
		<button
			type="button"
			onClick={() => onTap(student)}
			className="flex flex-col items-center gap-1 rounded-xl p-2 hover:bg-muted/60 active:scale-95 transition-all"
		>
			{/* Avatar */}
			<div
				className={`relative h-12 w-12 rounded-full ${avatarColor(student.rosterId)} flex items-center justify-center shadow-md`}
			>
				<span className="text-2xl leading-none select-none" aria-hidden>
					{avatarAnimal(student.rosterId)}
				</span>
				{step > 0 && (
					<span
						className={`absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full ${stepColor} flex items-center justify-center text-[9px] font-bold text-white shadow`}
					>
						{step}
					</span>
				)}
			</div>

			{/* Initials */}
			<span className="text-xs font-semibold text-foreground leading-none">
				{student.firstInitial}.{student.lastInitial}.
			</span>

			{/* Balance */}
			<span
				className={`text-xs font-bold tabular-nums leading-none ${balance > 0 ? "text-green-600" : "text-muted-foreground"}`}
			>
				🐏 {balance}
			</span>
		</button>
	);
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard unavailable
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
		iready: {
			label: "iReady Goal ✓",
			className: "bg-blue-100 text-blue-800 border-blue-200",
		},
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
};

type ClassRow = { id: string; label: string };

// ─── Main panel ───────────────────────────────────────────────────────────────

export function BehaviorPanel() {
	// Class selection
	const [classes, setClasses] = useState<ClassRow[]>([]);
	const [selectedClassId, setSelectedClassId] = useState("");

	// Student roster
	const [students, setStudents] = useState<StudentOverview[]>([]);
	const [studentsLoading, setStudentsLoading] = useState(false);

	// Chat
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isRecording, setIsRecording] = useState(false);

	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const historyRef = useRef<HistoryEntry[]>([]);
	// Tracks the last student card tapped — used as the target for DB commits
	const pendingStudentRef = useRef<StudentOverview | null>(null);

	// Load classes on mount — selectedClassId read only as initial check, intentionally excluded from deps
	// biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
	useEffect(() => {
		fetch("/api/classes")
			.then((r) => r.json())
			.then((j) => {
				const active = (j.classes ?? []).filter(
					(c: ClassRow & { isArchived: boolean }) => !c.isArchived,
				);
				setClasses(active);
				if (active.length > 0 && !selectedClassId) {
					setSelectedClassId(active[0].id);
				}
			})
			.catch(() => {});
	}, []);

	// Load students when class changes
	const fetchStudents = useCallback(async (classId: string) => {
		setStudentsLoading(true);
		try {
			const res = await fetch(`/api/classes/${classId}/roster-overview`);
			if (!res.ok) return;
			const json = await res.json();
			setStudents(json.students ?? []);
		} catch {
			// silently fail
		} finally {
			setStudentsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (selectedClassId) fetchStudents(selectedClassId);
	}, [selectedClassId, fetchStudents]);

	// Auto-scroll on new messages
	// biome-ignore lint/correctness/useExhaustiveDependencies: isLoading triggers scroll
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	// Match initials pattern in text to a roster entry (e.g. "J.M." → student)
	function findStudentInText(text: string): StudentOverview | null {
		const upper = text.toUpperCase();
		for (const s of students) {
			const dotted = `${s.firstInitial.toUpperCase()}.${s.lastInitial.toUpperCase()}.`;
			const plain = `${s.firstInitial.toUpperCase()}${s.lastInitial.toUpperCase()}`;
			if (upper.includes(dotted) || upper.includes(plain)) return s;
		}
		return null;
	}

	// Tap student card → remember as pending target + prepend initials
	function handleStudentTap(student: StudentOverview) {
		pendingStudentRef.current = student;
		const initials = `${student.firstInitial}.${student.lastInitial}.`;
		setInput((prev) => {
			if (prev.includes(initials)) return prev;
			return prev ? `${initials} ${prev}` : `${initials} `;
		});
	}

	async function handleSend(text: string) {
		const trimmed = text.trim();
		if (!trimmed || isLoading) return;

		const teacherMsg: Message = { id: crypto.randomUUID(), role: "teacher", text: trimmed };
		setMessages((prev) => [...prev, teacherMsg]);
		setInput("");
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

			const coachMsg: Message = {
				id: crypto.randomUUID(),
				role: "coach",
				text: data.message,
				response: data,
			};
			setMessages((prev) => [...prev, coachMsg]);
			historyRef.current = [
				...historyRef.current,
				{ role: "user", content: trimmed },
				{ role: "assistant", content: data.message },
			];

			// ── Commit DB transaction based on AI action ─────────────────────
			const target = pendingStudentRef.current ?? findStudentInText(trimmed);
			pendingStudentRef.current = null;

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
						body: JSON.stringify({
							rosterId: target.rosterId,
							notes: data.incidentNote ?? "",
						}),
					});
				}
			}

			// Refresh roster grid to show updated balances/steps
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

	function toggleRecording() {
		if (isRecording) {
			recognitionRef.current?.stop();
			setIsRecording(false);
			return;
		}
		const SR =
			typeof window !== "undefined"
				? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
				: null;
		if (!SR) return;

		const recognition = new SR();
		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.lang = "en-US";
		recognition.onresult = (e: SpeechRecognitionEvent) => {
			const transcript = e.results[0]?.[0]?.transcript ?? "";
			if (transcript) {
				setInput(transcript);
				handleSend(transcript);
			}
		};
		recognition.onend = () => setIsRecording(false);
		recognition.onerror = () => setIsRecording(false);
		recognitionRef.current = recognition;
		recognition.start();
		setIsRecording(true);
	}

	const hasSpeech =
		typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

	return (
		<div className="flex flex-col gap-4">
			{/* ── Class selector ──────────────────────────────────── */}
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

			{/* ── Student roster grid ─────────────────────────────── */}
			{selectedClassId && (
				<div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
					{studentsLoading ? (
						<div className="flex justify-center py-4">
							<div className="flex gap-1">
								{[0, 1, 2].map((i) => (
									<span
										key={i}
										className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce"
										style={{ animationDelay: `${i * 150}ms` }}
									/>
								))}
							</div>
						</div>
					) : students.length === 0 ? (
						<p className="text-center text-xs text-amber-700 py-3">
							No students on roster yet. Add students in Classes.
						</p>
					) : (
						<>
							<p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-2">
								Tap a student to mention them
							</p>
							<div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
								{students.map((student) => (
									<StudentCard key={student.rosterId} student={student} onTap={handleStudentTap} />
								))}
							</div>
						</>
					)}
				</div>
			)}

			{/* ── Behavior coach prompt ───────────────────────────── */}
			<div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
				<p className="text-xs font-semibold text-amber-800">
					Behavior Coach — narrate throughout the day
				</p>
				<p className="text-xs text-amber-700 mt-0.5">
					"Give J.M. 10 bucks for helping" · "Step 2 for A.T." · "Call home for D.R."
				</p>
			</div>

			{/* ── Message thread ──────────────────────────────────── */}
			<div className="flex flex-col gap-2 min-h-[160px] max-h-[360px] overflow-y-auto pr-0.5">
				{messages.length === 0 && (
					<div className="flex flex-col items-center justify-center h-28 text-center">
						<p className="text-sm text-muted-foreground">No messages yet.</p>
						<p className="text-xs text-muted-foreground mt-1">
							Tap a student or type to start narrating.
						</p>
					</div>
				)}

				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex ${msg.role === "teacher" ? "justify-end" : "justify-start"}`}
					>
						{msg.role === "teacher" ? (
							<div className="max-w-[80%] rounded-xl rounded-tr-sm bg-primary px-3 py-2">
								<p className="text-sm text-primary-foreground leading-snug">{msg.text}</p>
							</div>
						) : (
							<div className="max-w-[90%] flex flex-col gap-1.5">
								<div className="rounded-xl rounded-tl-sm border border-amber-200 bg-white px-3 py-2">
									<p className="text-sm text-foreground leading-snug">{msg.text}</p>
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
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-amber-800">ClassDojo message</span>
											<CopyButton text={msg.response.parentMessage} />
										</div>
										<p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">
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

			{/* ── Input ───────────────────────────────────────────── */}
			<div className="flex gap-2 items-end">
				{hasSpeech && (
					<button
						type="button"
						onClick={toggleRecording}
						className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
							isRecording
								? "bg-red-500 text-white animate-pulse"
								: "bg-amber-100 text-amber-700 hover:bg-amber-200"
						}`}
						aria-label={isRecording ? "Stop recording" : "Start voice input"}
					>
						{isRecording ? <SquareIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
					</button>
				)}

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
					placeholder='Type or tap mic... "Give J.M. 15 bucks for great focus"'
					className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400"
					disabled={isLoading}
				/>

				<button
					type="button"
					onClick={() => handleSend(input)}
					disabled={!input.trim() || isLoading}
					className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors"
					aria-label="Send"
				>
					<SendIcon className="h-4 w-4" />
				</button>
			</div>

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
		</div>
	);
}
