"use client";

import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { PlusIcon, TrophyIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";
import type { DiVoiceAction } from "@/app/api/coach/di-voice/route";
import { RamBuckBurst } from "@/components/coach/ram-buck-burst";
import { readBooleanPreference, VOICE_DEBUG_FEEDBACK_ENABLED_KEY } from "@/lib/ui-prefs";

// ─── Listen badge ────────────────────────────────────────────────────────────

function ListenBadge({ state }: { state: "on" | "off" | "processing" }) {
	if (state === "off") return null;
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
				state === "processing"
					? "bg-amber-500/20 text-amber-300"
					: "bg-emerald-500/15 text-emerald-400"
			}`}
		>
			<span
				className={`w-1.5 h-1.5 rounded-full ${
					state === "processing" ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
				}`}
			/>
			{state === "processing" ? "thinking…" : "listening"}
		</span>
	);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DiGroup = {
	id: string;
	name: string;
	color: string;
	points: number;
	memberRosterIds: string[];
};

type DiSession = {
	id: string;
	label: string;
	status: "active" | "ended";
	rewardAmount: number;
	groups: DiGroup[];
};

export interface DiPanelProps {
	classId: string;
	students: StudentOverview[];
	onSessionEnd: () => void;
	/** Coach page passes a ref here; DiPanel sets it to dispatchVoiceCommand so the global mic can route DI commands */
	dispatchRef?: React.MutableRefObject<((transcript: string) => void) | null>;
	/** Called with true when an active session exists, false when all sessions are ended/cleared */
	onActiveSessionChange?: (active: boolean) => void;
}

// ─── Color map ────────────────────────────────────────────────────────────────

const DI_COLORS: Record<
	string,
	{ bg: string; header: string; ring: string; text: string; badge: string; dropActive: string }
> = {
	red: {
		bg: "bg-red-950/40",
		header: "bg-red-600",
		ring: "ring-red-500",
		text: "text-red-300",
		badge: "bg-red-500/20 text-red-200",
		dropActive: "ring-2 ring-red-400 bg-red-950/60",
	},
	blue: {
		bg: "bg-blue-950/40",
		header: "bg-blue-600",
		ring: "ring-blue-500",
		text: "text-blue-300",
		badge: "bg-blue-500/20 text-blue-200",
		dropActive: "ring-2 ring-blue-400 bg-blue-950/60",
	},
	green: {
		bg: "bg-emerald-950/40",
		header: "bg-emerald-600",
		ring: "ring-emerald-500",
		text: "text-emerald-300",
		badge: "bg-emerald-500/20 text-emerald-200",
		dropActive: "ring-2 ring-emerald-400 bg-emerald-950/60",
	},
	yellow: {
		bg: "bg-amber-950/40",
		header: "bg-amber-500",
		ring: "ring-amber-400",
		text: "text-amber-300",
		badge: "bg-amber-500/20 text-amber-200",
		dropActive: "ring-2 ring-amber-300 bg-amber-950/60",
	},
	orange: {
		bg: "bg-orange-950/40",
		header: "bg-orange-600",
		ring: "ring-orange-500",
		text: "text-orange-300",
		badge: "bg-orange-500/20 text-orange-200",
		dropActive: "ring-2 ring-orange-400 bg-orange-950/60",
	},
	purple: {
		bg: "bg-violet-950/40",
		header: "bg-violet-600",
		ring: "ring-violet-500",
		text: "text-violet-300",
		badge: "bg-violet-500/20 text-violet-200",
		dropActive: "ring-2 ring-violet-400 bg-violet-950/60",
	},
};

const COLOR_ORDER = ["red", "blue", "green", "yellow", "orange", "purple"];

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_COLORS_DI = [
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
];

function hashId(id: string) {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return h;
}

const avatarColorDi = (id: string) => AVATAR_COLORS_DI[hashId(id) % AVATAR_COLORS_DI.length];

function studentInitialsDi(s: {
	firstName: string | null;
	firstInitial: string;
	lastInitial: string;
}): string {
	return (s.firstName?.[0] ?? s.firstInitial).toUpperCase() + s.lastInitial.toUpperCase();
}

function colorStyle(color: string) {
	return DI_COLORS[color] ?? DI_COLORS.blue;
}

// ─── Draggable student chip ───────────────────────────────────────────────────

function DraggableChip({
	rosterId,
	student,
	groupId,
	onRemove,
	size = "md",
}: {
	rosterId: string;
	student: StudentOverview;
	groupId: string;
	onRemove: () => void;
	size?: "sm" | "md";
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `${groupId}::${rosterId}`,
		data: { rosterId, fromGroupId: groupId },
	});

	return (
		<div
			ref={setNodeRef}
			{...listeners}
			{...attributes}
			className={`relative flex flex-col items-center justify-center gap-0.5 rounded-md bg-slate-800/60 border border-slate-700 cursor-grab active:cursor-grabbing transition-opacity touch-none shrink-0 ${size === "sm" ? "w-14 h-14" : "w-[60px] h-[60px]"} ${isDragging ? "opacity-30" : ""}`}
		>
			<div
				className={`${size === "sm" ? "h-7 w-7" : "h-8 w-8"} rounded-md ${avatarColorDi(rosterId)} flex items-center justify-center shrink-0`}
			>
				<span className="text-[10px] font-bold leading-none text-white/90">
					{studentInitialsDi(student)}
				</span>
			</div>
			<span className="text-[9px] text-slate-200 leading-tight text-center truncate w-full px-0.5">
				{student.displayName}
			</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				onPointerDown={(e) => e.stopPropagation()}
				className="absolute top-0.5 right-0.5 text-slate-500 hover:text-slate-300 transition-colors"
			>
				<XIcon className="h-2.5 w-2.5" />
			</button>
		</div>
	);
}

// Ghost chip shown in DragOverlay
function GhostChip({ student, rosterId }: { student: StudentOverview; rosterId: string }) {
	return (
		<div className="relative flex flex-col items-center justify-center gap-0.5 rounded-md bg-slate-700 border border-slate-500 w-[60px] h-[60px] shadow-xl opacity-90">
			<div
				className={`h-8 w-8 rounded-md ${avatarColorDi(rosterId)} flex items-center justify-center shrink-0`}
			>
				<span className="text-[10px] font-bold leading-none text-white/90">
					{studentInitialsDi(student)}
				</span>
			</div>
			<span className="text-[9px] text-slate-200 leading-tight text-center truncate w-full px-0.5">
				{student.displayName}
			</span>
		</div>
	);
}

// ─── Draggable chip for unassigned pool ──────────────────────────────────────

function UnassignedChip({ rosterId, student }: { rosterId: string; student: StudentOverview }) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `unassigned::${rosterId}`,
		data: { rosterId, fromGroupId: "unassigned" },
	});
	return (
		<div
			ref={setNodeRef}
			{...listeners}
			{...attributes}
			className={`relative flex flex-col items-center justify-center gap-0.5 rounded-md bg-slate-800/60 border border-slate-700 cursor-grab active:cursor-grabbing transition-opacity touch-none shrink-0 w-[60px] h-[60px] ${isDragging ? "opacity-30" : ""}`}
		>
			<div
				className={`h-8 w-8 rounded-md ${avatarColorDi(rosterId)} flex items-center justify-center shrink-0`}
			>
				<span className="text-[10px] font-bold leading-none text-white/90">
					{studentInitialsDi(student)}
				</span>
			</div>
			<span className="text-[9px] text-slate-200 leading-tight text-center truncate w-full px-0.5">
				{student.displayName}
			</span>
		</div>
	);
}

// ─── Droppable group area ─────────────────────────────────────────────────────

function DroppableGroup({
	groupId,
	color,
	children,
	className,
}: {
	groupId: string;
	color: string;
	children: React.ReactNode;
	className?: string;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: groupId });
	const cs = colorStyle(color);
	return (
		<div
			ref={setNodeRef}
			className={`${className ?? ""} transition-all ${isOver ? cs.dropActive : ""}`}
		>
			{children}
		</div>
	);
}

// ─── Draft group card ─────────────────────────────────────────────────────────

function DraftGroupCard({
	group,
	students,
	assignedRosterIds,
	onRemoveMember,
	onAddMember,
	onRemoveGroup,
	canRemove,
}: {
	group: { id: string; name: string; color: string; memberRosterIds: string[] };
	students: StudentOverview[];
	assignedRosterIds: Set<string>;
	onRemoveMember: (groupId: string, rosterId: string) => void;
	onAddMember: (groupId: string, rosterId: string) => void;
	onRemoveGroup: (groupId: string) => void;
	canRemove: boolean;
}) {
	const [showPicker, setShowPicker] = useState(false);
	const cs = colorStyle(group.color);
	const available = students.filter(
		(s) => !assignedRosterIds.has(s.rosterId) && !group.memberRosterIds.includes(s.rosterId),
	);

	return (
		<DroppableGroup
			groupId={group.id}
			color={group.color}
			className={`rounded-xl border border-slate-700 overflow-hidden ${cs.bg}`}
		>
			<div className={`${cs.header} px-3 py-2 flex items-center justify-between`}>
				<span className="text-sm font-bold text-white">{group.name}</span>
				{canRemove && (
					<button
						type="button"
						onClick={() => onRemoveGroup(group.id)}
						className="text-white/60 hover:text-white transition-colors"
					>
						<XIcon className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<div className="p-2 flex flex-wrap gap-1.5 min-h-[60px]">
				{group.memberRosterIds.length === 0 && (
					<p className="text-xs text-slate-500 px-1">Drop students here</p>
				)}
				{group.memberRosterIds.map((rid) => {
					const s = students.find((st) => st.rosterId === rid);
					if (!s) return null;
					return (
						<DraggableChip
							key={rid}
							rosterId={rid}
							student={s}
							groupId={group.id}
							onRemove={() => onRemoveMember(group.id, rid)}
							size="md"
						/>
					);
				})}
				{/* Add student button */}
				<div className="relative">
					<button
						type="button"
						onClick={() => setShowPicker((v) => !v)}
						className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
					>
						<PlusIcon className="h-3 w-3" />
						Add student
					</button>
					{showPicker && available.length > 0 && (
						<div className="absolute z-10 top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto min-w-[160px]">
							{available.map((s) => (
								<button
									key={s.rosterId}
									type="button"
									onClick={() => {
										onAddMember(group.id, s.rosterId);
										setShowPicker(false);
									}}
									className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
								>
									{s.displayName}
								</button>
							))}
						</div>
					)}
					{showPicker && available.length === 0 && (
						<div className="absolute z-10 top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
							<p className="text-xs text-slate-400">All students assigned</p>
						</div>
					)}
				</div>
			</div>
		</DroppableGroup>
	);
}

// ─── Active session group card ────────────────────────────────────────────────

function ActiveGroupCard({
	group,
	students,
	isWinner,
	onScore,
	onAddMember,
	onRemoveMember,
	assignedRosterIds,
	updating,
	burstRef,
}: {
	group: DiGroup;
	students: StudentOverview[];
	isWinner: boolean;
	onScore: (groupId: string, delta: number) => void;
	onAddMember: (groupId: string, rosterId: string) => void;
	onRemoveMember: (groupId: string, rosterId: string) => void;
	assignedRosterIds: Set<string>;
	updating: boolean;
	burstRef: React.RefObject<HTMLDivElement | null>;
}) {
	const [showPicker, setShowPicker] = useState(false);
	const cs = colorStyle(group.color);
	const available = students
		.filter((s) => !assignedRosterIds.has(s.rosterId) || group.memberRosterIds.includes(s.rosterId))
		.filter((s) => !group.memberRosterIds.includes(s.rosterId));

	return (
		<DroppableGroup
			groupId={group.id}
			color={group.color}
			className={`rounded-xl border overflow-hidden flex flex-col ${cs.bg} ${isWinner ? `ring-2 ${cs.ring} border-transparent` : "border-slate-700"}`}
		>
			{/* Header */}
			<div className={`${cs.header} px-3 py-2 flex items-center justify-between`}>
				<span className="text-sm font-bold text-white">{group.name}</span>
				{isWinner && <TrophyIcon className="h-4 w-4 text-yellow-300" />}
			</div>

			{/* Points */}
			<div ref={burstRef} className="flex flex-col items-center py-4 gap-2">
				<span className="text-5xl font-black tabular-nums text-white leading-none">
					{group.points}
				</span>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => onScore(group.id, -1)}
						disabled={updating || group.points === 0}
						className="h-9 w-9 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xl font-bold text-slate-200 disabled:opacity-40 transition-colors active:scale-95"
					>
						−
					</button>
					<button
						type="button"
						onClick={() => onScore(group.id, 1)}
						disabled={updating}
						className={`h-9 w-9 rounded-full ${cs.header} hover:opacity-90 flex items-center justify-center text-xl font-bold text-white disabled:opacity-40 transition-colors active:scale-95`}
					>
						+
					</button>
				</div>
			</div>

			{/* Members */}
			<div className="px-2 pb-2 flex flex-wrap gap-1 min-h-[40px]">
				{group.memberRosterIds.length === 0 && (
					<p className="text-[10px] text-slate-600 px-1">Drop students here</p>
				)}
				{group.memberRosterIds.map((rid) => {
					const s = students.find((st) => st.rosterId === rid);
					if (!s) return null;
					return (
						<DraggableChip
							key={rid}
							rosterId={rid}
							student={s}
							groupId={group.id}
							onRemove={() => onRemoveMember(group.id, rid)}
							size="sm"
						/>
					);
				})}
				{/* Add student */}
				<div className="relative">
					<button
						type="button"
						onClick={() => setShowPicker((v) => !v)}
						className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 transition-colors mt-0.5"
					>
						<PlusIcon className="h-2.5 w-2.5" />
						Add
					</button>
					{showPicker && (
						<div className="absolute z-10 bottom-full left-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-36 overflow-y-auto min-w-[150px]">
							{available.length === 0 ? (
								<p className="px-3 py-2 text-xs text-slate-400">No unassigned students</p>
							) : (
								available.map((s) => (
									<button
										key={s.rosterId}
										type="button"
										onClick={() => {
											onAddMember(group.id, s.rosterId);
											setShowPicker(false);
										}}
										className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
									>
										{s.displayName}
									</button>
								))
							)}
						</div>
					)}
				</div>
			</div>
		</DroppableGroup>
	);
}

// ─── Main DiPanel ─────────────────────────────────────────────────────────────

export function DiPanel({
	classId,
	students,
	onSessionEnd,
	dispatchRef,
	onActiveSessionChange,
}: DiPanelProps) {
	// Session state
	const [sessions, setSessions] = useState<DiSession[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [showSetup, setShowSetup] = useState(false);
	const [loading, setLoading] = useState(true);

	// Derived: active session
	const session = sessions.find((s) => s.id === activeSessionId) ?? null;

	// Notify parent when an active (non-ended) session exists or disappears
	// biome-ignore lint/correctness/useExhaustiveDependencies: onActiveSessionChange is stable from parent
	useEffect(() => {
		const hasActive = sessions.some((s) => s.status === "active");
		onActiveSessionChange?.(hasActive);
	}, [sessions]);

	// Draft (pre-session) — persisted to localStorage
	const LS_KEY = `di-draft-${classId}`;
	const loadDraft = () => {
		try {
			const raw = localStorage.getItem(LS_KEY);
			if (raw)
				return JSON.parse(raw) as {
					label: string;
					voiceGuardWord: string;
					groups: { id: string; name: string; color: string; memberRosterIds: string[] }[];
				};
		} catch {}
		return null;
	};
	const saved = loadDraft();
	const [label, setLabel] = useState(saved?.label ?? "DI Activity");
	const [voiceGuardWord, setVoiceGuardWord] = useState(saved?.voiceGuardWord ?? "");
	const [draftGroups, setDraftGroups] = useState<
		{ id: string; name: string; color: string; memberRosterIds: string[] }[]
	>(
		// Always start empty — group names/colors are remembered but members reset each session
		(
			saved?.groups ?? [
				{ id: "draft-red", name: "Red", color: "red", memberRosterIds: [] },
				{ id: "draft-blue", name: "Blue", color: "blue", memberRosterIds: [] },
				{ id: "draft-green", name: "Green", color: "green", memberRosterIds: [] },
				{ id: "draft-yellow", name: "Yellow", color: "yellow", memberRosterIds: [] },
			]
		).map((g) => ({ ...g, memberRosterIds: [] })),
	);
	const [starting, setStarting] = useState(false);

	// Persist draft to localStorage whenever it changes
	useEffect(() => {
		try {
			localStorage.setItem(LS_KEY, JSON.stringify({ label, voiceGuardWord, groups: draftGroups }));
		} catch {}
	}, [LS_KEY, label, voiceGuardWord, draftGroups]);

	// Active session state
	const [pointsUpdating, setPointsUpdating] = useState<Record<string, boolean>>({});
	const [winnerGroupIds, setWinnerGroupIds] = useState<string[]>([]);
	const [burstGroupId, setBurstGroupId] = useState<string | null>(null);
	const [showEndConfirm, setShowEndConfirm] = useState(false);
	const [ending, setEnding] = useState(false);

	// Drag state
	const [activeDrag, setActiveDrag] = useState<{ rosterId: string; fromGroupId: string } | null>(
		null,
	);
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

	// Setup multi-select
	const [selectedRosterIds, setSelectedRosterIds] = useState<Set<string>>(new Set());

	// ─── Always-on continuous voice ─────────────────────────────────────────────
	const [listenState, setListenState] = useState<"on" | "off" | "processing">("off");
	// Keep a ref to the latest dispatchVoiceCommand to avoid stale closures
	const dispatchFnRef = useRef(dispatchVoiceCommand);
	useEffect(() => {
		dispatchFnRef.current = dispatchVoiceCommand;
	});

	useEffect(() => {
		const SR =
			typeof window !== "undefined"
				? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
				: null;
		if (!SR) {
			toast.error("Speech recognition not supported in this browser");
			return;
		}

		let stopped = false;
		let recognition: SpeechRecognition | null = null;

		function start() {
			if (stopped || !SR) return;
			recognition = new SR();
			recognition.continuous = true;
			recognition.interimResults = false;
			recognition.lang = "en-US";
			recognition.onstart = () => {
				setListenState("on");
			};
			recognition.onresult = async (e: SpeechRecognitionEvent) => {
				const result = e.results[e.results.length - 1];
				if (!result?.isFinal) return;
				const transcript = result[0]?.transcript ?? "";
				if (!transcript.trim()) return;
				if (readBooleanPreference(VOICE_DEBUG_FEEDBACK_ENABLED_KEY, true)) {
					toast.info(`Heard: "${transcript}"`, { duration: 2000 });
				}
				setListenState("processing");
				await dispatchFnRef.current(transcript);
				setListenState("on");
			};
			recognition.onend = () => {
				if (!stopped) setTimeout(start, 300);
				else setListenState("off");
			};
			recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
				if (e.error === "not-allowed") {
					toast.error("Microphone access denied — check browser permissions");
					stopped = true;
					setListenState("off");
				} else if (e.error === "service-unavailable") {
					toast.error("Speech service unavailable");
				} else if (e.error !== "no-speech" && e.error !== "aborted") {
					console.warn("[DI voice error]", e.error);
				}
			};
			recognition.start();
		}

		start();
		return () => {
			stopped = true;
			recognition?.stop();
			setListenState("off");
		};
	}, []); // mount/unmount only — dispatchFnRef handles freshness

	// Burst refs (one per group, keyed by group id)
	const burstRefs = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map());

	function getBurstRef(groupId: string) {
		if (!burstRefs.current.has(groupId)) {
			burstRefs.current.set(groupId, { current: null });
		}
		// biome-ignore lint/style/noNonNullAssertion: we set it on the line above
		return burstRefs.current.get(groupId)!;
	}

	// Load active session on mount
	// biome-ignore lint/correctness/useExhaustiveDependencies: normalizeSession is stable
	useEffect(() => {
		async function checkActive() {
			setLoading(true);
			try {
				const res = await fetch(`/api/classes/${classId}/di-sessions`);
				if (res.ok) {
					const json = await res.json();
					const active = (json.sessions ?? []).filter(
						(s: { status: string }) => s.status === "active",
					);
					const normalized = active.map(normalizeSession);
					setSessions(normalized);
					if (normalized.length > 0) setActiveSessionId(normalized[0].id);
					else setShowSetup(true);
				}
			} catch {
				/* noop */
			} finally {
				setLoading(false);
			}
		}
		checkActive();
	}, [classId]);

	function normalizeSession(raw: {
		id: string;
		label: string;
		status: string;
		rewardAmount: number;
		groups: Array<{
			id: string;
			name: string;
			color: string;
			points: number;
			members: Array<{ rosterId: string }>;
		}>;
	}): DiSession {
		return {
			id: raw.id,
			label: raw.label,
			status: raw.status as "active" | "ended",
			rewardAmount: raw.rewardAmount,
			groups: raw.groups.map((g) => ({
				id: g.id,
				name: g.name,
				color: g.color,
				points: g.points,
				memberRosterIds: g.members.map((m) => m.rosterId),
			})),
		};
	}

	// Derived: all assigned rosterIds across all groups
	const assignedRosterIds = useCallback(
		(groups: { memberRosterIds: string[] }[]) => new Set(groups.flatMap((g) => g.memberRosterIds)),
		[],
	);

	// Draft group management
	function addDraftGroup() {
		const usedColors = new Set(draftGroups.map((g) => g.color));
		const nextColor = COLOR_ORDER.find((c) => !usedColors.has(c)) ?? "red";
		const name = nextColor.charAt(0).toUpperCase() + nextColor.slice(1);
		setDraftGroups((prev) => [
			...prev,
			{ id: `draft-${Date.now()}`, name, color: nextColor, memberRosterIds: [] },
		]);
	}

	function removeDraftGroup(groupId: string) {
		setDraftGroups((prev) => prev.filter((g) => g.id !== groupId));
	}

	function addDraftMember(groupId: string, rosterId: string) {
		setDraftGroups((prev) =>
			prev.map((g) =>
				g.id === groupId ? { ...g, memberRosterIds: [...g.memberRosterIds, rosterId] } : g,
			),
		);
	}

	function removeDraftMember(groupId: string, rosterId: string) {
		setDraftGroups((prev) =>
			prev.map((g) =>
				g.id === groupId
					? { ...g, memberRosterIds: g.memberRosterIds.filter((r) => r !== rosterId) }
					: g,
			),
		);
	}

	// ─── Drag handlers ──────────────────────────────────────────────────────────

	function handleDragStart(event: DragStartEvent) {
		const data = event.active.data.current as { rosterId: string; fromGroupId: string };
		setActiveDrag(data);
	}

	function handleDragEndDraft(event: DragEndEvent) {
		setActiveDrag(null);
		const { active, over } = event;
		if (!over) return;
		const { rosterId, fromGroupId } = active.data.current as {
			rosterId: string;
			fromGroupId: string;
		};
		const toGroupId = over.id as string;
		if (fromGroupId === toGroupId) return;
		// Move: remove from old, add to new
		setDraftGroups((prev) =>
			prev.map((g) => {
				if (g.id === fromGroupId)
					return { ...g, memberRosterIds: g.memberRosterIds.filter((r) => r !== rosterId) };
				if (g.id === toGroupId) return { ...g, memberRosterIds: [...g.memberRosterIds, rosterId] };
				return g;
			}),
		);
	}

	async function handleDragEndActive(event: DragEndEvent) {
		setActiveDrag(null);
		const { active, over } = event;
		if (!over || !session) return;
		const { rosterId, fromGroupId } = active.data.current as {
			rosterId: string;
			fromGroupId: string;
		};
		const toGroupId = over.id as string;
		if (fromGroupId === toGroupId) return;
		// Optimistic move (if from unassigned pool, just add; else remove from old group too)
		setSessions((prev) =>
			prev.map((s) =>
				s.id === activeSessionId
					? {
							...s,
							groups: s.groups.map((g) => {
								if (fromGroupId !== "unassigned" && g.id === fromGroupId)
									return { ...g, memberRosterIds: g.memberRosterIds.filter((r) => r !== rosterId) };
								if (g.id === toGroupId && !g.memberRosterIds.includes(rosterId))
									return { ...g, memberRosterIds: [...g.memberRosterIds, rosterId] };
								return g;
							}),
						}
					: s,
			),
		);
		// Fire API: remove from old group (skip if dragging from unassigned pool), add to new
		try {
			const calls: Promise<Response>[] = [
				fetch(`/api/classes/${classId}/di-sessions/${session.id}/groups/${toGroupId}/members`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ rosterIds: [rosterId] }),
				}),
			];
			if (fromGroupId !== "unassigned") {
				calls.push(
					fetch(`/api/classes/${classId}/di-sessions/${session.id}/groups/${fromGroupId}/members`, {
						method: "DELETE",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ rosterId }),
					}),
				);
			}
			await Promise.all(calls);
		} catch {
			toast.error("Failed to move student");
		}
	}

	// Expose dispatchVoiceCommand to parent via ref (global mic routing)
	useEffect(() => {
		if (dispatchRef) dispatchRef.current = dispatchVoiceCommand;
		return () => {
			if (dispatchRef) dispatchRef.current = null;
		};
	});

	// ─── Start session ──────────────────────────────────────────────────────────

	async function handleStartSession() {
		if (starting) return;
		setStarting(true);
		try {
			const res = await fetch(`/api/classes/${classId}/di-sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					label,
					groups: draftGroups.map((g) => ({
						name: g.name,
						color: g.color,
						memberRosterIds: g.memberRosterIds,
					})),
				}),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error((err as { error?: string }).error ?? "Failed to start session");
			}
			const json = await res.json();
			const newSession = normalizeSession(json.session);
			setSessions((prev) => [...prev, newSession]);
			setActiveSessionId(newSession.id);
			setShowSetup(false);
			setDraftGroups([
				{ id: "draft-red", name: "Red", color: "red", memberRosterIds: [] },
				{ id: "draft-blue", name: "Blue", color: "blue", memberRosterIds: [] },
				{ id: "draft-green", name: "Green", color: "green", memberRosterIds: [] },
				{ id: "draft-yellow", name: "Yellow", color: "yellow", memberRosterIds: [] },
			]);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to start session");
		} finally {
			setStarting(false);
		}
	}

	// ─── Score / member management ──────────────────────────────────────────────

	async function handleScore(groupId: string, delta: number) {
		if (pointsUpdating[groupId] || !session) return;
		setSessions((prev) =>
			prev.map((s) =>
				s.id === activeSessionId
					? {
							...s,
							groups: s.groups.map((g) =>
								g.id === groupId ? { ...g, points: Math.max(0, g.points + delta) } : g,
							),
						}
					: s,
			),
		);
		setPointsUpdating((prev) => ({ ...prev, [groupId]: true }));
		try {
			const res = await fetch(
				`/api/classes/${classId}/di-sessions/${session.id}/groups/${groupId}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ delta }),
				},
			);
			if (!res.ok) throw new Error("Failed to update score");
			const json = await res.json();
			setSessions((prev) =>
				prev.map((s) =>
					s.id === activeSessionId
						? {
								...s,
								groups: s.groups.map((g) =>
									g.id === groupId ? { ...g, points: json.group.points } : g,
								),
							}
						: s,
				),
			);
		} catch {
			setSessions((prev) =>
				prev.map((s) =>
					s.id === activeSessionId
						? {
								...s,
								groups: s.groups.map((g) =>
									g.id === groupId ? { ...g, points: Math.max(0, g.points - delta) } : g,
								),
							}
						: s,
				),
			);
			toast.error("Score update failed");
		} finally {
			setPointsUpdating((prev) => ({ ...prev, [groupId]: false }));
		}
	}

	async function handleAddMember(groupId: string, rosterId: string) {
		if (!session) return;
		setSessions((prev) =>
			prev.map((s) =>
				s.id === activeSessionId
					? {
							...s,
							groups: s.groups.map((g) =>
								g.id === groupId && !g.memberRosterIds.includes(rosterId)
									? { ...g, memberRosterIds: [...g.memberRosterIds, rosterId] }
									: g,
							),
						}
					: s,
			),
		);
		try {
			await fetch(`/api/classes/${classId}/di-sessions/${session.id}/groups/${groupId}/members`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterIds: [rosterId] }),
			});
		} catch {
			toast.error("Failed to add student");
		}
	}

	async function handleRemoveMember(groupId: string, rosterId: string) {
		if (!session) return;
		setSessions((prev) =>
			prev.map((s) =>
				s.id === activeSessionId
					? {
							...s,
							groups: s.groups.map((g) =>
								g.id === groupId
									? { ...g, memberRosterIds: g.memberRosterIds.filter((r) => r !== rosterId) }
									: g,
							),
						}
					: s,
			),
		);
		try {
			await fetch(`/api/classes/${classId}/di-sessions/${session.id}/groups/${groupId}/members`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId }),
			});
		} catch {
			toast.error("Failed to remove student");
		}
	}

	async function handleEndSession() {
		if (!session || ending) return;
		setEnding(true);
		try {
			const res = await fetch(`/api/classes/${classId}/di-sessions/${session.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "end" }),
			});
			if (!res.ok) throw new Error("Failed to end session");
			const json = await res.json();
			const ids: string[] = json.winners.map((w: { groupId: string }) => w.groupId);
			setWinnerGroupIds(ids);
			setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, status: "ended" } : s)));
			setShowEndConfirm(false);
			// After winner burst, remove from sessions and switch tabs
			setTimeout(() => {
				setSessions((prev) => {
					const remaining = prev.filter((s) => session && s.id !== session.id);
					if (remaining.length > 0) setActiveSessionId(remaining[0].id);
					else {
						setActiveSessionId(null);
						setShowSetup(true);
					}
					return remaining;
				});
			}, 2500);
			for (const id of ids) {
				setBurstGroupId(id);
			}
			toast.success(
				`Session ended! ${ids.length === 1 ? "Winner" : "Winners"} awarded ${json.bucksAwarded} RAM Bucks each!`,
			);
			onSessionEnd();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to end session");
		} finally {
			setEnding(false);
		}
	}

	// ─── Voice ──────────────────────────────────────────────────────────────────

	async function dispatchVoiceCommand(command: string) {
		if (voiceGuardWord.trim()) {
			const wordLower = voiceGuardWord.trim().toLowerCase();
			if (!command.toLowerCase().includes(wordLower)) return;
		}

		const isSetup = !session;

		// Build group list from whichever context is active
		const groupsForApi = isSetup
			? draftGroups.map((g) => ({
					id: g.id,
					name: g.name,
					color: g.color,
					members: g.memberRosterIds.map((rid) => {
						const s = students.find((st) => st.rosterId === rid);
						return { rosterId: rid, displayName: s?.displayName ?? rid };
					}),
				}))
			: (session?.groups ?? []).map((g) => ({
					id: g.id,
					name: g.name,
					color: g.color,
					members: g.memberRosterIds.map((rid) => {
						const s = students.find((st) => st.rosterId === rid);
						return { rosterId: rid, displayName: s?.displayName ?? rid };
					}),
				}));

		try {
			const res = await fetch("/api/coach/di-voice", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					command,
					groups: groupsForApi,
					roster: students.map((s) => ({
						rosterId: s.rosterId,
						firstName: s.firstName ?? null,
						lastName: null,
						displayName: s.displayName,
					})),
				}),
			});
			if (!res.ok) throw new Error("Voice parse failed");
			const action = (await res.json()) as DiVoiceAction;

			if (action.action === "add-to-group") {
				const targetGroup = groupsForApi.find((g) => g.id === action.groupId);
				if (!targetGroup) {
					toast.error("Couldn't match a group — say a color like Red, Blue, Green");
					return;
				}
				const names = action.rosterIds
					.map((rid) => students.find((s) => s.rosterId === rid)?.displayName ?? rid)
					.join(", ");

				if (isSetup) {
					// Add to draft groups
					setDraftGroups((prev) =>
						prev.map((g) => {
							if (g.id === action.groupId)
								return {
									...g,
									memberRosterIds: [
										...g.memberRosterIds,
										...action.rosterIds.filter((rid) => !g.memberRosterIds.includes(rid)),
									],
								};
							// Remove from other groups (move semantics)
							return {
								...g,
								memberRosterIds: g.memberRosterIds.filter((rid) => !action.rosterIds.includes(rid)),
							};
						}),
					);
					toast.success(`Added ${names} → ${targetGroup.name}`);
				} else {
					for (const rosterId of action.rosterIds) {
						const currentGroup = session?.groups.find(
							(g) => g.id !== action.groupId && g.memberRosterIds.includes(rosterId),
						);
						if (currentGroup) await handleRemoveMember(currentGroup.id, rosterId);
						await handleAddMember(action.groupId, rosterId);
					}
					toast.success(`Added ${names} → ${targetGroup.name}`);
				}
			} else if (action.action === "score") {
				if (isSetup) {
					toast.error("Start a session first to score groups");
				} else {
					await handleScore(action.groupId, action.delta);
				}
			} else {
				toast.error(
					"Couldn't understand — try: 'Marcus Aaliyah Jordan Red' or 'Blue gets 2 points'",
				);
			}
		} catch (err) {
			console.error("[DI voice error]", err);
			toast.error("Voice command failed");
		}
	}

	// ─── Render ─────────────────────────────────────────────────────────────────

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<p className="text-sm text-slate-500">Loading…</p>
			</div>
		);
	}

	// ── PRE-SESSION SETUP ──────────────────────────────────────────────────────
	if (sessions.length === 0 || showSetup) {
		const assigned = assignedRosterIds(draftGroups);
		// All unassigned students shown as draggable chips in an "unassigned" pool
		const unassigned = students.filter((s) => !assigned.has(s.rosterId));

		return (
			<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEndDraft}>
				<div className="flex flex-col gap-5 p-4">
					{sessions.length > 0 && (
						<button
							type="button"
							onClick={() => setShowSetup(false)}
							className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors self-start"
						>
							<XIcon className="h-3 w-3" />
							Back to sessions
						</button>
					)}
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-sm font-bold text-slate-200 mb-1">DI Group Session</h2>
							<p className="text-xs text-slate-500">
								Drag students into groups, or speak names and a color.
							</p>
						</div>
						<ListenBadge state={listenState} />
					</div>

					{/* Activity label */}
					<div>
						<label htmlFor="di-label" className="text-xs text-slate-400 mb-1 block">
							Activity label
						</label>
						<input
							type="text"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							id="di-label"
							className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							placeholder="DI Activity"
						/>
					</div>

					{/* Draft groups grid */}
					<div
						className={`grid gap-3 ${draftGroups.length % 3 === 0 ? "grid-cols-3" : "grid-cols-2"}`}
					>
						{draftGroups.map((g) => (
							<DraftGroupCard
								key={g.id}
								group={g}
								students={students}
								assignedRosterIds={assigned}
								onRemoveMember={removeDraftMember}
								onAddMember={addDraftMember}
								onRemoveGroup={removeDraftGroup}
								canRemove={draftGroups.length > 2}
							/>
						))}
					</div>

					{/* Unassigned pool */}
					{unassigned.length > 0 && (
						<div>
							<div className="flex items-center justify-between mb-2 flex-wrap gap-2">
								<p className="text-xs text-slate-500">
									Unassigned ({unassigned.length})
									{selectedRosterIds.size > 0 && (
										<span className="ml-1 text-indigo-400 font-semibold">
											· {selectedRosterIds.size} selected
										</span>
									)}
								</p>
								{selectedRosterIds.size > 0 && (
									<div className="flex items-center gap-1 flex-wrap">
										{draftGroups.map((g) => (
											<button
												key={g.id}
												type="button"
												onClick={() => {
													for (const rid of selectedRosterIds) addDraftMember(g.id, rid);
													setSelectedRosterIds(new Set());
												}}
												className="rounded px-2 py-0.5 text-[11px] font-semibold text-white transition-colors active:scale-95"
												style={{
													backgroundColor:
														g.color === "red"
															? "#ef4444"
															: g.color === "blue"
																? "#3b82f6"
																: g.color === "green"
																	? "#22c55e"
																	: g.color === "yellow"
																		? "#eab308"
																		: g.color === "purple"
																			? "#a855f7"
																			: g.color === "orange"
																				? "#f97316"
																				: "#6b7280",
												}}
											>
												→ {g.name}
											</button>
										))}
									</div>
								)}
							</div>
							<div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
								{unassigned.map((s) => {
									const isSel = selectedRosterIds.has(s.rosterId);
									return (
										<button
											key={s.rosterId}
											type="button"
											onClick={() =>
												setSelectedRosterIds((prev) => {
													const next = new Set(prev);
													if (next.has(s.rosterId)) next.delete(s.rosterId);
													else next.add(s.rosterId);
													return next;
												})
											}
											className={`relative flex flex-col items-center justify-center gap-0.5 rounded-md border w-[60px] h-[60px] shrink-0 transition-all active:scale-95 ${isSel ? "border-indigo-400 ring-2 ring-indigo-500 bg-indigo-500/15" : "border-slate-700 bg-slate-800/60 hover:bg-slate-700/60"}`}
										>
											<div
												className={`h-8 w-8 rounded-md ${avatarColorDi(s.rosterId)} flex items-center justify-center shrink-0`}
											>
												<span className="text-[10px] font-bold leading-none text-white/90">
													{studentInitialsDi(s)}
												</span>
											</div>
											<span className="text-[9px] text-slate-200 leading-tight text-center truncate w-full px-0.5">
												{s.displayName}
											</span>
											{isSel && (
												<span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-sm bg-indigo-500 flex items-center justify-center">
													<svg
														viewBox="0 0 10 10"
														className="h-2 w-2 fill-none stroke-white"
														aria-hidden="true"
													>
														<path
															d="M1.5 5.5l2.5 2.5 4.5-4.5"
															strokeWidth="1.5"
															strokeLinecap="round"
														/>
													</svg>
												</span>
											)}
										</button>
									);
								})}
							</div>
						</div>
					)}

					{/* Add group button */}
					{draftGroups.length < 6 && (
						<button
							type="button"
							onClick={addDraftGroup}
							className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors self-start"
						>
							<PlusIcon className="h-3.5 w-3.5" />
							Add group ({draftGroups.length}/6)
						</button>
					)}

					{/* Voice guard word */}
					<div>
						<label htmlFor="di-guard" className="text-xs text-slate-400 mb-1 block">
							Voice guard word{" "}
							<span className="text-slate-600">(optional — say this before every command)</span>
						</label>
						<input
							id="di-guard"
							type="text"
							value={voiceGuardWord}
							onChange={(e) => setVoiceGuardWord(e.target.value)}
							className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							placeholder="e.g. Coach, Ram, Go"
							maxLength={20}
						/>
						{voiceGuardWord.trim() && (
							<p className="mt-1 text-[11px] text-emerald-500">
								Only commands containing &ldquo;{voiceGuardWord.trim()}&rdquo; will execute.
							</p>
						)}
					</div>

					{/* Start button */}
					<button
						type="button"
						onClick={handleStartSession}
						disabled={starting || label.trim().length === 0}
						className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 text-sm transition-colors disabled:opacity-40 active:scale-95"
					>
						{starting ? "Starting…" : "Start Session"}
					</button>
				</div>

				<DragOverlay>
					{activeDrag &&
						(() => {
							const s = students.find((st) => st.rosterId === activeDrag.rosterId);
							if (!s) return null;
							return <GhostChip student={s} rosterId={activeDrag.rosterId} />;
						})()}
				</DragOverlay>
			</DndContext>
		);
	}

	// ── ACTIVE SESSION ─────────────────────────────────────────────────────────
	if (!session) return null;
	const allAssigned = assignedRosterIds(session.groups);
	const isEnded = session.status === "ended";
	const maxPoints = Math.max(...session.groups.map((g) => g.points));

	return (
		<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEndActive}>
			<div className="flex flex-col gap-0">
				{/* Subject tabs */}
				{sessions.length > 0 && (
					<div className="shrink-0 flex items-center gap-1 px-3 pt-2 pb-1 bg-slate-900 border-b border-slate-800 overflow-x-auto">
						{sessions.map((s) => (
							<button
								key={s.id}
								type="button"
								onClick={() => {
									setActiveSessionId(s.id);
									setShowSetup(false);
								}}
								className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
									s.id === activeSessionId
										? "bg-indigo-600 text-white"
										: "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
								}`}
							>
								{s.label}
							</button>
						))}
						<button
							type="button"
							onClick={() => setShowSetup(true)}
							className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
						>
							<PlusIcon className="h-3 w-3" />
							Add subject
						</button>
					</div>
				)}
				{/* Top strip */}
				<div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800 flex-wrap">
					<div className="flex items-center gap-2 flex-1 min-w-0">
						<ListenBadge state={listenState} />
						<span className="text-sm font-bold text-slate-200 truncate">{session.label}</span>
						{isEnded && <span className="text-xs text-slate-500 shrink-0">· Ended</span>}
						<span className="text-xs text-slate-500 shrink-0">
							· {session.rewardAmount} RAM to winner
						</span>
						{voiceGuardWord.trim() && (
							<span className="text-xs font-mono bg-indigo-500/15 text-indigo-400 rounded px-1.5 py-0.5 shrink-0">
								🔒 &ldquo;{voiceGuardWord.trim()}&rdquo;
							</span>
						)}
					</div>
					{!isEnded && (
						<div className="flex items-center gap-2 shrink-0">
							<button
								type="button"
								onClick={() => setShowEndConfirm(true)}
								className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 transition-colors active:scale-95"
							>
								End &amp; Award
							</button>
						</div>
					)}
				</div>

				{/* End confirm overlay */}
				{showEndConfirm && (
					<div className="shrink-0 bg-amber-950/60 border-b border-amber-700 px-4 py-3 flex items-center gap-3">
						<p className="text-sm text-amber-200 flex-1">
							End session and award{" "}
							<span className="font-bold">{session.rewardAmount} RAM Bucks</span> to winning team?
						</p>
						<button
							type="button"
							onClick={handleEndSession}
							disabled={ending}
							className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 transition-colors disabled:opacity-40"
						>
							{ending ? "Ending…" : "Confirm"}
						</button>
						<button
							type="button"
							onClick={() => setShowEndConfirm(false)}
							className="text-amber-400 hover:text-amber-200 transition-colors"
						>
							<XIcon className="h-4 w-4" />
						</button>
					</div>
				)}

				{/* Group cards grid */}
				<div>
					<div
						className={`p-4 grid gap-3 ${session.groups.length % 3 === 0 ? "grid-cols-3" : "grid-cols-2"}`}
					>
						{session.groups.map((group) => {
							const ref = getBurstRef(group.id);
							const isWinner =
								isEnded && winnerGroupIds.includes(group.id) && group.points === maxPoints;
							return (
								<ActiveGroupCard
									key={group.id}
									group={group}
									students={students}
									isWinner={isWinner}
									onScore={handleScore}
									onAddMember={handleAddMember}
									onRemoveMember={handleRemoveMember}
									assignedRosterIds={allAssigned}
									updating={!!pointsUpdating[group.id]}
									burstRef={ref}
								/>
							);
						})}
					</div>
				</div>

				{/* Unassigned students pool */}
				{!isEnded &&
					(() => {
						const unassigned = students.filter((s) => !allAssigned.has(s.rosterId));
						if (unassigned.length === 0) return null;
						return (
							<div className="px-4 pb-4 border-t border-slate-800 pt-3">
								<p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
									Unassigned ({unassigned.length}) — drag or speak into a group
								</p>
								<div className="flex flex-wrap gap-1.5">
									{unassigned.map((s) => (
										<UnassignedChip key={s.rosterId} rosterId={s.rosterId} student={s} />
									))}
								</div>
							</div>
						);
					})()}

				{/* RAM Buck burst for winning group(s) */}
				{burstGroupId &&
					(() => {
						const ref = getBurstRef(burstGroupId);
						return (
							<RamBuckBurst
								amount={session.rewardAmount}
								type="award"
								anchorRef={ref}
								onDone={() => setBurstGroupId(null)}
							/>
						);
					})()}
			</div>

			<DragOverlay>
				{activeDrag &&
					(() => {
						const s = students.find((st) => st.rosterId === activeDrag.rosterId);
						if (!s) return null;
						return <GhostChip student={s} rosterId={activeDrag.rosterId} />;
					})()}
			</DragOverlay>
		</DndContext>
	);
}
