"use client";

import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	TouchSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { PencilIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type GroupMember = {
	id: string;
	groupId: string;
	rosterId: string;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
};

type StudentGroup = {
	id: string;
	name: string;
	emoji: string;
	color: string;
	sortOrder: number;
	members: GroupMember[];
};

type RosterEntry = {
	id: string;
	studentId: string;
	firstName: string | null;
	firstInitial: string;
	lastInitial: string;
	isActive: boolean;
};

type Props = {
	classId: string;
	groups: StudentGroup[];
	allRoster: RosterEntry[];
	onGroupsChange: (groups: StudentGroup[]) => void;
	onRenameGroup: (groupId: string, name: string, emoji: string) => Promise<void>;
};

const GROUP_COLUMN_CLASSES: Record<string, string> = {
	amber: "border-amber-200 bg-amber-50/60",
	purple: "border-purple-200 bg-purple-50/60",
	sky: "border-sky-200 bg-sky-50/60",
	green: "border-green-200 bg-green-50/60",
	blue: "border-blue-200 bg-blue-50/60",
	pink: "border-pink-200 bg-pink-50/60",
	red: "border-red-200 bg-red-50/60",
};

const GROUP_BADGE_CLASSES: Record<string, string> = {
	amber: "bg-amber-100 text-amber-800",
	purple: "bg-purple-100 text-purple-800",
	sky: "bg-sky-100 text-sky-800",
	green: "bg-green-100 text-green-800",
	blue: "bg-blue-100 text-blue-800",
	pink: "bg-pink-100 text-pink-800",
	red: "bg-red-100 text-red-800",
};

// ─── Drag overlay pill (no dnd-kit hooks — pure display) ──────────────────────

function CardPill({
	badgeClass,
	displayLabel,
	className,
}: {
	badgeClass: string;
	displayLabel: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
				badgeClass,
				className,
			)}
		>
			{displayLabel}
		</div>
	);
}

// ─── Draggable Student Card ────────────────────────────────────────────────────

function DraggableCard({
	member,
	badgeClass,
	onRemove,
	label,
}: {
	member: { rosterId: string; firstInitial: string; lastInitial: string };
	badgeClass: string;
	onRemove?: () => void;
	label?: string;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: member.rosterId,
		data: { rosterId: member.rosterId },
	});

	const displayLabel = label ?? `${member.firstInitial}.${member.lastInitial}.`;

	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className={cn(
				"inline-flex items-center gap-0.5 rounded-full pl-2.5 pr-1 py-1 text-xs font-semibold select-none touch-none transition-opacity group/card cursor-grab",
				badgeClass,
				isDragging && "opacity-30",
			)}
		>
			<span>{displayLabel}</span>
			{onRemove && (
				<button
					type="button"
					onPointerDown={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					className="ml-0.5 opacity-0 group-hover/card:opacity-70 hover:!opacity-100 transition-opacity rounded-full cursor-pointer"
					title="Remove from group"
				>
					<XIcon className="h-3 w-3" />
				</button>
			)}
		</div>
	);
}

// ─── Droppable Group Column ────────────────────────────────────────────────────

