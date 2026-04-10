"use client";

import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	PointerSensor,
	TouchSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleDocLinkRow = {
	id: string;
	label: string;
	url: string;
	linkType: string;
};

type ScheduleBlockRow = {
	id: string;
	title: string;
	color: string;
	startTime: string;
	endTime: string;
	dayOfWeek: number | null;
	specificDate: string | null;
	sortOrder: number;
	docs: ScheduleDocLinkRow[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_HEIGHT = 48;
const GRID_START = 7 * 60; // 420 minutes = 7:00 AM
const GRID_END = 17 * 60; // 1020 minutes = 5:00 PM
const TOTAL_SLOTS = (GRID_END - GRID_START) / 30; // 20 slots

const DAYS = [
	{ label: "Mon", dayOfWeek: 1 },
	{ label: "Tue", dayOfWeek: 2 },
	{ label: "Wed", dayOfWeek: 3 },
	{ label: "Thu", dayOfWeek: 4 },
	{ label: "Fri", dayOfWeek: 5 },
];

const COLOR_BG: Record<string, string> = {
	blue: "bg-blue-500/20 border-blue-500/40 text-blue-200",
	indigo: "bg-indigo-500/20 border-indigo-500/40 text-indigo-200",
	violet: "bg-violet-500/20 border-violet-500/40 text-violet-200",
	green: "bg-green-500/20 border-green-500/40 text-green-200",
	emerald: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
	teal: "bg-teal-500/20 border-teal-500/40 text-teal-200",
	cyan: "bg-cyan-500/20 border-cyan-500/40 text-cyan-200",
	red: "bg-red-500/20 border-red-500/40 text-red-200",
	orange: "bg-orange-500/20 border-orange-500/40 text-orange-200",
	amber: "bg-amber-500/20 border-amber-500/40 text-amber-200",
	pink: "bg-pink-500/20 border-pink-500/40 text-pink-200",
	slate: "bg-slate-500/20 border-slate-500/40 text-slate-200",
};

const COLOR_SWATCH: Record<string, string> = {
	blue: "bg-blue-500",
	indigo: "bg-indigo-500",
	violet: "bg-violet-500",
	green: "bg-green-500",
	emerald: "bg-emerald-500",
	teal: "bg-teal-500",
	cyan: "bg-cyan-500",
	red: "bg-red-500",
	orange: "bg-orange-500",
	amber: "bg-amber-500",
	pink: "bg-pink-500",
	slate: "bg-slate-500",
};

const COLOR_NAMES = Object.keys(COLOR_BG);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
	const [h, m] = hhmm.split(":").map(Number);
	return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToPx(minutes: number): number {
	return ((minutes - GRID_START) / 30) * SLOT_HEIGHT;
}

function minutesToHhmm(minutes: number): string {
	return `${Math.floor(minutes / 60)
		.toString()
		.padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

// ─── SlotDropTarget ───────────────────────────────────────────────────────────

function SlotDropTarget({
	dayOfWeek,
	slotIndex,
	onClick,
}: {
	dayOfWeek: number;
	slotIndex: number;
	onClick: () => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: `slot-${dayOfWeek}-${slotIndex}` });
	return (
		<button
			type="button"
			ref={setNodeRef}
			onClick={onClick}
			style={{ top: `${slotIndex * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
			className={cn(
				"absolute inset-x-0 cursor-pointer transition-colors text-left",
				slotIndex % 2 === 0 ? "border-b border-slate-800" : "border-b border-slate-800/30",
				isOver && "bg-indigo-500/10",
			)}
		/>
	);
}

// ─── BlockEditForm ────────────────────────────────────────────────────────────

function BlockEditForm({
	block,
	onUpdate,
	onDelete,
	onAddDoc,
	onDeleteDoc,
	onClose,
}: {
	block: ScheduleBlockRow;
	onUpdate: (patch: Partial<ScheduleBlockRow>) => void;
	onDelete: () => void;
	onAddDoc: (blockId: string, label: string, url: string, linkType: string) => Promise<void>;
	onDeleteDoc: (blockId: string, docId: string) => Promise<void>;
	onClose: () => void;
}) {
	const [title, setTitle] = useState(block.title);
	const [startTime, setStartTime] = useState(block.startTime);
	const [endTime, setEndTime] = useState(block.endTime);
	const [docLabel, setDocLabel] = useState("");
	const [docUrl, setDocUrl] = useState("");
	const [docType, setDocType] = useState("url");
	const [addingDoc, setAddingDoc] = useState(false);

	// Sync if block changes externally
	useEffect(() => {
		setTitle(block.title);
		setStartTime(block.startTime);
		setEndTime(block.endTime);
	}, [block.title, block.startTime, block.endTime]);

	return (
		<div className="flex flex-col gap-3">
			{/* Title */}
			<input
				type="text"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				onBlur={() => {
					const trimmed = title.trim();
					if (trimmed && trimmed !== block.title) onUpdate({ title: trimmed });
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter") (e.target as HTMLInputElement).blur();
				}}
				className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				placeholder="Block title"
			/>

			{/* Time range */}
			<div className="flex gap-2">
				<div className="flex flex-col gap-1 flex-1">
					<label htmlFor={`start-${block.id}`} className="text-[10px] text-slate-500">
						Start
					</label>
					<input
						id={`start-${block.id}`}
						type="time"
						value={startTime}
						onChange={(e) => setStartTime(e.target.value)}
						onBlur={() => {
							if (startTime !== block.startTime) onUpdate({ startTime });
						}}
						className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
				<div className="flex flex-col gap-1 flex-1">
					<label htmlFor={`end-${block.id}`} className="text-[10px] text-slate-500">
						End
					</label>
					<input
						id={`end-${block.id}`}
						type="time"
						value={endTime}
						onChange={(e) => setEndTime(e.target.value)}
						onBlur={() => {
							if (endTime !== block.endTime) onUpdate({ endTime });
						}}
						className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
			</div>

			{/* Color picker */}
			<div className="flex flex-col gap-1.5">
				<span className="text-[10px] text-slate-500">Color</span>
				<div className="flex flex-wrap gap-1.5">
					{COLOR_NAMES.map((c) => (
						<button
							key={c}
							type="button"
							title={c}
							onClick={() => onUpdate({ color: c })}
							className={cn(
								"h-5 w-5 rounded-full transition-transform hover:scale-110",
								COLOR_SWATCH[c],
								block.color === c && "ring-2 ring-white ring-offset-1 ring-offset-slate-900",
							)}
						/>
					))}
				</div>
			</div>

			{/* Doc links */}
			{block.docs.length > 0 && (
				<div className="flex flex-col gap-1.5">
					<span className="text-[10px] text-slate-500">Linked Docs</span>
					{block.docs.map((doc) => (
						<div key={doc.id} className="flex items-center gap-1.5 text-xs">
							<span className="flex-1 truncate text-slate-300">{doc.label}</span>
							<button
								type="button"
								onClick={() => onDeleteDoc(block.id, doc.id)}
								className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
							>
								<XIcon className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>
			)}

			{/* Add doc */}
			{addingDoc ? (
				<div className="flex flex-col gap-1.5">
					<span className="text-[10px] text-slate-500">Add Doc Link</span>
					<input
						type="text"
						placeholder="Label"
						value={docLabel}
						onChange={(e) => setDocLabel(e.target.value)}
						className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
					<input
						type="text"
						placeholder="URL or portal key"
						value={docUrl}
						onChange={(e) => setDocUrl(e.target.value)}
						className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
					<div className="flex gap-1.5">
						<select
							value={docType}
							onChange={(e) => setDocType(e.target.value)}
							className="rounded border border-slate-700 bg-slate-800 px-1.5 py-1 text-xs text-slate-200 focus:outline-none"
						>
							<option value="url">url</option>
							<option value="internal">internal</option>
							<option value="portal">portal</option>
							<option value="pdf">pdf</option>
						</select>
						<button
							type="button"
							onClick={async () => {
								if (!docLabel.trim() || !docUrl.trim()) return;
								await onAddDoc(block.id, docLabel.trim(), docUrl.trim(), docType);
								setDocLabel("");
								setDocUrl("");
								setDocType("url");
								setAddingDoc(false);
							}}
							className="flex-1 rounded border border-indigo-500/40 bg-indigo-500/20 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/30 transition-colors"
						>
							Save
						</button>
						<button
							type="button"
							onClick={() => setAddingDoc(false)}
							className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setAddingDoc(true)}
					className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
				>
					<PlusIcon className="h-3 w-3" />
					Add doc link
				</button>
			)}

			{/* Delete block */}
			<div className="border-t border-slate-800 pt-2">
				<button
					type="button"
					onClick={onDelete}
					className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors"
				>
					<Trash2Icon className="h-3.5 w-3.5" />
					Delete block
				</button>
			</div>

			{/* Close */}
			<Popover.Close asChild>
				<button
					type="button"
					onClick={onClose}
					className="absolute top-2 right-2 text-slate-600 hover:text-slate-300 transition-colors"
				>
					<XIcon className="h-3.5 w-3.5" />
				</button>
			</Popover.Close>
		</div>
	);
}

// ─── Overlap layout ───────────────────────────────────────────────────────────

function computeOverlapLayout(
	blocks: ScheduleBlockRow[],
): Map<string, { col: number; totalCols: number }> {
	const sorted = [...blocks].sort(
		(a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
	);
	const cols = new Map<string, number>();
	const colEnds: number[] = [];

	for (const block of sorted) {
		const startMin = timeToMinutes(block.startTime);
		const endMin = timeToMinutes(block.endTime);
		let col = colEnds.findIndex((e) => e <= startMin);
		if (col === -1) col = colEnds.length;
		colEnds[col] = endMin;
		cols.set(block.id, col);
	}

	const result = new Map<string, { col: number; totalCols: number }>();
	for (const block of sorted) {
		const bStart = timeToMinutes(block.startTime);
		const bEnd = timeToMinutes(block.endTime);
		const col = cols.get(block.id) ?? 0;
		let maxCol = col;
		for (const other of sorted) {
			if (other.id === block.id) continue;
			const oStart = timeToMinutes(other.startTime);
			const oEnd = timeToMinutes(other.endTime);
			if (oStart < bEnd && oEnd > bStart) maxCol = Math.max(maxCol, cols.get(other.id) ?? 0);
		}
		result.set(block.id, { col, totalCols: maxCol + 1 });
	}
	return result;
}

// ─── CalendarBlock ─────────────────────────────────────────────────────────────

function CalendarBlock({
	block,
	col,
	_totalCols,
	isEditing,
	onEdit,
	onEditClose,
	onResizeStart,
	isResizing,
	onUpdate,
	onDelete,
	onAddDoc,
	onDeleteDoc,
}: {
	block: ScheduleBlockRow;
	col: number;
	_totalCols: number;
	isEditing: boolean;
	onEdit: (block: ScheduleBlockRow) => void;
	onEditClose: () => void;
	onResizeStart: (block: ScheduleBlockRow, startY: number) => void;
	isResizing: boolean;
	onUpdate: (patch: Partial<ScheduleBlockRow>) => void;
	onDelete: () => void;
	onAddDoc: (blockId: string, label: string, url: string, linkType: string) => Promise<void>;
	onDeleteDoc: (blockId: string, docId: string) => Promise<void>;
}) {
	const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
		id: block.id,
		data: { block },
	});

	const top = minutesToPx(timeToMinutes(block.startTime));
	const height = minutesToPx(timeToMinutes(block.endTime)) - top;
	const colorClass = COLOR_BG[block.color] ?? COLOR_BG.blue;

	return (
		<Popover.Root open={isEditing} onOpenChange={(open) => !open && onEditClose()}>
			<Popover.Anchor asChild>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: role="button" is injected by dnd-kit */}
				<div
					ref={setNodeRef}
					{...attributes}
					{...listeners}
					style={{
						top: `${top}px`,
						height: `${Math.max(height, SLOT_HEIGHT)}px`,
						left: "2px",
						right: "2px",
						transform: CSS.Translate.toString(transform),
						touchAction: "none",
					}}
					className={cn(
						"absolute rounded-md select-none overflow-hidden group z-10 shadow-sm",
						colorClass,
						isDragging ? "opacity-30 cursor-grabbing z-50" : "cursor-grab",
					)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !isResizing) {
							e.stopPropagation();
							onEdit(block);
						}
					}}
					onClick={(e) => {
						if (isResizing) return;
						e.stopPropagation();
						onEdit(block);
					}}
				>
					<div
						className="px-1.5 text-[11px] font-semibold leading-tight truncate pointer-events-none"
						style={{ paddingTop: `${col * 14 + 4}px` }}
					>
						{block.title}
					</div>
					{height >= 48 && (
						<div className="px-1.5 text-[10px] opacity-60 tabular-nums pointer-events-none leading-tight">
							{block.startTime}–{block.endTime}
						</div>
					)}
					{/* Resize handle */}
					<div
						style={{ touchAction: "none" }}
						className="absolute bottom-0 inset-x-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
						onPointerDownCapture={(e) => {
							e.stopPropagation();
							e.currentTarget.setPointerCapture(e.pointerId);
							onResizeStart(block, e.clientY);
						}}
					>
						<div className="w-5 h-0.5 rounded-full bg-current opacity-40" />
					</div>
				</div>
			</Popover.Anchor>
			<Popover.Portal>
				<Popover.Content
					className="relative z-50 w-72 rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl flex flex-col gap-3"
					sideOffset={6}
					align="start"
					onInteractOutside={() => onEditClose()}
				>
					<BlockEditForm
						block={block}
						onUpdate={onUpdate}
						onDelete={onDelete}
						onAddDoc={onAddDoc}
						onDeleteDoc={onDeleteDoc}
						onClose={onEditClose}
					/>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}

// ─── DragGhost ────────────────────────────────────────────────────────────────

function DragGhost({ block }: { block: ScheduleBlockRow }) {
	const colorClass = COLOR_BG[block.color] ?? COLOR_BG.blue;
	return (
		<div
			className={cn(
				"rounded-md px-2 py-1 text-[11px] font-semibold shadow-2xl opacity-80 cursor-grabbing text-white",
				colorClass,
			)}
			style={{ width: "80px" }}
		>
			{block.title}
		</div>
	);
}

// ─── ScheduleCalendar ─────────────────────────────────────────────────────────

type ScheduleCalendarProps = {
	blocks: ScheduleBlockRow[];
	onBlocksChange: (blocks: ScheduleBlockRow[]) => void;
};

export function ScheduleCalendar({ blocks, onBlocksChange }: ScheduleCalendarProps) {
	const [localBlocks, setLocalBlocks] = useState<ScheduleBlockRow[]>(blocks);
	const [editingBlock, setEditingBlock] = useState<ScheduleBlockRow | null>(null);
	const [resizingId, setResizingId] = useState<string | null>(null);
	const [activeBlock, setActiveBlock] = useState<ScheduleBlockRow | null>(null);
	const localBlocksRef = useRef(localBlocks);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [nowMinutes, setNowMinutes] = useState(() => {
		const d = new Date();
		return d.getHours() * 60 + d.getMinutes();
	});
	const todayDow = new Date().getDay();

	useEffect(() => {
		localBlocksRef.current = localBlocks;
	}, [localBlocks]);

	// Sync when parent refetches (e.g. after proposed block confirmation)
	useEffect(() => {
		setLocalBlocks(blocks);
	}, [blocks]);

	// Current time indicator
	useEffect(() => {
		const t = setInterval(() => {
			const d = new Date();
			setNowMinutes(d.getHours() * 60 + d.getMinutes());
		}, 60_000);
		return () => clearInterval(t);
	}, []);

	// Auto-scroll to current time on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only scroll
	useEffect(() => {
		if (!scrollRef.current) return;
		const targetMins = Math.max(GRID_START, nowMinutes - 60);
		const scrollTop = minutesToPx(targetMins);
		scrollRef.current.scrollTop = scrollTop;
	}, []);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
	);

	// ── API helpers ────────────────────────────────────────────────────────────

	const commitUpdate = useCallback(async (blockId: string, patch: Partial<ScheduleBlockRow>) => {
		// Optimistic update
		setLocalBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
		setEditingBlock((prev) => (prev?.id === blockId ? { ...prev, ...patch } : prev));

		const res = await fetch(`/api/schedule/${blockId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(patch),
		});
		if (!res.ok) {
			toast.error("Failed to save change");
			return;
		}
		const json = await res.json();
		setLocalBlocks((prev) =>
			prev.map((b) => (b.id === blockId ? { ...json.block, docs: b.docs } : b)),
		);
	}, []);

	async function createBlock(dayOfWeek: number, slotIndex: number) {
		const startMins = GRID_START + slotIndex * 30;
		const endMins = Math.min(startMins + 60, GRID_END);
		const res = await fetch("/api/schedule", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "New Block",
				color: "blue",
				startTime: minutesToHhmm(startMins),
				endTime: minutesToHhmm(endMins),
				dayOfWeek,
			}),
		});
		if (!res.ok) {
			toast.error("Failed to create block");
			return;
		}
		const json = await res.json();
		const newBlock: ScheduleBlockRow = { ...json.block, docs: [] };
		const updated = [...localBlocksRef.current, newBlock];
		setLocalBlocks(updated);
		onBlocksChange(updated);
		setEditingBlock(newBlock);
	}

	async function deleteBlock(blockId: string) {
		setEditingBlock(null);
		setLocalBlocks((prev) => prev.filter((b) => b.id !== blockId));
		const res = await fetch(`/api/schedule/${blockId}`, { method: "DELETE" });
		if (!res.ok) toast.error("Failed to delete block");
	}

	const addDoc = useCallback(
		async (blockId: string, label: string, url: string, linkType: string) => {
			const res = await fetch(`/api/schedule/${blockId}/docs`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label, url, linkType }),
			});
			if (!res.ok) {
				toast.error("Failed to add doc link");
				return;
			}
			const json = await res.json();
			setLocalBlocks((prev) =>
				prev.map((b) =>
					b.id === blockId
						? { ...b, docs: [...b.docs, { id: json.doc.id, label, url, linkType }] }
						: b,
				),
			);
			setEditingBlock((prev) =>
				prev?.id === blockId
					? { ...prev, docs: [...prev.docs, { id: json.doc.id, label, url, linkType }] }
					: prev,
			);
		},
		[],
	);

	const deleteDoc = useCallback(async (blockId: string, docId: string) => {
		setLocalBlocks((prev) =>
			prev.map((b) =>
				b.id === blockId ? { ...b, docs: b.docs.filter((d) => d.id !== docId) } : b,
			),
		);
		setEditingBlock((prev) =>
			prev?.id === blockId ? { ...prev, docs: prev.docs.filter((d) => d.id !== docId) } : prev,
		);
		await fetch(`/api/schedule/${blockId}/docs/${docId}`, { method: "DELETE" });
	}, []);

	// ── Resize ─────────────────────────────────────────────────────────────────

	function handleResizeStart(block: ScheduleBlockRow, startY: number) {
		setResizingId(block.id);
		const startEndMinutes = timeToMinutes(block.endTime);
		const startStartMinutes = timeToMinutes(block.startTime);

		const onPointerMove = (e: PointerEvent) => {
			const deltaY = e.clientY - startY;
			const deltaMins = Math.round((deltaY / SLOT_HEIGHT) * 30);
			const newEndMins = Math.max(
				startStartMinutes + 30,
				Math.min(GRID_END, startEndMinutes + deltaMins),
			);
			setLocalBlocks((prev) =>
				prev.map((b) => (b.id === block.id ? { ...b, endTime: minutesToHhmm(newEndMins) } : b)),
			);
		};

		const onPointerUp = () => {
			setResizingId(null);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			const updated = localBlocksRef.current.find((b) => b.id === block.id);
			if (updated && updated.endTime !== block.endTime) {
				commitUpdate(block.id, { endTime: updated.endTime });
			}
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
	}

	// ── Drag ───────────────────────────────────────────────────────────────────

	function handleDragStart(event: {
		active: { data: { current?: { block?: ScheduleBlockRow } } };
	}) {
		const block = event.active.data.current?.block;
		if (block) setActiveBlock(block);
	}

	function handleDragEnd(event: DragEndEvent) {
		setActiveBlock(null);
		const overId = String(event.over?.id ?? "");
		if (!overId.startsWith("slot-")) return;
		const parts = overId.split("-");
		const dayOfWeek = Number(parts[1]);
		const slotIndex = Number(parts[2]);
		const block = event.active.data.current?.block as ScheduleBlockRow | undefined;
		if (!block) return;
		const duration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
		const newStart = GRID_START + slotIndex * 30;
		const newEnd = Math.min(newStart + duration, GRID_END);
		commitUpdate(block.id, {
			dayOfWeek,
			startTime: minutesToHhmm(newStart),
			endTime: minutesToHhmm(newEnd),
		});
	}

	// ── Render ─────────────────────────────────────────────────────────────────

	return (
		<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
			<div className="rounded-xl border border-slate-700/60 overflow-hidden bg-slate-950">
				{/* Day header row */}
				<div className="flex border-b border-slate-700/60 bg-slate-900">
					<div className="w-14 shrink-0" />
					{DAYS.map((d) => {
						const isToday = d.dayOfWeek === todayDow;
						return (
							<div
								key={d.dayOfWeek}
								className="flex-1 flex flex-col items-center py-2.5 border-l border-slate-700/40"
							>
								<span
									className={cn(
										"text-[10px] font-medium uppercase tracking-wider",
										isToday ? "text-red-400" : "text-slate-500",
									)}
								>
									{d.label}
								</span>
								{isToday ? (
									<span className="mt-0.5 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-[11px] font-bold text-white">
										{new Date().getDate()}
									</span>
								) : (
									<span className="mt-0.5 w-6 h-6 flex items-center justify-center text-[11px] text-slate-500">
										{new Date(
											new Date().setDate(new Date().getDate() - new Date().getDay() + d.dayOfWeek),
										).getDate()}
									</span>
								)}
							</div>
						);
					})}
				</div>

				{/* Grid body — scrollable */}
				<div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "560px" }}>
					<div className="relative flex" style={{ height: `${TOTAL_SLOTS * SLOT_HEIGHT}px` }}>
						{/* Hour grid lines — drawn behind everything */}
						<div className="absolute inset-0 pointer-events-none">
							{Array.from({ length: TOTAL_SLOTS + 1 }, (_, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: static grid lines
									key={i}
									className={cn(
										"absolute inset-x-0",
										i % 2 === 0 ? "border-t border-slate-700/50" : "border-t border-slate-800/40",
									)}
									style={{ top: `${i * SLOT_HEIGHT}px` }}
								/>
							))}
						</div>

						{/* Time gutter */}
						<div className="w-14 shrink-0 relative">
							{Array.from({ length: TOTAL_SLOTS + 1 }, (_, i) => {
								const mins = GRID_START + i * 30;
								if (mins % 60 !== 0) return null;
								const h = Math.floor(mins / 60);
								const label =
									h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
								return (
									<div
										key={mins}
										className="absolute right-2 text-[10px] text-slate-500 tabular-nums leading-none select-none"
										style={{ top: `${i * SLOT_HEIGHT - 6}px` }}
									>
										{label}
									</div>
								);
							})}

							{/* Now line — circle in gutter */}
							{nowMinutes >= GRID_START && nowMinutes <= GRID_END && (
								<div
									className="absolute right-0 z-30 pointer-events-none flex items-center"
									style={{ top: `${minutesToPx(nowMinutes) - 4}px` }}
								>
									<div className="w-2 h-2 rounded-full bg-red-500 ml-auto" />
								</div>
							)}
						</div>

						{/* Day columns */}
						{DAYS.map((d) => (
							<div
								key={d.dayOfWeek}
								className={cn(
									"flex-1 relative border-l border-slate-700/40 min-w-0",
									d.dayOfWeek === todayDow && "bg-slate-900/40",
								)}
							>
								{/* Drop targets / slot lines */}
								{Array.from({ length: TOTAL_SLOTS }, (_, i) => (
									<SlotDropTarget
										key={`slot-${d.dayOfWeek}-${i}`}
										dayOfWeek={d.dayOfWeek}
										slotIndex={i}
										onClick={() => createBlock(d.dayOfWeek, i)}
									/>
								))}

								{/* Calendar blocks */}
								{(() => {
									const dayBlocks = localBlocks.filter(
										(b) => b.dayOfWeek === d.dayOfWeek && b.specificDate === null,
									);
									const layout = computeOverlapLayout(dayBlocks);
									return dayBlocks.map((block) => {
										const current = editingBlock?.id === block.id ? editingBlock : block;
										const { col, totalCols } = layout.get(block.id) ?? { col: 0, totalCols: 1 };
										return (
											<CalendarBlock
												key={block.id}
												block={current}
												col={col}
												_totalCols={totalCols}
												isEditing={editingBlock?.id === block.id}
												onEdit={setEditingBlock}
												onEditClose={() => setEditingBlock(null)}
												onResizeStart={handleResizeStart}
												isResizing={resizingId === block.id}
												onUpdate={(patch) => commitUpdate(block.id, patch)}
												onDelete={() => deleteBlock(block.id)}
												onAddDoc={addDoc}
												onDeleteDoc={deleteDoc}
											/>
										);
									});
								})()}

								{/* Now line — full-width in all columns */}
								{nowMinutes >= GRID_START && nowMinutes <= GRID_END && (
									<div
										className="absolute inset-x-0 z-20 pointer-events-none"
										style={{ top: `${minutesToPx(nowMinutes)}px` }}
									>
										<div className="h-px bg-red-500" />
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Drag overlay ghost */}
			<DragOverlay dropAnimation={null}>
				{activeBlock ? <DragGhost block={activeBlock} /> : null}
			</DragOverlay>
		</DndContext>
	);
}
