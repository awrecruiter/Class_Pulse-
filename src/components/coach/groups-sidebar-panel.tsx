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
import { CoinsIcon, StarIcon } from "lucide-react";
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

// ── Layout constants ──────────────────────────────────────────────────────────
const CIRCLE_PX = 200;
const RING_R = CIRCLE_PX / 2 + 2; // 102 — SVG ring radius (flush with circle edge)
const CHIP_PX = 28; // student chip diameter (floats inside)
const INNER_WALL_R = CIRCLE_PX / 2 - CHIP_PX / 2 - 5; // 81 — max chip center from circle center
const CENTER_R = 52; // exclusion zone radius (protects center text)
const MS_CHIP = 14; // milestone coin chip diameter on ring
const SCENE_PX = (RING_R + MS_CHIP / 2 + 10) * 2; // 256 — scene square side

// ── Color map ─────────────────────────────────────────────────────────────────
const colorMap: Record<string, { coin: string; circleBg: string; progressColor: string }> = {
	red: { coin: "text-red-200", circleBg: "bg-red-600/30", progressColor: "#f87171" },
	blue: { coin: "text-blue-100", circleBg: "bg-blue-600/30", progressColor: "#60a5fa" },
	green: { coin: "text-green-100", circleBg: "bg-green-600/30", progressColor: "#4ade80" },
	yellow: { coin: "text-yellow-100", circleBg: "bg-yellow-500/30", progressColor: "#facc15" },
	purple: { coin: "text-purple-100", circleBg: "bg-purple-600/30", progressColor: "#c084fc" },
	orange: { coin: "text-orange-100", circleBg: "bg-orange-600/30", progressColor: "#fb923c" },
	pink: { coin: "text-pink-100", circleBg: "bg-pink-600/30", progressColor: "#f472b6" },
	teal: { coin: "text-teal-100", circleBg: "bg-teal-600/30", progressColor: "#2dd4bf" },
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
function initials(s: StudentOverview) {
	return ((s.firstName ? s.firstName[0] : s.firstInitial) + s.lastInitial).toUpperCase();
}
// ── Coin display (balance in circle center) ───────────────────────────────────
function CoinDisplay({ balance, color }: { balance: number; color: string }) {
	const [pop, setPop] = useState(false);
	const [prev, setPrev] = useState(balance);
	useEffect(() => {
		if (balance !== prev) {
			setPop(true);
			setPrev(balance);
			const t = setTimeout(() => setPop(false), 600);
			return () => clearTimeout(t);
		}
	}, [balance, prev]);
	return (
		<span
			className={`inline-flex items-center gap-1 tabular-nums font-black text-sm leading-none ${cs(color).coin}`}
			style={pop ? { animation: "coin-pop 0.5s ease" } : undefined}
		>
			{balance.toLocaleString()}
		</span>
	);
}

// ── Progress ring SVG with milestone coins ────────────────────────────────────
function ProgressRingWithMilestones({
	balance,
	color,
	eligible,
	milestones,
	onCoinClick,
	editingId,
}: {
	balance: number;
	color: string;
	eligible: boolean;
	milestones: MilestoneData[];
	onCoinClick: (id: string) => void;
	editingId: string | null;
}) {
	const r = RING_R;
	const svgSize = SCENE_PX;
	const cx = svgSize / 2;
	const cy = svgSize / 2;
	const circumference = 2 * Math.PI * r;

	const maxCost = milestones.length > 0 ? Math.max(...milestones.map((m) => m.coinsRequired)) : 100;
	const pct = Math.min(1, balance / maxCost);
	const style = cs(color);
	const stroke = eligible ? "#34d399" : style.progressColor;

	return (
		<svg
			className="absolute pointer-events-none"
			style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 5 }}
			width={svgSize}
			height={svgSize}
			aria-hidden="true"
		>
			{/* Track */}
			<circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
			{/* Fill */}
			<circle
				cx={cx}
				cy={cy}
				r={r}
				fill="none"
				stroke={stroke}
				strokeWidth={4}
				strokeLinecap="round"
				strokeDasharray={circumference}
				strokeDashoffset={circumference * (1 - pct)}
				transform={`rotate(-90 ${cx} ${cy})`}
				style={{ transition: "stroke-dashoffset 0.7s ease" }}
			/>
			{/* Milestone coins — rendered as foreignObject buttons to keep pointer events */}
			{milestones.map((m, idx) => {
				const angle =
					milestones.length > 1
						? (idx / milestones.length) * 2 * Math.PI - Math.PI / 2
						: -Math.PI / 2;
				const mx = cx + r * Math.cos(angle);
				const my = cy + r * Math.sin(angle);
				const lit = balance >= m.coinsRequired;
				const isEditing = editingId === m.id;
				return (
					<foreignObject
						key={m.id}
						x={mx - MS_CHIP / 2}
						y={my - MS_CHIP / 2}
						width={MS_CHIP}
						height={MS_CHIP}
						style={{ pointerEvents: "auto", overflow: "visible" }}
					>
						<button
							type="button"
							onClick={() => onCoinClick(m.id)}
							title={`${m.name} — ${m.coinsRequired.toLocaleString()} coins`}
							style={{
								width: MS_CHIP,
								height: MS_CHIP,
								borderRadius: "50%",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								border: isEditing
									? "2px solid #fbbf24"
									: lit
										? "1.5px solid rgba(251,191,36,0.7)"
										: "1.5px solid rgba(148,163,184,0.3)",
								background: lit
									? "radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 60%, #b45309)"
									: "rgba(30,41,59,0.75)",
								boxShadow: lit ? "0 0 6px 2px rgba(251,191,36,0.5)" : "none",
								cursor: "pointer",
							}}
						/>
					</foreignObject>
				);
			})}
		</svg>
	);
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

