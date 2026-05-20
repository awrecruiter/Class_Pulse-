"use client";

import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	BookOpenIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	GripVerticalIcon,
	LayersIcon,
	PlusIcon,
	SendIcon,
	UploadIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadPanel } from "./upload-panel";

type QuestionBankItem = {
	id: string;
	stem: string;
	choices: string[] | null;
	answer: string;
	questionType: string;
	standardCode: string | null;
	resourceType: string;
	sourceFilename: string;
	topicDay: number | null;
	assignedDate: string | null;
	extractedAt: string;
};

type Props = {
	today: string;
	weekDates: string[];
	initialQuestions: QuestionBankItem[];
	activeSessionId: string | null;
	classId: string | null;
};

const RESOURCE_TABS = [
	{ key: "bell-ringer" as const, label: "Bell Ringer" },
	{ key: "cfu" as const, label: "CFU" },
	{ key: "exit-ticket" as const, label: "Exit Ticket" },
];

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function computeWeekDates(todayISO: string, weekOffset: number): string[] {
	const d = new Date(`${todayISO}T12:00:00`);
	const dow = d.getDay();
	const toMonday = dow === 0 ? -6 : 1 - dow;
	const monday = new Date(d);
	monday.setDate(d.getDate() + toMonday + weekOffset * 7);
	return Array.from({ length: 5 }, (_, i) => {
		const day = new Date(monday);
		day.setDate(monday.getDate() + i);
		return day.toISOString().slice(0, 10);
	});
}

function groupByTopicDay(questions: QuestionBankItem[]): Map<number | null, QuestionBankItem[]> {
	const map = new Map<number | null, QuestionBankItem[]>();
	for (const q of questions) {
		const key = q.topicDay ?? null;
		if (!map.has(key)) map.set(key, []);
		map.get(key)?.push(q);
	}
	const sorted = new Map<number | null, QuestionBankItem[]>();
	const keys = Array.from(map.keys()).sort((a, b) => {
		if (a === null) return 1;
		if (b === null) return -1;
		return a - b;
	});
	for (const k of keys) sorted.set(k, map.get(k) ?? []);
	return sorted;
}

function buildWeekAssignments(
	questions: QuestionBankItem[],
	weekDates: string[],
): Record<string, QuestionBankItem[]> {
	const result: Record<string, QuestionBankItem[]> = {};
	for (const date of weekDates) result[date] = [];
	for (const q of questions) {
		if (q.assignedDate && result[q.assignedDate] !== undefined) {
			result[q.assignedDate].push(q);
		}
	}
	return result;
}

function formatMmDd(isoDate: string): string {
	return isoDate.slice(5).replace("-", "/");
}

// ─── DayGroupSection ─────────────────────────────────────────────────────────

