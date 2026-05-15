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
import { BookOpenIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type QuestionBankItem = {
	id: string;
	stem: string;
	choices: string[] | null;
	answer: string;
	questionType: string;
	standardCode: string | null;
	resourceType: string;
	sourceFilename: string;
	extractedAt: string;
};

function QuestionCard({
	q,
	dragging = false,
	onDelete,
}: {
	q: QuestionBankItem;
	dragging?: boolean;
	onDelete?: () => void;
}) {
	return (
		<div
			className={`rounded-lg border p-3 text-sm space-y-1.5 select-none ${
				dragging
					? "border-indigo-500 bg-indigo-900/30 shadow-lg rotate-1"
					: "border-slate-700 bg-slate-800/60 hover:border-slate-500"
			}`}
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-slate-200 text-xs leading-snug line-clamp-3 flex-1">{q.stem}</p>
				{onDelete && (
					<button
						type="button"
						onClick={onDelete}
						className="shrink-0 text-slate-600 hover:text-red-400 transition-colors mt-0.5"
						aria-label="Delete question"
					>
						<Trash2Icon className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<div className="flex items-center gap-1.5 flex-wrap">
				{q.standardCode && (
					<span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
						{q.standardCode}
					</span>
				)}
				<span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400">
					{q.questionType === "mc" ? "MC" : "Free response"}
				</span>
				<span className="text-[10px] text-slate-600 truncate max-w-[12rem]">
					{q.sourceFilename}
				</span>
			</div>
			{q.choices && q.choices.length > 0 && (
				<div className="space-y-0.5">
					{q.choices.map((c) => (
						<p
							key={c}
							className={`text-[10px] pl-1.5 ${c.startsWith(q.answer) ? "text-emerald-400 font-medium" : "text-slate-500"}`}
						>
							{c}
						</p>
					))}
				</div>
			)}
		</div>
	);
}

function DraggableBankCard({ q, onDelete }: { q: QuestionBankItem; onDelete: () => void }) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: q.id });
	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className="cursor-grab active:cursor-grabbing"
		>
			<QuestionCard q={q} dragging={isDragging} onDelete={onDelete} />
		</div>
	);
}

function QueueDropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
	const { setNodeRef, isOver } = useDroppable({ id: "queue" });
	return (
		<div
			ref={setNodeRef}
			className={`flex-1 min-h-[120px] rounded-lg border-2 border-dashed transition-colors p-2 space-y-2 ${
				isOver
					? "border-indigo-500 bg-indigo-900/10"
					: isEmpty
						? "border-slate-700 bg-slate-800/20"
						: "border-slate-700/50"
			}`}
		>
			{isEmpty && (
				<p className="text-slate-600 text-xs text-center mt-8">Drag questions here to queue them</p>
			)}
			{children}
		</div>
	);
}

export function QuestionBankPanel({ activeSessionId }: { activeSessionId: string | null }) {
	const [bank, setBank] = useState<QuestionBankItem[]>([]);
	const [queue, setQueue] = useState<QuestionBankItem[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [sending, setSending] = useState(false);
	const [loading, setLoading] = useState(true);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

	const fetchBank = useCallback(async () => {
		try {
			const res = await fetch("/api/questions");
			if (!res.ok) return;
			const json = await res.json();
			setBank((json as { questions: QuestionBankItem[] }).questions);
		} catch {
			// non-fatal
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchBank();
		const interval = setInterval(fetchBank, 10_000);
		return () => clearInterval(interval);
	}, [fetchBank]);

	const handleDelete = async (id: string) => {
		const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
		if (res.ok) {
			setBank((prev) => prev.filter((q) => q.id !== id));
			setQueue((prev) => prev.filter((q) => q.id !== id));
		} else {
			toast.error("Delete failed");
		}
	};

	function handleDragStart({ active }: { active: { id: string | number } }) {
		setActiveId(String(active.id));
	}

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);
		const { active, over } = event;
		if (!over) return;
		// Only accept drops onto the queue zone
		if (over.id !== "queue") return;

		const question = bank.find((q) => q.id === String(active.id));
		if (!question) return;
		// Don't add duplicates
		if (queue.some((q) => q.id === question.id)) return;
		setQueue((prev) => [...prev, question]);
	}

	const sendNext = async () => {
		if (!activeSessionId || queue.length === 0) return;
		const next = queue[0];
		setSending(true);
		try {
			const res = await fetch(`/api/sessions/${activeSessionId}/question-push`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ questionId: next.id }),
			});
			if (!res.ok) {
				toast.error("Failed to push question");
				return;
			}
			setQueue((prev) => prev.slice(1));
			toast.success("Question sent to students");
		} catch {
			toast.error("Failed to push question");
		} finally {
			setSending(false);
		}
	};

	const activeQuestion = activeId ? bank.find((q) => q.id === activeId) : null;

	return (
		<div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
			<div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-700">
				<BookOpenIcon className="h-4 w-4 text-indigo-400" />
				<span className="font-semibold text-slate-200 text-sm">Question Bank</span>
				{bank.length > 0 && (
					<span className="text-xs text-slate-500">
						{bank.length} question{bank.length !== 1 ? "s" : ""}
					</span>
				)}
				<button
					type="button"
					onClick={fetchBank}
					className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
				>
					Refresh
				</button>
			</div>

			<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
				<div className="flex gap-0 divide-x divide-slate-700">
					{/* Left: Bank */}
					<div className="flex-1 p-3 space-y-2 max-h-80 overflow-y-auto min-w-0">
						{loading && (
							<p className="text-slate-600 text-xs text-center mt-8">Loading questions…</p>
						)}
						{!loading && bank.length === 0 && (
							<p className="text-slate-600 text-xs text-center mt-8">
								Upload a PDF to extract questions
							</p>
						)}
						{bank.map((q) => (
							<DraggableBankCard key={q.id} q={q} onDelete={() => handleDelete(q.id)} />
						))}
					</div>

					{/* Right: Queue */}
					<div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-slate-400">Today's Queue</span>
							{queue.length > 0 && (
								<button
									type="button"
									onClick={() => setQueue([])}
									className="text-xs text-slate-600 hover:text-slate-400 flex items-center gap-1"
								>
									<XIcon className="h-3 w-3" />
									Clear
								</button>
							)}
						</div>
						<QueueDropZone isEmpty={queue.length === 0}>
							{queue.map((q, i) => (
								<div key={q.id} className="flex items-start gap-1.5">
									<span className="text-[10px] text-slate-600 mt-3 shrink-0 w-4 text-right">
										{i + 1}.
									</span>
									<div className="flex-1 min-w-0">
										<QuestionCard
											q={q}
											onDelete={() => setQueue((prev) => prev.filter((_, idx) => idx !== i))}
										/>
									</div>
								</div>
							))}
						</QueueDropZone>

						<button
							type="button"
							onClick={sendNext}
							disabled={!activeSessionId || queue.length === 0 || sending}
							className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
						>
							<SendIcon className="h-3.5 w-3.5" />
							{sending
								? "Sending…"
								: `Send Next${queue.length > 0 ? ` (${queue.length} left)` : ""}`}
						</button>
						{!activeSessionId && (
							<p className="text-[10px] text-slate-600 text-center">
								Start a session to push questions
							</p>
						)}
					</div>
				</div>

				<DragOverlay dropAnimation={null}>
					{activeQuestion && <QuestionCard q={activeQuestion} dragging />}
				</DragOverlay>
			</DndContext>
		</div>
	);
}