// ── Group card with floating students inside circle ───────────────────────────
function GroupCard({
	group,
	students,
	milestones,
}: {
	group: GroupData;
	students: StudentOverview[];
	milestones: MilestoneData[];
}) {
	// Make group circle a drop target
	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: group.id,
		data: { groupId: group.id, groupName: group.name },
	});
	const members = students.filter((s) => group.memberRosterIds.includes(s.rosterId)).slice(0, 8);
	const eligible =
		milestones.length > 0
			? milestones.every((m) => group.balance >= m.coinsRequired)
			: group.balance >= 100;
	const style = cs(group.color);

	const chipRefs = useRef<Array<HTMLDivElement | null>>([]);
	const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
	const selectedCoin = milestones.find((m) => m.id === selectedCoinId);

	return (
		<div className="shrink-0 flex flex-col items-center gap-2">
			{/* Scene */}
			<div
				className="relative flex items-center justify-center"
				style={{ width: SCENE_PX, height: SCENE_PX }}
			>
				{/* Student chips — physics-animated, draggable */}
				{members.map((s, i) => {
					const angle = (i / Math.max(members.length, 1)) * 2 * Math.PI - Math.PI / 2;
					const rInit =
						CENTER_R +
						CHIP_PX / 2 +
						4 +
						(INNER_WALL_R - CENTER_R - CHIP_PX / 2 - 4) * ((i % 3) / 3);
					const initX = Math.cos(angle) * rInit;
					const initY = Math.sin(angle) * rInit;
					return (
						<div
							key={s.rosterId}
							ref={(el) => {
								chipRefs.current[i] = el;
							}}
							className="absolute"
							style={{
								top: "50%",
								left: "50%",
								transform: `translate(calc(-50% + ${initX}px), calc(-50% + ${initY}px))`,
								zIndex: 20,
							}}
						>
							<DraggableChip
								rosterId={s.rosterId}
								displayName={s.displayName}
								initText={initials(s)}
								bgClass={avatarBg(s.rosterId)}
							/>
						</div>
					);
				})}

				{/* Progress ring + privilege coins */}
				<ProgressRingWithMilestones
					balance={group.balance}
					color={group.color}
					eligible={eligible}
					milestones={milestones}
					onCoinClick={(id) => setSelectedCoinId((prev) => (prev === id ? null : id))}
					editingId={selectedCoinId}
				/>

				{/* Group circle — droppable; gold glow when eligible */}
				<div
					ref={setDropRef}
					className={`rounded-full flex items-center justify-center ${eligible ? "bg-amber-500/25" : isOver ? "bg-white/10" : style.circleBg}`}
					style={{
						width: CIRCLE_PX,
						height: CIRCLE_PX,
						position: "relative",
						zIndex: 10,
						boxShadow: eligible
							? "0 0 20px 6px rgba(251,191,36,0.25), inset 0 0 16px rgba(251,191,36,0.1)"
							: isOver
								? "0 0 0 3px rgba(99,102,241,0.7)"
								: undefined,
						border: eligible
							? "1.5px solid rgba(251,191,36,0.5)"
							: isOver
								? "1.5px solid rgba(99,102,241,0.8)"
								: undefined,
						transition: "box-shadow 0.15s, border 0.15s",
					}}
				>
					<div className="flex flex-col items-center gap-1 px-4">
						<span className="text-4xl leading-none select-none">{group.emoji}</span>
						<span className="text-base font-bold text-white leading-tight text-center">
							{group.name}
						</span>
						<CoinDisplay balance={group.balance} color={group.color} />
					</div>
				</div>
			</div>

			{/* Eligible badge */}
			{eligible && (
				<span
					className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
					style={{ animation: "badge-glow 2s ease-in-out infinite" }}
				>
					<StarIcon className="h-3 w-3" style={{ animation: "sparkle-spin 3s linear infinite" }} />
					Eligible!
				</span>
			)}

			{/* Privilege coin tooltip */}
			{selectedCoin && (
				<div className="w-full max-w-[200px] rounded-lg bg-slate-800/90 border border-slate-700/60 px-3 py-2 flex flex-col gap-1">
					<p className="text-xs font-semibold text-slate-200 leading-tight truncate">
						{selectedCoin.name}
					</p>
					<p className="text-[11px] text-slate-400 flex items-center gap-1">
						<CoinsIcon className="h-3 w-3 text-amber-400" />
						{selectedCoin.coinsRequired.toLocaleString()} coins to unlock
					</p>
				</div>
			)}
		</div>
	);
}

