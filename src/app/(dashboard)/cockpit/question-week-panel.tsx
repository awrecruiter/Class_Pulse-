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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	imageUrl: string | null;
	sourcePage: number | null;
	sortOrder: number;
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

// ─── DragGhost ────────────────────────────────────────────────────────────────
// Drag overlay ghost card — uses same page-crop logic as BankQuestionCard.

function DragGhost({
	question,
	cropMap,
}: {
	question: QuestionBankItem;
	cropMap: Map<string, { pageIndex: number; pageTotal: number }>;
}) {
	const crop = cropMap.get(question.id) ?? { pageIndex: 0, pageTotal: 1 };
	const bgPos = crop.pageTotal <= 1 ? 0 : (crop.pageIndex / (crop.pageTotal - 1)) * 100;
	return (
		<div className="rounded-lg border border-slate-600 bg-slate-700 shadow-xl rotate-1 pointer-events-none w-48 overflow-hidden">
			{question.imageUrl ? (
				<div
					style={{
						height: 100,
						backgroundImage: `url(${question.imageUrl})`,
						backgroundSize: `100% ${crop.pageTotal * 100}%`,
						backgroundPosition: `0% ${bgPos}%`,
						backgroundRepeat: "no-repeat",
					}}
				/>
			) : (
				<div className="px-3 py-2 text-slate-200 text-[10px] leading-snug">
					{question.stem.length > 80 ? `${question.stem.slice(0, 80)}…` : question.stem}
				</div>
			)}
		</div>
	);
}

// ─── BankQuestionCard ─────────────────────────────────────────────────────────
// Individual draggable card shown in the left bank panel.