function GroupColumn({
	group,
	isOver,
	activeRosterId,
	onRename,
	onRemoveMember,
}: {
	group: StudentGroup;
	isOver: boolean;
	activeRosterId: string | null;
	onRename: (groupId: string, name: string, emoji: string) => Promise<void>;
	onRemoveMember: (groupId: string, rosterId: string) => void;
}) {
	const isFull = group.members.length >= 6;
	const { setNodeRef } = useDroppable({ id: group.id });

	const [editingName, setEditingName] = useState(false);
	const [editingEmoji, setEditingEmoji] = useState(false);
	const [nameValue, setNameValue] = useState(group.name);
	const [emojiValue, setEmojiValue] = useState(group.emoji);
	const nameInputRef = useRef<HTMLInputElement>(null);
	const emojiInputRef = useRef<HTMLInputElement>(null);

	// Sync if parent updates
	useEffect(() => {
		setNameValue(group.name);
		setEmojiValue(group.emoji);
	}, [group.name, group.emoji]);

	async function commitRename(newName: string, newEmoji: string) {
		const trimmedName = newName.trim();
		const trimmedEmoji = newEmoji.trim();
		if (!trimmedName) return;
		if (trimmedName === group.name && trimmedEmoji === group.emoji) return;
		try {
			await onRename(group.id, trimmedName, trimmedEmoji);
		} catch {
			toast.error("Failed to rename group");
			setNameValue(group.name);
			setEmojiValue(group.emoji);
		}
	}

	const badgeClass = GROUP_BADGE_CLASSES[group.color] ?? "bg-muted text-muted-foreground";

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex flex-col gap-2 rounded-lg border p-3 min-h-[160px] transition-all",
				GROUP_COLUMN_CLASSES[group.color] ?? "border-border bg-card",
				isOver && !isFull && "ring-2 ring-primary/50 ring-offset-1",
				isFull && isOver && "ring-2 ring-destructive/50 ring-offset-1",
			)}
		>
			{/* Column header */}
			<div className="flex items-center gap-1.5">
				{/* Emoji inline edit */}
				{editingEmoji ? (
					<input
						ref={emojiInputRef}
						value={emojiValue}
						onChange={(e) => setEmojiValue(e.target.value)}
						onBlur={() => {
							setEditingEmoji(false);
							commitRename(nameValue, emojiValue);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								setEditingEmoji(false);
								commitRename(nameValue, emojiValue);
							}
							if (e.key === "Escape") {
								setEditingEmoji(false);
								setEmojiValue(group.emoji);
							}
						}}
						className="w-9 text-center text-lg bg-transparent border-b border-border focus:outline-none"
					/>
				) : (
					<button
						type="button"
						onClick={() => {
							setEditingEmoji(true);
							setTimeout(() => emojiInputRef.current?.select(), 0);
						}}
						className="text-lg hover:opacity-70 transition-opacity"
						title="Click to change emoji"
					>
						{emojiValue}
					</button>
				)}

				{/* Name inline edit */}
				{editingName ? (
					<input
						ref={nameInputRef}
						value={nameValue}
						onChange={(e) => setNameValue(e.target.value)}
						onBlur={() => {
							setEditingName(false);
							commitRename(nameValue, emojiValue);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								setEditingName(false);
								commitRename(nameValue, emojiValue);
							}
							if (e.key === "Escape") {
								setEditingName(false);
								setNameValue(group.name);
							}
						}}
						className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-b border-border focus:outline-none"
					/>
				) : (
					<button
						type="button"
						onClick={() => {
							setEditingName(true);
							setTimeout(() => nameInputRef.current?.select(), 0);
						}}
						className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary transition-colors group"
						title="Click to rename"
					>
						{nameValue}
						<PencilIcon className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
					</button>
				)}

				{/* Member count badge */}
				<span
					className={cn(
						"ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full",
						isFull ? "bg-destructive/15 text-destructive" : "text-muted-foreground",
					)}
				>
					{group.members.length}/6{isFull && " Full"}
				</span>
			</div>

			{/* Member cards */}
			<div className="flex flex-wrap gap-1.5 min-h-[40px]">
				{group.members.length === 0 ? (
					<p className="text-xs text-muted-foreground italic self-center w-full text-center">
						Drop students here
					</p>
				) : (
					group.members.map((member) => (
						<DraggableCard
							key={member.rosterId}
							member={member}
							badgeClass={badgeClass}
							onRemove={() => onRemoveMember(group.id, member.rosterId)}
						/>
					))
				)}
				{/* Drop target hint when dragging over a full group */}
				{isFull && activeRosterId && isOver && (
					<p className="text-xs text-destructive w-full text-center mt-1">Group is full</p>
				)}
			</div>
		</div>
	);
}