function DayGroupSection({
	topicDay,
	questions,
	resourceType,
}: {
	topicDay: number | null;
	questions: QuestionBankItem[];
	resourceType: string;
}) {
	const draggableId = `day-group:${resourceType}:${topicDay ?? "null"}`;
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: draggableId });

	const assignedDate = questions[0]?.assignedDate ?? null;

	return (
		<div
			className={`rounded-lg border border-slate-700 bg-slate-800/60 overflow-hidden ${isDragging ? "opacity-40" : ""}`}
		>
			<div
				ref={setNodeRef}
				{...attributes}
				{...listeners}
				className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 cursor-grab active:cursor-grabbing select-none"
			>
				<GripVerticalIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
				<span className="text-xs font-semibold text-slate-200 flex-1">
					{topicDay !== null ? `Day ${topicDay}` : "Unassigned"}
					<span className="text-slate-500 font-normal ml-1">· {questions.length} Qs</span>
				</span>
				{assignedDate && (
					<span className="text-[10px] text-indigo-400 shrink-0">→ {formatMmDd(assignedDate)}</span>
				)}
			</div>
			<div className="p-2 space-y-1.5">
				{questions.map((q) => (
					<div key={q.id} className="rounded-md bg-slate-900/40 px-2 py-1.5">
						<p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">{q.stem}</p>
						{q.standardCode && (
							<span className="text-[9px] text-indigo-400 font-mono">{q.standardCode}</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

// ─── DraggableQuestion ────────────────────────────────────────────────────────

function DraggableQuestion({
	question,
	isToday,
	activeSessionId,
	sending,
	onPush,
}: {
	question: QuestionBankItem;
	isToday: boolean;
	activeSessionId: string | null;
	sending: string | null;
	onPush: (questionId: string) => void;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `question:${question.id}`,
	});

	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className={`rounded bg-slate-800/60 px-2 py-1.5 flex items-start gap-1.5 cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-30" : ""}`}
		>
			<GripVerticalIcon className="h-3 w-3 text-slate-600 shrink-0 mt-0.5" />
			<p className="text-[10px] text-slate-300 line-clamp-2 leading-snug flex-1">{question.stem}</p>
			{isToday && activeSessionId && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onPush(question.id);
					}}
					disabled={sending === question.id}
					className="shrink-0 text-indigo-400 hover:text-indigo-200 disabled:opacity-40 transition-colors mt-0.5"
					aria-label="Push to students"
				>
					<SendIcon className="h-3 w-3" />
				</button>
			)}
		</div>
	);
}

// ─── DayColumn ───────────────────────────────────────────────────────────────

function DayColumn({
	date,
	dayShort,
	isToday,
	assignedQuestions,
	activeSessionId,
	sending,
	onPush,
	onUnassign,
	onSendNext,
}: {
	date: string;
	dayShort: string;
	isToday: boolean;
	assignedQuestions: QuestionBankItem[];
	activeSessionId: string | null;
	sending: string | null;
	onPush: (questionId: string) => void;
	onUnassign: () => void;
	onSendNext?: () => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `day-col:${date}` });
	const isEmpty = assignedQuestions.length === 0;
	const topicDay = assignedQuestions[0]?.topicDay ?? null;

	return (
		<div className={`min-w-[96px] flex flex-col min-h-0 ${isToday ? "bg-indigo-950/20" : ""}`}>
			{/* Column header */}
			<div
				className={`px-2 py-2 border-b ${
					isToday ? "border-indigo-700/50" : "border-slate-700/50"
				} ${isToday && activeSessionId && onSendNext && !isEmpty ? "flex items-center gap-1.5" : "text-center"}`}
			>
				<div
					className={`inline-flex flex-col items-center rounded-lg px-1.5 py-0.5 ${
						isToday ? "bg-indigo-600/20" : ""
					}`}
				>
					<span
						className={`text-[10px] font-bold uppercase tracking-wider ${
							isToday ? "text-indigo-300" : "text-slate-500"
						}`}
					>
						{dayShort}
					</span>
					<span
						className={`text-[10px] font-mono ${isToday ? "text-indigo-400" : "text-slate-600"}`}
					>
						{formatMmDd(date)}
					</span>
				</div>
				{isToday && activeSessionId && onSendNext && !isEmpty && (
					<button
						type="button"
						onClick={onSendNext}
						className="ml-auto flex items-center gap-1 rounded-md bg-indigo-600/80 hover:bg-indigo-500 px-1.5 py-0.5 text-[10px] font-semibold text-white transition-colors shrink-0"
						aria-label="Send next question to students"
					>
						<SendIcon className="h-3 w-3" />
						Send Next
					</button>
				)}
			</div>

			{/* Drop zone */}
			<div
				ref={setNodeRef}
				className={`overflow-y-auto p-2 transition-colors ${
					isOver
						? "bg-indigo-900/20 ring-2 ring-inset ring-indigo-500/50"
						: isEmpty
							? "border-2 border-dashed border-slate-700/50 m-1 rounded-lg"
							: ""
				}`}
			>
				{isEmpty ? (
					<div className="flex items-center justify-center h-full">
						<PlusIcon className={`h-4 w-4 ${isOver ? "text-indigo-400" : "text-slate-700"}`} />
					</div>
				) : (
					<div className="space-y-1.5">
						{/* Filled header */}
						<div className="flex items-center justify-between mb-1">
							<span className="text-[10px] font-semibold text-slate-400">
								{topicDay !== null ? `Day ${topicDay}` : "Custom"}
								<span className="text-slate-600 font-normal ml-1">
									· {assignedQuestions.length} Qs
								</span>
							</span>
							<button
								type="button"
								onClick={onUnassign}
								className="text-slate-600 hover:text-red-400 transition-colors"
								aria-label="Unassign"
							>
								<XIcon className="h-3 w-3" />
							</button>
						</div>

						{/* Individual draggable question tiles */}
						{assignedQuestions.map((q) => (
							<DraggableQuestion
								key={q.id}
								question={q}
								isToday={isToday}
								activeSessionId={activeSessionId}
								sending={sending}
								onPush={onPush}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuestionWeekPanel({
	today,
	weekDates: _initialWeekDates,
	initialQuestions,
	activeSessionId,
	classId: initialClassId,
}: Props) {
	const [activeClassId, setActiveClassId] = useState<string | null>(initialClassId);
	const [questions, setQuestions] = useState<QuestionBankItem[]>(initialQuestions);
	const [activeTab, setActiveTab] = useState<"bell-ringer" | "cfu" | "exit-ticket">("bell-ringer");
	const [sending, setSending] = useState<string | null>(null);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [uploadOpen, setUploadOpen] = useState(false);
	const [weekOffset, setWeekOffset] = useState(0);

	const displayedWeekDates = computeWeekDates(today, weekOffset);

	// Live session ID — kept fresh via polling so cockpit staleness is not an issue
	const [liveSessionId, setLiveSessionId] = useState(activeSessionId);

	// Sync if the RSC prop ever changes (e.g. hard navigation)
	useEffect(() => {
		setLiveSessionId(activeSessionId);
	}, [activeSessionId]);

	// Listen for class switches from CockpitClassPicker
	useEffect(() => {
		const handler = (e: Event) => {
			setActiveClassId((e as CustomEvent<{ classId: string }>).detail.classId ?? null);
		};
		window.addEventListener("class-selected", handler);
		return () => window.removeEventListener("class-selected", handler);
	}, []);

	// Poll the active-session endpoint every 10 s so "Send Next" activates without a page reload
	useEffect(() => {
		if (!activeClassId) return;
		let cancelled = false;
		const poll = async () => {
			try {
				const res = await fetch(`/api/classes/${activeClassId}/session/active`);
				if (!res.ok || cancelled) return;
				const { id } = (await res.json()) as { id: string | null };
				if (!cancelled) setLiveSessionId(id ?? null);
			} catch {
				// non-fatal
			}
		};
		poll();
		const interval = setInterval(poll, 10_000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [activeClassId]);

	// Tracks which question IDs have been pushed this session — reset when session changes
	const pushedIdsRef = useRef<Set<string>>(new Set());
	// biome-ignore lint/correctness/useExhaustiveDependencies: liveSessionId is an intentional reactive trigger — effect body clears the ref when session changes
	useEffect(() => {
		pushedIdsRef.current = new Set();
	}, [liveSessionId]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

	const fetchQuestions = useCallback(async () => {
		try {
			const res = await fetch("/api/questions");
			if (!res.ok) return;
			const json = await res.json();
			setQuestions((json as { questions: QuestionBankItem[] }).questions);
		} catch {
			// non-fatal
		}
	}, []);

	useEffect(() => {
		fetchQuestions();
		const id = setInterval(fetchQuestions, 10_000);
		return () => clearInterval(id);
	}, [fetchQuestions]);

	const filteredBank = questions.filter((q) => q.resourceType === activeTab);
	// Bank panel shows only unassigned questions — assigned ones live in their day columns
	const unassignedBank = filteredBank.filter((q) => q.assignedDate === null);
	const groups = groupByTopicDay(unassignedBank);
	const weekAssignments = buildWeekAssignments(filteredBank, displayedWeekDates);

	function handleDragStart({ active }: { active: { id: string | number } }) {
		setActiveId(String(active.id));
	}

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);
		const { active, over } = event;
		if (!over) return;

		const activeStr = String(active.id);
		const overStr = String(over.id);

		if (!overStr.startsWith("day-col:")) return;
		const date = overStr.replace("day-col:", "");

		// ── Single question drag (from any column to another) ──
		if (activeStr.startsWith("question:")) {
			const questionId = activeStr.replace("question:", "");
			const current = questions.find((q) => q.id === questionId);
			if (!current || current.assignedDate === date) return;

			setQuestions((prev) =>
				prev.map((q) => (q.id === questionId ? { ...q, assignedDate: date } : q)),
			);

			fetch("/api/questions/assign-date", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ questionIds: [questionId], date }),
			}).catch(() => {
				setQuestions((prev) =>
					prev.map((q) => (q.id === questionId ? { ...q, assignedDate: current.assignedDate } : q)),
				);
				toast.error("Failed to save assignment");
			});
			return;
		}

		// ── Group drag (from bank left panel) ──
		if (!activeStr.startsWith("day-group:")) return;

		const parts = activeStr.split(":");
		const resourceType = parts[1];
		const topicDayStr = parts[2];
		const topicDay = topicDayStr === "null" ? null : Number(topicDayStr);

		const ids = questions
			.filter((q) => q.resourceType === resourceType && q.topicDay === topicDay)
			.map((q) => q.id);

		if (ids.length === 0) return;

		// Optimistic update
		setQuestions((prev) =>
			prev.map((q) => (ids.includes(q.id) ? { ...q, assignedDate: date } : q)),
		);

		fetch("/api/questions/assign-date", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ questionIds: ids, date }),
		}).catch(() => {
			setQuestions((prev) =>
				prev.map((q) => (ids.includes(q.id) ? { ...q, assignedDate: null } : q)),
			);
			toast.error("Failed to save assignment");
		});
	}

	async function handleUnassign(date: string) {
		const ids = questions
			.filter((q) => q.resourceType === activeTab && q.assignedDate === date)
			.map((q) => q.id);
		if (ids.length === 0) return;
		setQuestions((prev) =>
			prev.map((q) => (ids.includes(q.id) ? { ...q, assignedDate: null } : q)),
		);
		try {
			await fetch("/api/questions/assign-date", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ questionIds: ids, date: null }),
			});
		} catch {
			toast.error("Failed to unassign");
		}
	}

	async function handlePush(questionId: string) {
		if (!liveSessionId || sending) return;
		setSending(questionId);
		try {
			const res = await fetch(`/api/sessions/${liveSessionId}/question-push`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ questionId }),
			});
			if (!res.ok) {
				toast.error("Failed to push question");
				return;
			}
			pushedIdsRef.current.add(questionId);
			toast.success("Question sent to students");
		} catch {
			toast.error("Failed to push question");
		} finally {
			setSending(null);
		}
	}

	async function handleSendNext() {
		const todayQuestions = (weekAssignments[today] ?? []).filter(
			(q) => q.resourceType === activeTab,
		);
		const next = todayQuestions.find((q) => !pushedIdsRef.current.has(q.id));
		if (!next) {
			toast.info("No more questions to send for today");
			return;
		}
		await handlePush(next.id);
	}

	async function handleClearAll() {
		if (!confirm("Delete all questions from the bank? This cannot be undone.")) return;
		try {
			const res = await fetch("/api/questions/clear", { method: "DELETE" });
			if (!res.ok) {
				toast.error("Failed to clear questions");
				return;
			}
			setQuestions([]);
			toast.success("Question bank cleared");
		} catch {
			toast.error("Failed to clear questions");
		}
	}

	const activeDragParts = activeId?.split(":");
	const activeDragTopicDay = activeId?.startsWith("day-group:") ? activeDragParts?.[2] : undefined;
	const activeDragCount =
		activeDragTopicDay !== undefined
			? (groups.get(activeDragTopicDay === "null" ? null : Number(activeDragTopicDay))?.length ?? 0)
			: 0;
	const activeDragQuestion = activeId?.startsWith("question:")
		? questions.find((q) => q.id === activeId.replace("question:", ""))
		: undefined;

	const weekLabel = (() => {
		const start = displayedWeekDates[0];
		const end = displayedWeekDates[4];
		if (!start || !end) return "";
		return `${formatMmDd(start)} – ${formatMmDd(end)}`;
	})();

	return (
		<div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
			{/* Header */}
			<div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 flex-wrap gap-y-2">
				<BookOpenIcon className="h-4 w-4 text-indigo-400 shrink-0" />
				<span className="font-semibold text-slate-200 text-sm">Question Bank</span>
				<div className="flex gap-1 ml-1">
					{RESOURCE_TABS.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
								activeTab === tab.key
									? "bg-indigo-600 text-white"
									: "bg-slate-700/50 text-slate-400 hover:text-slate-200"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
				<div className="ml-auto flex items-center gap-2">
					<button
						type="button"
						onClick={() => window.dispatchEvent(new CustomEvent("load-resources"))}
						className="flex items-center gap-1.5 rounded-md border border-indigo-700/60 px-2.5 py-1 text-xs text-indigo-400 hover:text-indigo-200 hover:border-indigo-500 transition-colors"
					>
						<LayersIcon className="h-3 w-3" />
						Load Resources
					</button>
					<button
						type="button"
						onClick={() => setUploadOpen((v) => !v)}
						className="flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
					>
						<UploadIcon className="h-3 w-3" />
						Upload
						{uploadOpen ? (
							<ChevronUpIcon className="h-3 w-3" />
						) : (
							<ChevronDownIcon className="h-3 w-3" />
						)}
					</button>
					{questions.length > 0 && (
						<button
							type="button"
							onClick={handleClearAll}
							className="text-xs text-slate-500 hover:text-red-400 transition-colors"
						>
							Clear all
						</button>
					)}
					<button
						type="button"
						onClick={fetchQuestions}
						className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
					>
						Refresh
					</button>
				</div>
			</div>

			{/* Collapsible upload section */}
			{uploadOpen && (
				<div className="border-b border-slate-700 bg-slate-900/30">
					<UploadPanel classId={activeClassId} inline onQuestionsReady={fetchQuestions} />
				</div>
			)}

			{/* Body */}
			<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
				<div className="flex divide-x divide-slate-700" style={{ height: 400 }}>
					{/* Left: Bank — hidden when all questions for this tab are assigned */}
					{(unassignedBank.length > 0 || filteredBank.length === 0) && (
						<div className="w-64 shrink-0 p-3 space-y-2.5 overflow-y-auto">
							{groups.size === 0 ? (
								<p className="text-slate-600 text-xs text-center mt-10">
									{filteredBank.length > 0
										? "All questions assigned — drag between columns to move"
										: "Upload a PDF to extract questions"}
								</p>
							) : (
								Array.from(groups.entries()).map(([topicDay, qs]) => (
									<DayGroupSection
										key={topicDay ?? "null"}
										topicDay={topicDay}
										questions={qs}
										resourceType={activeTab}
									/>
								))
							)}
						</div>
					)}

					{/* Right: Week columns */}
					<div className="flex-1 min-w-0 flex flex-col">
						{/* Week navigation bar */}
						<div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
							<button
								type="button"
								onClick={() => setWeekOffset((v) => v - 1)}
								className="p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
								aria-label="Previous week"
							>
								<ChevronLeftIcon className="h-4 w-4" />
							</button>
							<span className="text-[10px] text-slate-500 font-mono select-none">
								{weekOffset === 0
									? "This week"
									: weekOffset === 1
										? "Next week"
										: weekOffset === -1
											? "Last week"
											: weekLabel}
								{weekOffset !== 0 && <span className="ml-1 text-slate-600">({weekLabel})</span>}
							</span>
							<button
								type="button"
								onClick={() => setWeekOffset((v) => v + 1)}
								className="p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
								aria-label="Next week"
							>
								<ChevronRightIcon className="h-4 w-4" />
							</button>
						</div>

						{/* Day columns */}
						<div className="flex-1 overflow-x-auto min-h-0">
							<div className="flex divide-x divide-slate-700/50 min-w-[480px] h-full">
								{displayedWeekDates.map((date, i) => (
									<DayColumn
										key={date}
										date={date}
										dayShort={DAY_SHORT[i] ?? ""}
										isToday={date === today}
										assignedQuestions={weekAssignments[date] ?? []}
										activeSessionId={liveSessionId}
										sending={sending}
										onPush={handlePush}
										onUnassign={() => handleUnassign(date)}
										onSendNext={date === today ? handleSendNext : undefined}
									/>
								))}
							</div>
						</div>
					</div>
				</div>

				<DragOverlay dropAnimation={null}>
					{activeDragQuestion ? (
						<div className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-[10px] shadow-xl rotate-1 pointer-events-none max-w-[200px] leading-snug">
							{activeDragQuestion.stem.length > 80
								? `${activeDragQuestion.stem.slice(0, 80)}…`
								: activeDragQuestion.stem}
						</div>
					) : activeDragTopicDay !== undefined ? (
						<div className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xl rotate-2 pointer-events-none">
							{activeDragTopicDay === "null" ? "Unassigned" : `Day ${activeDragTopicDay}`} ·{" "}
							{activeDragCount} Qs
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
}