function BankQuestionCard({
	question,
	pageIndex = 0,
	pageTotal = 1,
}: {
	question: QuestionBankItem;
	pageIndex?: number;
	pageTotal?: number;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `question:${question.id}`,
	});

	// When multiple questions share the same page image, crop to this question's vertical slice
	const bgPositionY = pageTotal <= 1 ? 0 : (pageIndex / (pageTotal - 1)) * 100;

	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className={`rounded-lg border border-slate-700 bg-slate-800/60 overflow-hidden cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-30" : ""}`}
		>
			{question.imageUrl ? (
				<div
					style={{
						height: 140,
						backgroundImage: `url(${question.imageUrl})`,
						backgroundSize: `100% ${pageTotal * 100}%`,
						backgroundPosition: `0% ${bgPositionY}%`,
						backgroundRepeat: "no-repeat",
					}}
				/>
			) : (
				<div className="px-3 py-2.5">
					<p className="text-[11px] text-slate-300 line-clamp-3 leading-snug">
						{question.stem || "Image question"}
					</p>
				</div>
			)}
			{(question.standardCode || question.topicDay !== null) && (
				<div className="flex items-center gap-2 px-2 py-1 border-t border-slate-700/60">
					{question.topicDay !== null && (
						<span className="text-[9px] text-slate-500">Day {question.topicDay}</span>
					)}
					{question.standardCode && (
						<span className="text-[9px] text-indigo-400 font-mono truncate">
							{question.standardCode}
						</span>
					)}
				</div>
			)}
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
	cropMap,
}: {
	question: QuestionBankItem;
	isToday: boolean;
	activeSessionId: string | null;
	sending: string | null;
	onPush: (questionId: string) => void;
	cropMap: Map<string, { pageIndex: number; pageTotal: number }>;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `question:${question.id}`,
	});
	const { pageIndex, pageTotal } = cropMap.get(question.id) ?? { pageIndex: 0, pageTotal: 1 };
	const bgPositionY = pageTotal <= 1 ? 0 : (pageIndex / (pageTotal - 1)) * 100;

	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className={`rounded bg-slate-800/60 px-2 py-1.5 flex items-start gap-1.5 cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-30" : ""}`}
		>
			<GripVerticalIcon className="h-3 w-3 text-slate-600 shrink-0 mt-0.5" />
			{question.imageUrl ? (
				<div
					className="flex-1 min-w-0 h-10 rounded"
					style={{
						backgroundImage: `url(${question.imageUrl})`,
						backgroundSize: `100% ${pageTotal * 100}%`,
						backgroundPosition: `0% ${bgPositionY}%`,
						backgroundRepeat: "no-repeat",
					}}
				/>
			) : (
				<p className="text-[10px] text-slate-300 line-clamp-2 leading-snug flex-1">
					{question.stem || "Image question"}
				</p>
			)}
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
	cropMap,
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
	cropMap: Map<string, { pageIndex: number; pageTotal: number }>;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `day-col:${date}` });
	const isEmpty = assignedQuestions.length === 0;
	const topicDay = assignedQuestions[0]?.topicDay ?? null;

	return (
		<div className={`min-w-0 w-full flex flex-col min-h-0 ${isToday ? "bg-indigo-950/20" : ""}`}>
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
								cropMap={cropMap}
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
		let intervalId: ReturnType<typeof setInterval> | null = null;
		const poll = async () => {
			try {
				const res = await fetch(`/api/classes/${activeClassId}/session/active`);
				if (cancelled) return;
				if (res.status === 401) {
					// Session expired — stop polling to avoid console spam
					if (intervalId) clearInterval(intervalId);
					return;
				}
				if (!res.ok) return;
				const { id } = (await res.json()) as { id: string | null };
				if (!cancelled) setLiveSessionId(id ?? null);
			} catch {
				// non-fatal
			}
		};
		poll();
		intervalId = setInterval(poll, 10_000);
		return () => {
			cancelled = true;
			if (intervalId) clearInterval(intervalId);
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
	const weekAssignments = buildWeekAssignments(filteredBank, displayedWeekDates);

	// For each question: how many questions share its page image and what is its index within
	// that page group. Built from ALL questions (all tabs) so assigned day-column cards get
	// crop data even when the user switches to a different resource type tab.
	const allCropMap = useMemo(() => {
		const groups = new Map<string, QuestionBankItem[]>();
		for (const q of questions) {
			if (!q.imageUrl) continue;
			const key = q.imageUrl;
			if (!groups.has(key)) groups.set(key, []);
			(groups.get(key) as QuestionBankItem[]).push(q);
		}
		for (const g of groups.values()) g.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
		const map = new Map<string, { pageIndex: number; pageTotal: number }>();
		for (const g of groups.values()) {
			g.forEach((q, i) => {
				map.set(q.id, { pageIndex: i, pageTotal: g.length });
			});
		}
		return map;
	}, [questions]);

	function handleDragStart({ active }: { active: { id: string | number } }) {
		setActiveId(String(active.id));
	}

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);
		const { active, over } = event;
		if (!over) return;

		const activeStr = String(active.id);
		const overStr = String(over.id);

		if (!overStr.startsWith("day-col:") || !activeStr.startsWith("question:")) return;
		const date = overStr.replace("day-col:", "");
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
			window.dispatchEvent(new CustomEvent("load-resources"));
			try {
				localStorage.removeItem("schedule-resources");
			} catch {
				/* ignore */
			}
		} catch {
			toast.error("Failed to clear questions");
		}
	}

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
						<div className="w-52 shrink-0 p-2 space-y-2 overflow-y-auto">
							{unassignedBank.length === 0 ? (
								<p className="text-slate-600 text-xs text-center mt-10">
									{filteredBank.length > 0
										? "All questions assigned"
										: "Upload a PDF to extract questions"}
								</p>
							) : (
								unassignedBank.map((q) => {
									const crop = allCropMap.get(q.id) ?? { pageIndex: 0, pageTotal: 1 };
									return (
										<BankQuestionCard
											key={q.id}
											question={q}
											pageIndex={crop.pageIndex}
											pageTotal={crop.pageTotal}
										/>
									);
								})
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
							<div className="grid grid-cols-5 divide-x divide-slate-700/50 h-full">
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
										cropMap={allCropMap}
									/>
								))}
							</div>
						</div>
					</div>
				</div>

				<DragOverlay dropAnimation={null}>
					{activeDragQuestion && <DragGhost question={activeDragQuestion} cropMap={allCropMap} />}
				</DragOverlay>
			</DndContext>
		</div>
	);
}
