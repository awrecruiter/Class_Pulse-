"use client";

import {
	CheckIcon,
	ChevronLeftIcon,
	MessageSquareIcon,
	PhoneIcon,
	SendIcon,
	XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

type Message = {
	id: string;
	body: string;
	status: "sent" | "failed";
	triggeredBy: string;
	sentAt: string;
	smsSid: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerLabel(trigger: string) {
	const map: Record<string, string> = {
		incident: "Incident",
		manual: "Manual",
		broadcast: "Broadcast",
		"academic-guidance": "Academic",
	};
	return map[trigger] ?? trigger;
}

function triggerColor(trigger: string) {
	if (trigger === "incident") return "bg-orange-500/20 text-orange-300 border-orange-500/30";
	if (trigger === "academic-guidance") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
	return "bg-slate-700/60 text-slate-400 border-slate-600/40";
}

function fmtTime(iso: string) {
	return new Date(iso).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

// ─── Message thread ───────────────────────────────────────────────────────────

function MessageThread({ messages, loading }: { messages: Message[]; loading: boolean }) {
	const bottomRef = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on change
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	if (loading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="flex gap-1.5">
					{[0, 1, 2].map((i) => (
						<span
							key={i}
							className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
							style={{ animationDelay: `${i * 150}ms` }}
						/>
					))}
				</div>
			</div>
		);
	}

	if (messages.length === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
				<MessageSquareIcon className="h-8 w-8 text-slate-600" />
				<p className="text-xs text-slate-500">No messages sent yet</p>
			</div>
		);
	}

	// Oldest first for thread display
	const sorted = [...messages].reverse();

	return (
		<div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
			{sorted.map((msg) => (
				<div key={msg.id} className="flex flex-col gap-1">
					{/* Header row */}
					<div className="flex items-center gap-1.5 flex-wrap">
						<span
							className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${triggerColor(msg.triggeredBy)}`}
						>
							{triggerLabel(msg.triggeredBy)}
						</span>
						{msg.status === "sent" ? (
							<span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400">
								<CheckIcon className="h-2.5 w-2.5" />
								Delivered
							</span>
						) : (
							<span className="inline-flex items-center gap-0.5 text-[10px] text-red-400">
								<XCircleIcon className="h-2.5 w-2.5" />
								Failed
							</span>
						)}
						<span className="text-[10px] text-slate-600 ml-auto shrink-0">
							{fmtTime(msg.sentAt)}
						</span>
					</div>

					{/* Bubble */}
					<div
						className={`rounded-xl rounded-tl-sm px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
							msg.status === "sent"
								? "bg-slate-800 border border-slate-700 text-slate-200"
								: "bg-red-950/40 border border-red-500/20 text-slate-400"
						}`}
					>
						{msg.body}
					</div>
				</div>
			))}
			<div ref={bottomRef} />
		</div>
	);
}

// ─── Compose bar ──────────────────────────────────────────────────────────────

function ComposeBar({
	classId,
	rosterId,
	onSent,
}: {
	classId: string;
	rosterId: string;
	onSent: () => void;
}) {
	const [text, setText] = useState("");
	const [state, setState] = useState<"idle" | "loading" | "error">("idle");
	const [errMsg, setErrMsg] = useState("");

	async function send() {
		const trimmed = text.trim();
		if (!trimmed || state === "loading") return;
		setState("loading");
		setErrMsg("");
		try {
			const res = await fetch(`/api/classes/${classId}/parent-message`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId, body: trimmed, triggeredBy: "manual" }),
			});
			const json = await res.json();
			if (json.error) {
				setErrMsg(json.error);
				setState("error");
			} else {
				setText("");
				setState("idle");
				onSent();
			}
		} catch {
			setErrMsg("Network error");
			setState("error");
		}
	}

	return (
		<div className="border-t border-slate-800 px-3 py-3 flex flex-col gap-2 shrink-0">
			{errMsg && <p className="text-[10px] text-red-400">{errMsg}</p>}
			<div className="flex gap-2 items-end">
				<textarea
					rows={2}
					value={text}
					onChange={(e) => {
						setText(e.target.value);
						if (state === "error") setState("idle");
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							send();
						}
					}}
					placeholder="Type a message to parent…"
					className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					disabled={state === "loading"}
				/>
				<button
					type="button"
					onClick={send}
					disabled={!text.trim() || state === "loading"}
					className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 active:scale-95 transition-all"
				>
					<SendIcon className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}

// ─── Contact list item ────────────────────────────────────────────────────────

function ContactRow({
	contact,
	active,
	onSelect,
}: {
	contact: Contact;
	active: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all active:scale-[0.98] ${
				active
					? "bg-indigo-500/20 border border-indigo-500/50"
					: "hover:bg-slate-800/80 border border-transparent"
			}`}
		>
			<div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
				<span className="text-[10px] font-bold text-white">
					{contact.firstInitial}
					{contact.lastInitial}
				</span>
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-xs font-semibold text-slate-200 truncate">
					{contact.firstInitial}.{contact.lastInitial}.
					{contact.parentName && (
						<span className="text-slate-500 font-normal ml-1">— {contact.parentName}</span>
					)}
				</p>
				<p className="text-[10px] text-slate-500 flex items-center gap-1">
					<PhoneIcon className="h-2.5 w-2.5 shrink-0" />
					{contact.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}
				</p>
			</div>
		</button>
	);
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ParentCommsPanel({ classId }: { classId: string }) {
	const [contacts, setContacts] = useState<Contact[]>([]);
	const [contactsLoading, setContactsLoading] = useState(true);
	const [selected, setSelected] = useState<Contact | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [msgsLoading, setMsgsLoading] = useState(false);
	const [showThread, setShowThread] = useState(false);

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

	const fetchMessages = useCallback(
		async (rosterId: string) => {
			setMsgsLoading(true);
			try {
				const res = await fetch(`/api/classes/${classId}/parent-message?rosterId=${rosterId}`);
				if (res.ok) setMessages((await res.json()).messages ?? []);
			} catch {
				/* noop */
			} finally {
				setMsgsLoading(false);
			}
		},
		[classId],
	);

	function selectContact(c: Contact) {
		setSelected(c);
		setShowThread(true);
		fetchMessages(c.rosterId);
	}

	function handleSent() {
		if (selected) fetchMessages(selected.rosterId);
	}

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Header */}
			<div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
				<div className="flex items-center gap-2">
					{showThread && selected && (
						<button
							type="button"
							onClick={() => setShowThread(false)}
							className="text-slate-500 hover:text-slate-300 transition-colors mr-1"
						>
							<ChevronLeftIcon className="h-4 w-4" />
						</button>
					)}
					<MessageSquareIcon className="h-4 w-4 text-indigo-400" />
					<span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
						{showThread && selected
							? `${selected.firstInitial}.${selected.lastInitial}. — Parent`
							: "Parent Comms"}
					</span>
				</div>
				{!showThread && (
					<span className="text-[10px] text-slate-600">
						{contactsLoading ? "…" : `${contacts.length} contacts`}
					</span>
				)}
			</div>

			{/* Thread view */}
			{showThread && selected ? (
				<>
					<MessageThread messages={messages} loading={msgsLoading} />
					<ComposeBar classId={classId} rosterId={selected.rosterId} onSent={handleSent} />
				</>
			) : (
				/* Contact list */
				<div className="flex-1 overflow-y-auto min-h-0">
					{contactsLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="flex gap-1.5">
								{[0, 1, 2].map((i) => (
									<span
										key={i}
										className="h-1.5 w-1.5 rounded-full bg-slate-600 animate-bounce"
										style={{ animationDelay: `${i * 150}ms` }}
									/>
								))}
							</div>
						</div>
					) : contacts.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
							<PhoneIcon className="h-8 w-8 text-slate-700" />
							<p className="text-xs text-slate-500 leading-relaxed">
								No parent contacts on file.
								<br />
								Add them in the class contact manager.
							</p>
						</div>
					) : (
						<div className="px-2 py-2 flex flex-col gap-1">
							{contacts.map((c) => (
								<ContactRow
									key={c.id}
									contact={c}
									active={selected?.id === c.id}
									onSelect={() => selectContact(c)}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
