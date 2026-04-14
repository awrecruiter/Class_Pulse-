"use client";

import {
	CheckIcon,
	ChevronRightIcon,
	ClockIcon,
	EyeIcon,
	EyeOffIcon,
	MessageSquareIcon,
	MicIcon,
	PhoneIcon,
	PlusIcon,
	SendIcon,
	UserPlusIcon,
	XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useVoiceQueue } from "@/contexts/voice-queue";
import { type MicConfig, useMicSlot } from "@/hooks/use-mic-manager";
import { playQueueChime } from "@/lib/chime";
import { GLOBAL_VOICE_ONLY_MODE_KEY, readBooleanPreference } from "@/lib/ui-prefs";

// ─── Types ────────────────────────────────────────────────────────────────────

type Contact = {
	id: string;
	rosterId: string;
	parentName: string;
	phone: string;
	notes: string;
	firstInitial: string;
	lastInitial: string;
};

type RosterStudent = {
	rosterId: string;
	firstInitial: string;
	lastInitial: string;
	displayName: string;
};

type QueuedMessage = {
	id: string;
	rosterId: string;
	studentName: string;
	body: string;
	errored: boolean;
};

type SentMessage = {
	id: string;
	body: string;
	status: "sent" | "failed";
	triggeredBy: string;
	sentAt: string;
	smsSid: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
	return new Date(iso).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

// ─── Add contact form ─────────────────────────────────────────────────────────

function AddContactForm({
	classId,
	student,
	onSaved,
	onCancel,
}: {
	classId: string;
	student: RosterStudent;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const [parentName, setParentName] = useState("");
	const [phone, setPhone] = useState("");
	const [saving, setSaving] = useState(false);
	const [err, setErr] = useState("");

	async function save() {
		const p = phone.trim();
		if (!p) {
			setErr("Phone is required");
			return;
		}
		setSaving(true);
		setErr("");
		try {
			const res = await fetch(`/api/classes/${classId}/parent-contacts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rosterId: student.rosterId,
					parentName: parentName.trim(),
					phone: p,
					notes: "",
				}),
			});
			const json = await res.json();
			if (json.error) {
				setErr(json.error);
				setSaving(false);
				return;
			}
			onSaved();
		} catch {
			setErr("Network error");
			setSaving(false);
		}
	}

	return (
		<div className="px-3 py-3 flex flex-col gap-2 border-t border-slate-800">
			<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
				Add contact — {student.displayName}
			</p>
			{err && <p className="text-[10px] text-red-400">{err}</p>}
			<input
				type="text"
				placeholder="Parent name (optional)"
				value={parentName}
				onChange={(e) => setParentName(e.target.value)}
				className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
			/>
			<input
				type="tel"
				placeholder="+12125551234"
				value={phone}
				onChange={(e) => setPhone(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") save();
				}}
				className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
			/>
			<div className="flex gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="flex-1 rounded-lg border border-slate-700 py-1.5 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={save}
					disabled={saving || !phone.trim()}
					className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-indigo-500 transition-colors"
				>
					{saving ? "Saving…" : "Save"}
				</button>
			</div>
		</div>
	);
}

// ─── Sent history drawer ──────────────────────────────────────────────────────

function SentHistory({ messages, loading }: { messages: SentMessage[]; loading: boolean }) {
	if (loading) {
		return (
			<div className="flex justify-center py-3">
				<div className="flex gap-1">
					{[0, 1, 2].map((i) => (
						<span
							key={i}
							className="h-1 w-1 rounded-full bg-slate-600 animate-bounce"
							style={{ animationDelay: `${i * 150}ms` }}
						/>
					))}
				</div>
			</div>
		);
	}
	if (messages.length === 0) return null;
	return (
		<div className="flex flex-col gap-2 px-3 pb-2">
			<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
				Sent history
			</p>
			{[...messages].reverse().map((msg) => (
				<div key={msg.id} className="flex flex-col gap-0.5">
					<div className="flex items-center gap-1.5">
						{msg.status === "sent" ? (
							<span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
								<CheckIcon className="h-2.5 w-2.5" />
								Sent
							</span>
						) : (
							<span className="flex items-center gap-0.5 text-[10px] text-red-400">
								<XCircleIcon className="h-2.5 w-2.5" />
								Failed
							</span>
						)}
						<span className="text-[10px] text-slate-600 ml-auto">{fmtTime(msg.sentAt)}</span>
					</div>
					<p className="text-xs text-slate-500 leading-snug whitespace-pre-wrap bg-slate-900/50 rounded-lg px-2.5 py-2 border border-slate-800">
						{msg.body}
					</p>
				</div>
			))}
		</div>
	);
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ParentCommsPanel({
	classId,
	students = [],
	externalPreselect,
	onCollapse,
}: {
	classId: string;
	students?: RosterStudent[];
	externalPreselect?: { rosterId: string; text: string; nonce: number; autoSend?: boolean } | null;
	onCollapse?: () => void;
}) {
	const [contacts, setContacts] = useState<Contact[]>([]);
	const [contactsLoading, setContactsLoading] = useState(true);
	const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
	const [text, setText] = useState("");
	const [queue, setQueue] = useState<QueuedMessage[]>([]);
	const [sendingId, setSendingId] = useState<string | null>(null);
	const [addingFor, setAddingFor] = useState<RosterStudent | null>(null);
	const [hidden, setHidden] = useState(false);
	const [sentMsgs, setSentMsgs] = useState<SentMessage[]>([]);
	const [sentLoading, setSentLoading] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isDictating, setIsDictating] = useState(false);
	const dictationRef = useRef<SpeechRecognition | null>(null);
	const committedRef = useRef(""); // finalized words during dictation
	const { setCommsDictating } = useVoiceQueue();
	const addToQueueRef = useRef<() => void>(() => {});

	const fetchContacts = useCallback(async () => {
		setContactsLoading(true);
		try {
			const res = await fetch(`/api/classes/${classId}/parent-contacts`);
			if (res.ok) setContacts((await res.json()).contacts ?? []);
		} catch {
			/* noop */
		} finally {
			setContactsLoading(false);
		}
	}, [classId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount only
	useEffect(() => {
		fetchContacts();
	}, [classId]);

	const fetchSent = useCallback(
		async (rosterId: string) => {
			setSentLoading(true);
			try {
				const res = await fetch(`/api/classes/${classId}/parent-message?rosterId=${rosterId}`);
				if (res.ok) setSentMsgs((await res.json()).messages ?? []);
			} catch {
				/* noop */
			} finally {
				setSentLoading(false);
			}
		},
		[classId],
	);

	const selectStudent = useCallback(
		(rosterId: string) => {
			setSelectedRosterId(rosterId);
			setAddingFor(null);
			setSentMsgs([]);
			fetchSent(rosterId);
			textareaRef.current?.focus();
		},
		[fetchSent],
	);

	const resolveRosterIdByStudentName = useCallback(
		(studentName: string): string | null => {
			const needle = studentName.trim().toLowerCase();
			if (!needle) return null;
			const studentMatch = students.find((student) => {
				const display = student.displayName.toLowerCase();
				return (
					display === needle ||
					display.includes(needle) ||
					needle.includes(display) ||
					student.firstInitial.toLowerCase() === needle[0]
				);
			});
			if (studentMatch) return studentMatch.rosterId;
			const contactMatch = contacts.find((contact) => {
				const display = `${contact.firstInitial}.${contact.lastInitial}.`.toLowerCase();
				return display === needle || display.includes(needle) || needle.includes(display);
			});
			return contactMatch?.rosterId ?? null;
		},
		[contacts, students],
	);

	addToQueueRef.current = addToQueue;

	// Stable ref so the preselect effect can call sendQueued without it as a dep.
	// Initialized with a no-op; updated to the real function once sendQueued is declared below.
	const sendQueuedRef = useRef<(item: QueuedMessage) => Promise<void>>(async () => {});

	// React to voice-command preselect (nonce changes = new trigger)
	const preselectNonce = externalPreselect?.nonce ?? 0;
	// biome-ignore lint/correctness/useExhaustiveDependencies: nonce is the intentional trigger
	useEffect(() => {
		if (!externalPreselect) return;
		selectStudent(externalPreselect.rosterId);
		if (externalPreselect.text) setText(externalPreselect.text);
		if (externalPreselect.autoSend && externalPreselect.text) {
			// send_parent_message: build item directly (don't depend on state) and fire immediately
			const item: QueuedMessage = {
				id: crypto.randomUUID(),
				rosterId: externalPreselect.rosterId,
				studentName: externalPreselect.rosterId,
				body: externalPreselect.text,
				errored: false,
			};
			setQueue((prev) => [...prev, item]);
			void sendQueuedRef.current(item);
		} else {
			// draft_parent_message / parent_message: pre-fill and start dictation for review
			setTimeout(() => {
				committedRef.current = externalPreselect?.text ?? "";
				dictStartRef.current?.();
			}, 600);
		}
	}, [preselectNonce]);

	function addToQueue() {
		const trimmed = text.trim();
		if (!trimmed || !selectedRosterId) return;
		const student =
			students.find((s) => s.rosterId === selectedRosterId) ??
			contacts.find((c) => c.rosterId === selectedRosterId);
		const studentName = student
			? "displayName" in student
				? student.displayName
				: `${student.firstInitial}.${student.lastInitial}.`
			: selectedRosterId;
		setQueue((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				rosterId: selectedRosterId,
				studentName,
				body: trimmed,
				errored: false,
			},
		]);
		setText("");
		playQueueChime();
	}

	// ── Dictation via mic manager ────────────────────────────────────────────────
	const textRef = useRef(text);
	textRef.current = text;
	const dictStartRef = useRef<(() => void) | null>(null);
	const dictStopRef = useRef<(() => void) | null>(null);

	const dictConfig: MicConfig = {
		continuous: true as const,
		interimResults: true as const,
		onResult: (word: string, isFinal: boolean) => {
			if (!isFinal) {
				// Show interim text
				setText(committedRef.current ? `${committedRef.current} ${word}` : word);
				return;
			}
			const w = word.trim();
			if (!w) return;
			if (w.toLowerCase() === "cancel") {
				dictStopRef.current?.();
				setText(committedRef.current);
				return;
			}
			if (w.toLowerCase() === "save") {
				addToQueueRef.current();
				committedRef.current = "";
				dictStopRef.current?.();
				return;
			}
			committedRef.current = committedRef.current ? `${committedRef.current} ${w}` : w;
			setText(committedRef.current);
		},
		onNaturalEnd: () => {
			setIsDictating(false);
			setCommsDictating(false);
		},
		onError: (err: string) => {
			if (err === "no-speech") return;
			setIsDictating(false);
			setCommsDictating(false);
		},
	};

	const {
		isActive: dictActive,
		start: dictStartFn,
		stop: dictStopFn,
	} = useMicSlot("dictation", dictConfig);
	dictStopRef.current = dictStopFn;
	dictStartRef.current = dictStartFn;

	// Sync isDictating + commsDictating with mic ownership
	useEffect(() => {
		setIsDictating(dictActive);
		setCommsDictating(dictActive);
	}, [dictActive, setCommsDictating]);

	function toggleDictation() {
		if (isDictating) {
			dictStopFn();
			return;
		}
		if (readBooleanPreference(GLOBAL_VOICE_ONLY_MODE_KEY, false)) {
			toast.error("Global voice only mode is on — turn it off to dictate a message");
			return;
		}
		committedRef.current = textRef.current; // seed with any existing text
		dictStartFn();
	}

	const sendQueued = useCallback(
		async (item: QueuedMessage) => {
			if (sendingId) return;
			setSendingId(item.id);
			setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, errored: false } : q)));
			try {
				const res = await fetch(`/api/classes/${classId}/parent-message`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ rosterId: item.rosterId, body: item.body, triggeredBy: "manual" }),
				});
				if (res.ok) {
					const json = await res.json();
					// Stop continuous dictation now that the message is sent
					if (dictationRef.current) {
						dictationRef.current.onend = null;
						dictationRef.current.stop();
						dictationRef.current = null;
						setIsDictating(false);
						setCommsDictating(false);
					}
					setQueue((prev) => prev.filter((q) => q.id !== item.id));
					if (item.rosterId === selectedRosterId) fetchSent(item.rosterId);
					if (!json.smsSent) {
						toast.warning(
							`Message logged but SMS not delivered: ${json.smsNote ?? "unknown error"}`,
						);
					}
				} else {
					setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, errored: true } : q)));
					toast.error("SMS failed to send — check parent number or connection");
				}
			} catch {
				setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, errored: true } : q)));
				toast.error("Network error — message not sent");
			} finally {
				setSendingId(null);
			}
		},
		[classId, fetchSent, selectedRosterId, sendingId, setCommsDictating],
	);

	sendQueuedRef.current = sendQueued;
	useEffect(() => {
		sendQueuedRef.current = sendQueued;
	}, [sendQueued]);

	useEffect(() => {
		function handleVoiceDraftParentMessage(e: Event) {
			const detail = (e as CustomEvent<{ studentName: string; messageText: string }>).detail;
			const rosterId = resolveRosterIdByStudentName(detail.studentName);
			if (!rosterId) {
				toast.error(`Student "${detail.studentName}" not found`);
				return;
			}
			selectStudent(rosterId);
			setText(detail.messageText);
		}

		function handleVoiceSendParentMessage(e: Event) {
			const detail = (e as CustomEvent<{ studentName: string; messageText: string }>).detail;
			const rosterId = resolveRosterIdByStudentName(detail.studentName);
			if (!rosterId) {
				toast.error(`Student "${detail.studentName}" not found`);
				return;
			}
			selectStudent(rosterId);
			setText(detail.messageText);
			const student =
				students.find((s) => s.rosterId === rosterId) ??
				contacts.find((c) => c.rosterId === rosterId);
			const studentName = student
				? "displayName" in student
					? student.displayName
					: `${student.firstInitial}.${student.lastInitial}.`
				: detail.studentName;
			const item: QueuedMessage = {
				id: crypto.randomUUID(),
				rosterId,
				studentName,
				body: detail.messageText,
				errored: false,
			};
			setQueue((prev) => [...prev, item]);
			void sendQueued(item);
		}

		window.addEventListener("voice-draft_parent_message", handleVoiceDraftParentMessage);
		window.addEventListener("voice-send_parent_message", handleVoiceSendParentMessage);
		return () => {
			window.removeEventListener("voice-draft_parent_message", handleVoiceDraftParentMessage);
			window.removeEventListener("voice-send_parent_message", handleVoiceSendParentMessage);
		};
	}, [contacts, resolveRosterIdByStudentName, selectStudent, sendQueued, students]);

	// Rows: merge roster students with contacts
	const rows =
		students.length > 0
			? students.map((s) => ({
					student: s,
					contact: contacts.find((c) => c.rosterId === s.rosterId),
				}))
			: contacts.map((c) => ({
					student: {
						rosterId: c.rosterId,
						firstInitial: c.firstInitial,
						lastInitial: c.lastInitial,
						displayName: `${c.firstInitial}.${c.lastInitial}.`,
					} as RosterStudent,
					contact: c,
				}));

	const selectedRow = rows.find((r) => r.student.rosterId === selectedRosterId);
	const selectedContact = selectedRow?.contact;
	const selectedStudent = selectedRow?.student;

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Header */}
			<div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
				<div className="flex items-center gap-2">
					<MessageSquareIcon className="h-4 w-4 text-indigo-400" />
					<span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
						Parent Comms
					</span>
					{queue.length > 0 && (
						<span className="rounded-full bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 leading-tight">
							{queue.length}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setHidden((v) => !v)}
						title={hidden ? "Show" : "Hide sensitive content"}
						className="text-slate-600 hover:text-slate-400 transition-colors"
					>
						{hidden ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
					</button>
					{onCollapse && (
						<button
							type="button"
							onClick={onCollapse}
							title="Collapse"
							className="text-slate-600 hover:text-slate-400 transition-colors"
						>
							<ChevronRightIcon className="h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>

			{hidden ? (
				<div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600">
					<EyeOffIcon className="h-6 w-6" />
					<p className="text-xs">Content hidden</p>
				</div>
			) : (
				<div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
					{/* Student pills */}
					<div className="px-3 pt-3 pb-2 shrink-0">
						{contactsLoading ? (
							<p className="text-[10px] text-slate-600">Loading…</p>
						) : rows.length === 0 ? (
							<p className="text-[10px] text-slate-600">No students on roster.</p>
						) : (
							<div className="flex gap-1.5 flex-wrap">
								{rows.map(({ student, contact }) => {
									const isSelected = selectedRosterId === student.rosterId;
									const hasContact = !!contact;
									return (
										<div key={student.rosterId} className="relative">
											<button
												type="button"
												onClick={() => selectStudent(student.rosterId)}
												className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
													isSelected
														? "bg-indigo-600 text-white ring-2 ring-indigo-400/40"
														: hasContact
															? "bg-slate-800 border border-slate-700 text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300"
															: "bg-slate-900 border border-slate-800 text-slate-600 hover:border-slate-700"
												}`}
											>
												{student.firstInitial}
												{student.lastInitial}
												{hasContact && (
													<PhoneIcon
														className={`h-2.5 w-2.5 ${isSelected ? "text-indigo-200" : "text-slate-600"}`}
													/>
												)}
											</button>
											{!hasContact && (
												<button
													type="button"
													onClick={() => setAddingFor(student)}
													title="Add phone"
													className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-slate-700 flex items-center justify-center hover:bg-indigo-600 transition-colors"
												>
													<PlusIcon className="h-2 w-2 text-slate-400" />
												</button>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Add contact form (inline) */}
					{addingFor && (
						<AddContactForm
							classId={classId}
							student={addingFor}
							onSaved={async () => {
								await fetchContacts();
								setAddingFor(null);
							}}
							onCancel={() => setAddingFor(null)}
						/>
					)}

					{/* Compose area */}
					{!addingFor && (
						<div className="px-3 pb-1 shrink-0">
							<div
								className={`rounded-xl border transition-colors ${
									selectedRosterId
										? "border-slate-700 bg-slate-800/60 focus-within:border-indigo-500/60"
										: "border-slate-800 bg-slate-900/40"
								}`}
							>
								{/* To: label */}
								<div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 border-b border-slate-700/60">
									<span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest shrink-0">
										To:
									</span>
									{selectedStudent ? (
										<span className="text-[11px] font-semibold text-slate-300">
											{selectedStudent.displayName}
											{selectedContact?.parentName && (
												<span className="text-slate-500 font-normal ml-1">
													— {selectedContact.parentName}
												</span>
											)}
											{!selectedContact && (
												<span className="text-amber-500/80 font-normal ml-1">(no phone)</span>
											)}
										</span>
									) : (
										<span className="text-[11px] text-slate-600">Select a student above</span>
									)}
									{selectedStudent && !selectedContact && (
										<button
											type="button"
											onClick={() => setAddingFor(selectedStudent)}
											className="ml-auto flex items-center gap-0.5 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
										>
											<UserPlusIcon className="h-3 w-3" />
											Add phone
										</button>
									)}
								</div>
								<textarea
									ref={textareaRef}
									rows={3}
									value={text}
									onChange={(e) => setText(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											addToQueue();
										}
									}}
									placeholder={
										selectedRosterId ? "Type message… Enter to queue" : "Select a student first"
									}
									disabled={!selectedRosterId}
									className="w-full resize-none bg-transparent px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none disabled:cursor-not-allowed"
								/>
								<div className="px-3 pb-2.5 flex items-center justify-between">
									<span className="text-[10px] text-slate-700">
										{text.length > 0 ? `${text.length} chars` : "Enter ↵ to queue"}
									</span>
									<div className="flex items-center gap-1.5">
										<button
											type="button"
											onClick={toggleDictation}
											disabled={!selectedRosterId}
											title={isDictating ? "Stop dictation" : "Dictate message"}
											className={`h-7 w-7 rounded-full flex items-center justify-center border transition-all active:scale-95 disabled:opacity-30 ${isDictating ? "border-red-500/60 bg-red-500/20 text-red-400 animate-pulse" : "border-slate-700 bg-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600"}`}
										>
											<MicIcon className="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											onClick={addToQueue}
											disabled={!text.trim() || !selectedRosterId}
											title="Queue message"
											className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-30 hover:bg-amber-400 active:scale-95 transition-all"
										>
											<ClockIcon className="h-3 w-3" />
											Queue
										</button>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Queue list */}
					{queue.length > 0 && (
						<div className="px-3 pb-3 flex flex-col gap-2 shrink-0">
							<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
								Queued to send ({queue.length})
							</p>
							{queue.map((item) => (
								<div
									key={item.id}
									className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
										item.errored
											? "border-red-500/30 bg-red-950/20"
											: "border-amber-500/20 bg-amber-500/5"
									}`}
								>
									<div className="flex-1 min-w-0">
										<p className="text-[10px] font-bold text-slate-400 mb-0.5">
											{item.studentName}
										</p>
										<p className="text-xs text-slate-200 leading-snug whitespace-pre-wrap break-words">
											{item.body}
										</p>
										{item.errored && (
											<p className="text-[10px] text-red-400 mt-0.5">Send failed — retry?</p>
										)}
									</div>
									<div className="flex flex-col gap-1 shrink-0">
										<button
											type="button"
											onClick={() => sendQueued(item)}
											disabled={sendingId === item.id}
											title="Send now"
											className="h-7 w-7 rounded-full flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 active:scale-95 transition-all"
										>
											{sendingId === item.id ? (
												<span className="h-2 w-2 rounded-full bg-white animate-pulse" />
											) : (
												<SendIcon className="h-3.5 w-3.5" />
											)}
										</button>
										<button
											type="button"
											onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
											title="Discard"
											className="h-7 w-7 rounded-full flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors"
										>
											<XCircleIcon className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
							))}
						</div>
					)}

					{/* Sent history for selected student */}
					{selectedRosterId && <SentHistory messages={sentMsgs} loading={sentLoading} />}
				</div>
			)}
		</div>
	);
}