// ─── Unassigned Column ─────────────────────────────────────────────────────────

function studentName(s: RosterEntry): string {
	return s.firstName ?? `${s.firstInitial}.${s.lastInitial}.`;
}

function UnassignedColumn({ students }: { students: RosterEntry[] }) {
	const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 min-h-[160px] transition-all",
				isOver && "ring-2 ring-primary/40 ring-offset-1",
			)}
		>
			<div className="flex items-center gap-1.5">
				<span className="text-sm font-semibold text-muted-foreground">Unassigned</span>
				<span className="ml-auto text-xs text-muted-foreground">{students.length}</span>
			</div>
			<div className="flex flex-wrap gap-1.5 min-h-[40px]">
				{students.length === 0 ? (
					<p className="text-xs text-muted-foreground italic self-center w-full text-center">
						All students assigned
					</p>
				) : (
					students.map((s) => (
						<DraggableCard
							key={s.id}
							member={{ rosterId: s.id, firstInitial: s.firstInitial, lastInitial: s.lastInitial }}
							label={studentName(s)}
							badgeClass="bg-muted text-muted-foreground"
						/>
					))
				)}
			</div>
		</div>
	);
}

// ─── Main Kanban ───────────────────────────────────────────────────────────────

export function GroupsKanban({ classId, groups, allRoster, onGroupsChange, onRenameGroup }: Props) {
	const [localGroups, setLocalGroups] = useState<StudentGroup[]>(groups);
	const [activeRosterId, setActiveRosterId] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);

	// Sync when parent pushes new groups (e.g. after auto-assign)
	useEffect(() => {
		setLocalGroups(groups);
	}, [groups]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
	);

	// Students not in any group
	const unassigned = allRoster.filter(
		(s) => !localGroups.some((g) => g.members.some((m) => m.rosterId === s.id)),
	);

	// Find which group/column the active card is currently in
	const activeCard =
		activeRosterId != null
			? (() => {
					for (const g of localGroups) {
						const m = g.members.find((m) => m.rosterId === activeRosterId);
						if (m)
							return {
								member: m,
								groupColor: g.color,
								label: `${m.firstInitial}.${m.lastInitial}.`,
							};
					}
					const unassignedStudent = unassigned.find((s) => s.id === activeRosterId);
					if (unassignedStudent) {
						return {
							member: {
								rosterId: unassignedStudent.id,
								firstInitial: unassignedStudent.firstInitial,
								lastInitial: unassignedStudent.lastInitial,
							},
							groupColor: "muted",
							label:
								unassignedStudent.firstName ??
								`${unassignedStudent.firstInitial}.${unassignedStudent.lastInitial}.`,
						};
					}
					return null;
				})()
			: null;

	function handleDragStart(event: DragStartEvent) {
		setActiveRosterId(String(event.active.id));
	}

	function handleDragOver(event: DragOverEvent) {
		setOverId(event.over ? String(event.over.id) : null);
	}

	async function handleDragEnd(event: DragEndEvent) {
		setActiveRosterId(null);
		setOverId(null);

		const { active, over } = event;
		if (!over) return;

		const rosterId = String(active.id);
		const targetGroupId = String(over.id);

		// Dropping onto unassigned = remove from current group
		if (targetGroupId === "unassigned") {
			const currentGroup = localGroups.find((g) => g.members.some((m) => m.rosterId === rosterId));
			if (!currentGroup) return; // already unassigned
			await handleRemoveMember(currentGroup.id, rosterId);
			return;
		}

		// Find current group
		const currentGroup = localGroups.find((g) => g.members.some((m) => m.rosterId === rosterId));
		if (currentGroup?.id === targetGroupId) return; // no-op

		const targetGroup = localGroups.find((g) => g.id === targetGroupId);
		if (!targetGroup) return;

		// Check max-6 optimistically
		if (targetGroup.members.length >= 6) {
			toast.error("Group is full (max 6 students)");
			return;
		}

		// Build the member object to move
		let movingMember: GroupMember | undefined;
		let updatedGroups: StudentGroup[];

		if (currentGroup) {
			const found = currentGroup.members.find((m) => m.rosterId === rosterId);
			if (!found) return;
			movingMember = found;
			const captured = movingMember;
			// Move between groups
			updatedGroups = localGroups.map((g) => {
				if (g.id === currentGroup.id) {
					return { ...g, members: g.members.filter((m) => m.rosterId !== rosterId) };
				}
				if (g.id === targetGroupId) {
					return {
						...g,
						members: [...g.members, { ...captured, groupId: targetGroupId }],
					};
				}
				return g;
			});
		} else {
			// Moving from unassigned
			const unassignedStudent = unassigned.find((s) => s.id === rosterId);
			if (!unassignedStudent) return;
			const newMember: GroupMember = {
				id: rosterId,
				groupId: targetGroupId,
				rosterId,
				studentId: unassignedStudent.studentId,
				firstInitial: unassignedStudent.firstInitial,
				lastInitial: unassignedStudent.lastInitial,
			};
			movingMember = newMember;
			updatedGroups = localGroups.map((g) => {
				if (g.id === targetGroupId) {
					return { ...g, members: [...g.members, newMember] };
				}
				return g;
			});
		}

		// Optimistic update
		const prev = localGroups;
		setLocalGroups(updatedGroups);
		onGroupsChange(updatedGroups);

		try {
			const res = await fetch(`/api/classes/${classId}/groups/${targetGroupId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId }),
			});
			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Failed to move student");
			}
		} catch (err) {
			// Rollback
			setLocalGroups(prev);
			onGroupsChange(prev);
			toast.error(err instanceof Error ? err.message : "Failed to move student");
		}
	}

	async function handleRemoveMember(groupId: string, rosterId: string) {
		const prev = localGroups;
		const updated = localGroups.map((g) =>
			g.id === groupId ? { ...g, members: g.members.filter((m) => m.rosterId !== rosterId) } : g,
		);
		setLocalGroups(updated);
		onGroupsChange(updated);
		try {
			const res = await fetch(`/api/classes/${classId}/groups/${groupId}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId }),
			});
			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Failed to remove student");
			}
		} catch (err) {
			setLocalGroups(prev);
			onGroupsChange(prev);
			toast.error(err instanceof Error ? err.message : "Failed to remove student");
		}
	}

	async function handleRename(groupId: string, name: string, emoji: string) {
		await onRenameGroup(groupId, name, emoji);
		setLocalGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, name, emoji } : g)));
	}

	if (localGroups.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-border p-6 text-center">
				<p className="text-sm text-muted-foreground">
					No groups yet. Click "Auto-assign" to create groups and distribute students.
				</p>
			</div>
		);
	}

	return (
		<DndContext
			sensors={sensors}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
		>
			{/* Kanban columns — horizontal scroll on desktop, stacked on mobile */}
			<div className="flex flex-col gap-3 md:flex-row md:overflow-x-auto md:pb-2">
				{localGroups.map((group) => (
					<div key={group.id} className="md:min-w-[180px] md:flex-1">
						<GroupColumn
							group={group}
							isOver={overId === group.id}
							activeRosterId={activeRosterId}
							onRename={handleRename}
							onRemoveMember={handleRemoveMember}
						/>
					</div>
				))}
				{/* Unassigned column */}
				<div className="md:min-w-[160px] md:flex-1">
					<UnassignedColumn students={unassigned} />
				</div>
			</div>

			{/* Floating drag overlay */}
			<DragOverlay dropAnimation={null}>
				{activeCard ? (
					<CardPill
						badgeClass={
							GROUP_BADGE_CLASSES[activeCard.groupColor] ?? "bg-muted text-muted-foreground"
						}
						displayLabel={activeCard.label}
						className="shadow-lg cursor-grabbing"
					/>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