export function GroupsSidebarPanel({ classId }: Props) {
	const [groups, setGroups] = useState<GroupData[]>([]);
	const [milestones, setMilestones] = useState<MilestoneData[]>([]);
	const [students, setStudents] = useState<StudentOverview[]>([]);
	const [loading, setLoading] = useState(true);
	const [draggingStudent, setDraggingStudent] = useState<{
		rosterId: string;
		displayName: string;
	} | null>(null);
	const [scale, setScale] = useState(1);
	const containerRef = useRef<HTMLDivElement>(null);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

	// Auto-scale groups row to always fit available width (no horizontal scroll)
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const ro = new ResizeObserver(([entry]) => {
			const w = entry.contentRect.width;
			const n = groups.length || 1;
			const GAP = 16;
			const PAD = 48;
			const totalW = n * SCENE_PX + (n - 1) * GAP + PAD;
			setScale(Math.min(1, w / totalW));
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [groups.length]);

	// Re-fetch when voice command assigns a student to a group
	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchData is stable, classId is the trigger
	useEffect(() => {
		if (!classId) return;
		const handler = () => fetchData(classId);
		window.addEventListener("group-assignment-changed", handler);
		return () => window.removeEventListener("group-assignment-changed", handler);
	}, [classId]);

	async function handleDragEnd(event: DragEndEvent) {
		setDraggingStudent(null);
		const { active, over } = event;
		if (!over || !classId) return;
		const rosterId = active.id as string;
		const targetGroupId = over.data.current?.groupId as string;
		if (!targetGroupId) return;
		// Skip if already in this group
		const currentGroup = groups.find((g) => g.memberRosterIds.includes(rosterId));
		if (currentGroup?.id === targetGroupId) return;
		// Optimistic update
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
			fetchData(classId); // revert
		}
	}

	const fetchData = (id: string) => {
		setLoading(true);
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
				const accounts: Record<string, number> = {};
				for (const a of accountsJson.groups ?? []) accounts[a.groupId] = a.balance ?? 0;
				setGroups(
					(groupsJson.groups ?? []).map(
						(g: {
							id: string;
							name: string;
							emoji: string;
							color: string;
							members: { rosterId: string }[];
						}) => ({
							id: g.id,
							name: g.name,
							emoji: g.emoji,
							color: g.color ?? "blue",
							balance: accounts[g.id] ?? 0,
							memberRosterIds: (g.members ?? []).map((m: { rosterId: string }) => m.rosterId),
						}),
					),
				);
				// Group milestones — activities unlocked by coin balance
				const mapped: MilestoneData[] = (milestonesJson.milestones ?? []).map(
					(m: { id: string; name: string; coinsRequired: number; sortOrder: number }) => ({
						id: m.id,
						name: m.name,
						coinsRequired: m.coinsRequired,
						sortOrder: m.sortOrder,
					}),
				);
				setMilestones(mapped);
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
			<div className="flex flex-col items-center gap-3 py-4 px-4">
				{students.length > 0 && (
					<p className="text-xs text-slate-400 text-center">
						{students.length} student{students.length !== 1 ? "s" : ""} — no groups yet
					</p>
				)}
				<button
					type="button"
					onClick={() => {
						if (!classId) return;
						setLoading(true);
						fetch(`/api/classes/${classId}/groups`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ action: "create-groups" }),
						})
							.then(() => fetchData(classId))
							.catch(() => setLoading(false));
					}}
					className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
				>
					Set up groups
				</button>
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
			<div ref={containerRef} className="w-full overflow-hidden px-6 py-4">
				<div
					className="flex justify-center gap-4"
					style={{
						transform: `scale(${scale})`,
						transformOrigin: "top center",
						...(scale < 1 ? { marginBottom: `${SCENE_PX * scale - SCENE_PX + 8}px` } : {}),
					}}
				>
					{groups.map((g) => (
						<GroupCard key={g.id} group={g} students={students} milestones={milestones} />
					))}
				</div>
			</div>
			{/* Unassigned students — drag them into a group circle */}
			{unassigned.length > 0 && (
				<div className="px-6 pb-4">
					<p className="text-[11px] text-slate-500 mb-2 font-medium uppercase tracking-wide">
						Unassigned
					</p>
					<div className="flex flex-wrap gap-2">
						{unassigned.map((s) => (
							<DraggableChip
								key={s.rosterId}
								rosterId={s.rosterId}
								displayName={s.displayName}
								initText={initials(s)}
								bgClass={avatarBg(s.rosterId)}
							/>
						))}
					</div>
				</div>
			)}
			<DragOverlay dropAnimation={null}>
				{draggingStudent ? (
					<div
						className={`rounded-full ${avatarBg(draggingStudent.rosterId)} flex items-center justify-center shadow-lg ring-2 ring-white/40`}
						style={{ width: CHIP_PX, height: CHIP_PX, cursor: "grabbing" }}
					>
						<span className="text-[10px] font-bold text-white leading-none pointer-events-none">
							{draggingStudent.displayName.slice(0, 2).toUpperCase()}
						</span>
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
