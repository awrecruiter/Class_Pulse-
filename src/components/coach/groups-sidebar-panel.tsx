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
import { CoinsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";

interface MilestoneData {
	id: string;
	name: string;
	coinsRequired: number;
	sortOrder: number;
}

interface GroupData {
	id: string;
	name: string;
	emoji: string;
	color: string;
	balance: number;
	memberRosterIds: string[];
}

interface Props {
	classId: string;
}

// ── Color map ─────────────────────────────────────────────────────────────────
const colorMap: Record<string, { coin: string; progressColor: string; headerBorder: string }> = {
	red: { coin: "text-red-200", progressColor: "#f87171", headerBorder: "border-red-500/40" },
	blue: { coin: "text-blue-200", progressColor: "#60a5fa", headerBorder: "border-blue-500/40" },
	green: { coin: "text-green-200", progressColor: "#4ade80", headerBorder: "border-green-500/40" },
	yellow: {
		coin: "text-yellow-200",
		progressColor: "#facc15",
		headerBorder: "border-yellow-400/40",
	},
	purple: {
		coin: "text-purple-200",
		progressColor: "#c084fc",
		headerBorder: "border-purple-500/40",
	},
	orange: {
		coin: "text-orange-200",
		progressColor: "#fb923c",
		headerBorder: "border-orange-500/40",
	},
	pink: { coin: "text-pink-200", progressColor: "#f472b6", headerBorder: "border-pink-500/40" },
	teal: { coin: "text-teal-200", progressColor: "#2dd4bf", headerBorder: "border-teal-500/40" },
};
function cs(color: string) {
	return colorMap[color] ?? colorMap.blue;
}

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
function avatarBg(rosterId: string) {
	let h = 0;
	for (let i = 0; i < rosterId.length; i++) h = (h * 31 + rosterId.charCodeAt(i)) >>> 0;
	return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function chipLabel(s: StudentOverview) {
	if (s.firstName) return s.firstName;
	return `${s.firstInitial.toUpperCase()}.${s.lastInitial.toUpperCase()}.`;
}

// ── Draggable student chip ────────────────────────────────────────────────────
function DraggableChip({
	rosterId,
	displayName,
	initText,
	bgClass,
}: {
	rosterId: string;
	displayName: string;
	initText: string;
	bgClass: string;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: rosterId,
		data: { rosterId, displayName },
	});
	return (
		<div
			ref={setNodeRef}
			{...listeners}
			{...attributes}
			title={displayName}
			className={`rounded-full ${bgClass} px-2.5 py-1 text-xs font-semibold text-white cursor-grab active:cursor-grabbing select-none whitespace-nowrap`}
			style={{ opacity: isDragging ? 0.25 : 1, transition: "opacity 0.15s" }}
		>
			{initText}
		</div>
	);
}

// ── Group ledger card ─────────────────────────────────────────────────────────
function GroupCard({
	group,
	students,
	milestones,
}: {
	group: GroupData;
	students: StudentOverview[];
	milestones: MilestoneData[];
}) {
	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: group.id,
		data: { groupId: group.id, groupName: group.name },
	});

	const members = students.filter((s) => group.memberRosterIds.includes(s.rosterId));
	const sortedMs = [...milestones].sort((a, b) => a.coinsRequired - b.coinsRequired);
	const eligible =
		milestones.length > 0
			? milestones.every((m) => group.balance >= m.coinsRequired)
			: group.balance >= 100;

	// Progress bar: toward next unearned milestone
	const nextMs = sortedMs.find((m) => group.balance < m.coinsRequired);
	const prevMs = sortedMs.filter((m) => group.balance >= m.coinsRequired).at(-1);
	let pct = 100;
	if (nextMs) {
		const from = prevMs?.coinsRequired ?? 0;
		pct = Math.min(100, ((group.balance - from) / (nextMs.coinsRequired - from)) * 100);
	}

	const style = cs(group.color);

	// Balance pop animation on change
	const [pop, setPop] = useState(false);
	const [prevBal, setPrevBal] = useState(group.balance);
	useEffect(() => {
		if (group.balance !== prevBal) {
			setPop(true);
			setPrevBal(group.balance);
			const t = setTimeout(() => setPop(false), 600);
			return () => clearTimeout(t);
		}
	}, [group.balance, prevBal]);

	return (
		<div
			ref={setDropRef}
			className={`flex flex-col rounded-xl border bg-slate-800/90 transition-all ${
				isOver
					? "border-indigo-500 ring-2 ring-indigo-500/40"
					: eligible
						? `border-amber-500/50 ring-1 ring-amber-500/20 ${style.headerBorder}`
						: `border-slate-700/60 hover:border-slate-600/60`
			}`}
		>
			{/* Account header */}
			<div
				className={`flex items-center gap-2 px-3 py-2 border-b ${
					eligible ? "border-amber-500/30 bg-amber-500/5" : "border-slate-700/60"
				}`}
			>
				<span className="text-lg leading-none select-none">{group.emoji}</span>
				<span className="font-bold text-sm text-slate-100 flex-1 leading-none">{group.name}</span>
				{eligible && (
					<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide shrink-0">
						Eligible
					</span>
				)}
			</div>

			{/* Balance row — ledger style */}
			<div className="px-3 pt-2.5 pb-2">
				<p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-0.5">
					Coin Balance
				</p>
				<p
					className={`tabular-nums font-black text-xl leading-none ${style.coin}`}
					style={pop ? { animation: "coin-pop 0.5s ease" } : undefined}
				>
					{group.balance.toLocaleString()}
					<CoinsIcon className="inline h-4 w-4 text-yellow-400 ml-1.5" />
				</p>
			</div>

			{/* Progress bar */}
			{milestones.length > 0 && (
				<div className="px-3 pb-2.5">
					<div className="h-1 rounded-full bg-slate-700 overflow-hidden">
						<div
							className="h-full rounded-full transition-all duration-700"
							style={{
								width: `${pct}%`,
								background: eligible ? "#34d399" : style.progressColor,
							}}
						/>
					</div>
					{nextMs && (
						<p className="text-[9px] text-slate-600 mt-1">
							<span className="tabular-nums">
								{(nextMs.coinsRequired - group.balance).toLocaleString()}
							</span>{" "}
							to {nextMs.name}
						</p>
					)}
				</div>
			)}

			{/* Milestones — ledger rows */}
			{sortedMs.length > 0 && (
				<div className="px-3 pb-2 border-t border-slate-700/40 pt-2">
					<p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-1.5">
						Milestones
					</p>
					<div className="flex flex-col gap-0.5">
						{sortedMs.map((m) => {
							const lit = group.balance >= m.coinsRequired;
							return (
								<div
									key={m.id}
									className={`flex items-center gap-1.5 text-[11px] leading-snug ${
										lit ? "text-emerald-400" : "text-slate-600"
									}`}
								>
									<span className="shrink-0 w-3 text-center font-bold">{lit ? "✓" : "○"}</span>
									<span className="flex-1 truncate">{m.name}</span>
									<span className="tabular-nums text-slate-700 shrink-0 text-[10px]">
										{m.coinsRequired.toLocaleString()}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Members — drop zone */}
			<div className="px-3 py-2.5 border-t border-slate-700/40 flex-1">
				<p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-1.5">
					Members ({members.length})
				</p>
				<div className="flex flex-wrap gap-1.5 min-h-[28px]">
					{members.slice(0, 10).map((s) => (
						<DraggableChip
							key={s.rosterId}
							rosterId={s.rosterId}
							displayName={s.displayName}
							initText={chipLabel(s)}
							bgClass={avatarBg(s.rosterId)}
						/>
					))}
					{members.length === 0 && (
						<span className="text-[11px] text-slate-700 italic">Drop students here</span>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Unassigned drop zone ───────────────────────────────────────────────────────
function UnassignedDropZone({ unassigned }: { unassigned: StudentOverview[] }) {
	const { setNodeRef, isOver } = useDroppable({ id: "unassigned", data: { unassign: true } });
	return (
		<div className="px-4 pb-4 flex-1 flex flex-col min-h-0">
			<p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-1.5 shrink-0">
				Unassigned
			</p>
			<div
				ref={setNodeRef}
				className={`flex-1 min-h-[48px] overflow-y-auto rounded-lg border-2 border-dashed transition-colors flex flex-wrap gap-1.5 p-2 content-start ${
					isOver ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700/50"
				}`}
			>
				{unassigned.map((s) => (
					<DraggableChip
						key={s.rosterId}
						rosterId={s.rosterId}
						displayName={s.displayName}
						initText={chipLabel(s)}
						bgClass={avatarBg(s.rosterId)}
					/>
				))}
				{unassigned.length === 0 && (
					<span className="text-[11px] text-slate-600 italic">Drag here to unassign</span>
				)}
			</div>
		</div>
	);
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function GroupsSidebarPanel({ classId }: Props) {
	const [groups, setGroups] = useState<GroupData[]>([]);
	const [milestones, setMilestones] = useState<MilestoneData[]>([]);
	const [students, setStudents] = useState<StudentOverview[]>([]);
	const [loading, setLoading] = useState(true);
	const [draggingStudent, setDraggingStudent] = useState<{
		rosterId: string;
		displayName: string;
	} | null>(null);
	const autoCreatedClassRef = useRef<string>("");

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

	// Re-fetch when voice command assigns a student — silently (no loading flash)
	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchData is stable
	useEffect(() => {
		if (!classId) return;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const handler = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => fetchData(classId, true), 400);
		};
		window.addEventListener("group-assignment-changed", handler);
		return () => {
			if (timer) clearTimeout(timer);
			window.removeEventListener("group-assignment-changed", handler);
		};
	}, [classId]);

	async function handleDragEnd(event: DragEndEvent) {
		setDraggingStudent(null);
		const { active, over } = event;
		if (!over || !classId) return;
		const rosterId = active.id as string;

		if (over.data.current?.unassign) {
			const currentGroup = groups.find((g) => g.memberRosterIds.includes(rosterId));
			if (!currentGroup) return;
			const studentName = students.find((s) => s.rosterId === rosterId)?.displayName ?? rosterId;
			setGroups((prev) =>
				prev.map((g) => ({
					...g,
					memberRosterIds: g.memberRosterIds.filter((r) => r !== rosterId),
				})),
			);
			try {
				const res = await fetch(`/api/classes/${classId}/groups/${currentGroup.id}`, {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ rosterId }),
				});
				if (!res.ok) throw new Error("Failed");
				toast.success(`Removed ${studentName} from ${currentGroup.name}`);
			} catch {
				toast.error("Remove failed");
				fetchData(classId);
			}
			return;
		}

		const targetGroupId = over.data.current?.groupId as string;
		if (!targetGroupId) return;
		const currentGroup = groups.find((g) => g.memberRosterIds.includes(rosterId));
		if (currentGroup?.id === targetGroupId) return;
		setGroups((prev) =>
			prev.map((g) => {
				if (g.id === targetGroupId)
					return { ...g, memberRosterIds: [...g.memberRosterIds, rosterId] };
				return { ...g, memberRosterIds: g.memberRosterIds.filter((r) => r !== rosterId) };
			}),
		);
		const studentName = students.find((s) => s.rosterId === rosterId)?.displayName ?? rosterId;
		const targetGroup = groups.find((g) => g.id === targetGroupId);
		try {
			const res = await fetch(`/api/classes/${classId}/groups/${targetGroupId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId }),
			});
			if (!res.ok) throw new Error("Failed");
			toast.success(`Moved ${studentName} → ${targetGroup?.name ?? ""}`);
		} catch {
			toast.error("Move failed");
			fetchData(classId);
		}
	}

	const fetchData = (id: string, silent = false) => {
		if (!silent) setLoading(true);
		const safeGroups = fetch(`/api/classes/${id}/groups`)
			.then((r) => (r.ok ? r.json() : { groups: [] }))
			.catch(() => ({ groups: [] }));
		const safeAccounts = fetch(`/api/classes/${id}/group-accounts`)
			.then((r) => (r.ok ? r.json() : { groups: [] }))
			.catch(() => ({ groups: [] }));
		const safeMilestones = fetch(`/api/classes/${id}/group-milestones`)
			.then((r) => (r.ok ? r.json() : { milestones: [] }))
			.catch(() => ({ milestones: [] }));
		const safeRoster = fetch(`/api/classes/${id}/roster-overview`)
			.then((r) => (r.ok ? r.json() : { students: [] }))
			.catch(() => ({ students: [] }));
		Promise.all([safeGroups, safeAccounts, safeMilestones, safeRoster])
			.then(([groupsJson, accountsJson, milestonesJson, rosterJson]) => {
				type RawGroup = {
					id: string;
					name: string;
					emoji: string;
					color: string;
					members: { rosterId: string }[];
				};
				const groupsData: RawGroup[] = groupsJson.groups ?? [];

				if (silent && groupsData.length === 0) return;

				if (groupsData.length === 0 && autoCreatedClassRef.current !== id) {
					autoCreatedClassRef.current = id;
					fetch(`/api/classes/${id}/groups`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action: "create-groups" }),
					})
						.then(() => fetchData(id))
						.catch(() => setLoading(false));
					return;
				}

				const accounts: Record<string, number> = {};
				for (const a of accountsJson.groups ?? []) accounts[a.groupId] = a.balance ?? 0;
				setGroups(
					groupsData.map((g) => ({
						id: g.id,
						name: g.name,
						emoji: g.emoji,
						color: g.color ?? "blue",
						balance: accounts[g.id] ?? 0,
						memberRosterIds: (g.members ?? []).map((m: { rosterId: string }) => m.rosterId),
					})),
				);
				setMilestones(
					(milestonesJson.milestones ?? []).map(
						(m: { id: string; name: string; coinsRequired: number; sortOrder: number }) => ({
							id: m.id,
							name: m.name,
							coinsRequired: m.coinsRequired,
							sortOrder: m.sortOrder,
						}),
					),
				);
				setStudents(rosterJson.students ?? []);
			})
			.finally(() => setLoading(false));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchData is stable, classId is the trigger
	useEffect(() => {
		if (!classId) return;
		fetchData(classId);
	}, [classId]);

	if (loading)
		return (
			<div className="flex justify-center py-4">
				<span className="text-sm text-slate-500">Loading groups…</span>
			</div>
		);
	if (groups.length === 0)
		return (
			<div className="flex justify-center py-4">
				<span className="text-sm text-slate-500">Setting up groups…</span>
			</div>
		);

	const allGroupedIds = new Set(groups.flatMap((g) => g.memberRosterIds));
	const unassigned = students.filter((s) => !allGroupedIds.has(s.rosterId));

	return (
		<DndContext
			sensors={sensors}
			onDragStart={(e) => {
				const s = students.find((st) => st.rosterId === e.active.id);
				if (s) setDraggingStudent({ rosterId: s.rosterId, displayName: s.displayName });
			}}
			onDragEnd={handleDragEnd}
			onDragCancel={() => setDraggingStudent(null)}
		>
			<div className="flex flex-col min-h-full">
				<div className="px-4 py-3 shrink-0">
					<div className="grid grid-cols-2 gap-3">
						{groups.map((g) => (
							<GroupCard key={g.id} group={g} students={students} milestones={milestones} />
						))}
					</div>
				</div>
				<UnassignedDropZone unassigned={unassigned} />
			</div>
			<DragOverlay dropAnimation={null}>
				{draggingStudent ? (
					<div
						className={`rounded-full ${avatarBg(draggingStudent.rosterId)} flex items-center justify-center shadow-lg ring-2 ring-white/40 px-2.5 py-1`}
						style={{ cursor: "grabbing" }}
					>
						<span className="text-xs font-bold text-white leading-none pointer-events-none">
							{draggingStudent.displayName.slice(0, 2).toUpperCase()}
						</span>
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
