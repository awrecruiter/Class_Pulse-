"use client";

import { PlusIcon, TrophyIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";
import type { DiVoiceAction } from "@/app/api/coach/di-voice/route";
import { MicButton, type MicState } from "@/components/coach/mic-button";
import { RamBuckBurst } from "@/components/coach/ram-buck-burst";

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
}

// ─── Color map ────────────────────────────────────────────────────────────────

const DI_COLORS: Record<
	string,
	{ bg: string; header: string; ring: string; text: string; badge: string }
> = {
	red: {
		bg: "bg-red-950/40",
		header: "bg-red-600",
		ring: "ring-red-500",
		text: "text-red-300",
		badge: "bg-red-500/20 text-red-200",
	},
	blue: {
		bg: "bg-blue-950/40",
		header: "bg-blue-600",
		ring: "ring-blue-500",
		text: "text-blue-300",
		badge: "bg-blue-500/20 text-blue-200",
	},
	green: {
		bg: "bg-emerald-950/40",
		header: "bg-emerald-600",
		ring: "ring-emerald-500",
		text: "text-emerald-300",
		badge: "bg-emerald-500/20 text-emerald-200",
	},
	yellow: {
		bg: "bg-amber-950/40",
		header: "bg-amber-500",
		ring: "ring-amber-400",
		text: "text-amber-300",
		badge: "bg-amber-500/20 text-amber-200",
	},
	orange: {
		bg: "bg-orange-950/40",
		header: "bg-orange-600",
		ring: "ring-orange-500",
		text: "text-orange-300",
		badge: "bg-orange-500/20 text-orange-200",
	},
	purple: {
		bg: "bg-violet-950/40",
		header: "bg-violet-600",
		ring: "ring-violet-500",
		text: "text-violet-300",
		badge: "bg-violet-500/20 text-violet-200",
	},
};

const COLOR_ORDER = ["red", "blue", "green", "yellow", "orange", "purple"];

// ─── Avatar helpers (same hash as coach page) ─────────────────────────────────

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

// ─── Draft group builder (pre-session) ───────────────────────────────────────

type DraftGroup = {
	id: string;
	name: string;
	color: string;
	memberRosterIds: string[];
};

function DraftGroupCard({
	group,
	students,
	assignedRosterIds,
	onRemoveMember,
	onAddMember,
	onRemoveGroup,
	canRemove,
}: {
	group: DraftGroup;
	students: StudentOverview[];
	assignedRosterIds: Set<string>;
	onRemoveMember: (groupId: string, rosterId: string) => void;
	onAddMember: (groupId: string, rosterId: string) => void;
	onRemoveGroup: (groupId: string) => void;
	canRemove: boolean;
}) {
	const [showPicker, setShowPicker] = useState(false);
	const cs = colorStyle(group.color);
	const unassigned = students.filter(
		(s) => !assignedRosterIds.has(s.rosterId) || group.memberRosterIds.includes(s.rosterId),
	);
	const available = unassigned.filter((s) => !group.memberRosterIds.includes(s.rosterId));

	return (
		<div className={`rounded-xl border border-slate-700 overflow-hidden ${cs.bg}`}>
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
			<div className="p-2 flex flex-col gap-1.5 min-h-[60px]">
				{group.memberRosterIds.length === 0 && (
					<p className="text-xs text-slate-500 px-1">No students yet</p>
				)}
				{group.memberRosterIds.map((rid) => {
					const s = students.find((st) => st.rosterId === rid);
					if (!s) return null;
					return (
						<div
							key={rid}
							className="flex items-center justify-between gap-1.5 rounded-lg bg-slate-800/60 px-2 py-1"
						>
							<div className="flex items-center gap-1.5 min-w-0">
								<div
									className={`h-5 w-5 rounded-md ${avatarColorDi(rid)} flex items-center justify-center shrink-0`}
								>
									<span className="text-[9px] font-bold leading-none text-white/90">
										{studentInitialsDi(s)}
									</span>
								</div>
								<span className="text-xs text-slate-200 truncate">{s.displayName}</span>
							</div>
							<button
								type="button"
								onClick={() => onRemoveMember(group.id, rid)}
								className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
							>
								<XIcon className="h-3 w-3" />
							</button>
						</div>
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
		</div>
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
		<div
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
			<div className="px-2 pb-2 flex flex-col gap-1">
				{group.memberRosterIds.map((rid) => {
					const s = students.find((st) => st.rosterId === rid);
					if (!s) return null;
					return (
						<div
							key={rid}
							className="flex items-center justify-between gap-1.5 rounded-lg bg-slate-800/60 px-2 py-1"
						>
							<div className="flex items-center gap-1.5 min-w-0">
								<div
									className={`h-5 w-5 rounded-md ${avatarColorDi(rid)} flex items-center justify-center shrink-0`}
								>
									<span className="text-[9px] font-bold leading-none text-white/90">
										{studentInitialsDi(s)}
									</span>
								</div>
								<span className="text-[11px] text-slate-300 truncate">{s.displayName}</span>
							</div>
							<button
								type="button"
								onClick={() => onRemoveMember(group.id, rid)}
								className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
							>
								<XIcon className="h-2.5 w-2.5" />
							</button>
						</div>
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
		</div>
	);
}

// ─── Main DiPanel ─────────────────────────────────────────────────────────────

export function DiPanel({ classId, students, onSessionEnd }: DiPanelProps) {
	// Session state
	const [session, setSession] = useState<DiSession | null>(null);
	const [loading, setLoading] = useState(true);

	// Draft (pre-session)
	const [label, setLabel] = useState("DI Activity");
	const [voiceGuardWord, setVoiceGuardWord] = useState("");
	const [draftGroups, setDraftGroups] = useState<DraftGroup[]>([
		{ id: "draft-red", name: "Red", color: "red", memberRosterIds: [] },
		{ id: "draft-blue", name: "Blue", color: "blue", memberRosterIds: [] },
		{ id: "draft-green", name: "Green", color: "green", memberRosterIds: [] },
		{ id: "draft-yellow", name: "Yellow", color: "yellow", memberRosterIds: [] },
	]);
	const [starting, setStarting] = useState(false);

	// Active session state
	const [pointsUpdating, setPointsUpdating] = useState<Record<string, boolean>>({});
	const [winnerGroupIds, setWinnerGroupIds] = useState<string[]>([]);
	const [burstGroupId, setBurstGroupId] = useState<string | null>(null);
	const [showEndConfirm, setShowEndConfirm] = useState(false);
	const [ending, setEnding] = useState(false);

	// Voice
	const [micState, setMicState] = useState<MicState>("idle");
	const recognitionRef = useRef<SpeechRecognition | null>(null);

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
					const active = (json.sessions ?? []).find(
						(s: { status: string }) => s.status === "active",
					);
					if (active) {
						setSession(normalizeSession(active));
					}
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
		(groups: DraftGroup[] | DiGroup[]) => new Set(groups.flatMap((g) => g.memberRosterIds)),
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
			setSession(normalizeSession(json.session));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to start session");
		} finally {
			setStarting(false);
		}
	}

	// Optimistic score update
	async function handleScore(groupId: string, delta: number) {
		if (pointsUpdating[groupId] || !session) return;

		// Optimistic update
		setSession((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				groups: prev.groups.map((g) =>
					g.id === groupId ? { ...g, points: Math.max(0, g.points + delta) } : g,
				),
			};
		});
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
			// Sync server value
			setSession((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					groups: prev.groups.map((g) =>
						g.id === groupId ? { ...g, points: json.group.points } : g,
					),
				};
			});
		} catch {
			// Roll back
			setSession((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					groups: prev.groups.map((g) =>
						g.id === groupId ? { ...g, points: Math.max(0, g.points - delta) } : g,
					),
				};
			});
			toast.error("Score update failed");
		} finally {
			setPointsUpdating((prev) => ({ ...prev, [groupId]: false }));
		}
	}

	async function handleAddMember(groupId: string, rosterId: string) {
		if (!session) return;
		// Optimistic
		setSession((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				groups: prev.groups.map((g) =>
					g.id === groupId && !g.memberRosterIds.includes(rosterId)
						? { ...g, memberRosterIds: [...g.memberRosterIds, rosterId] }
						: g,
				),
			};
		});
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
		setSession((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				groups: prev.groups.map((g) =>
					g.id === groupId
						? { ...g, memberRosterIds: g.memberRosterIds.filter((r) => r !== rosterId) }
						: g,
				),
			};
		});
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
			setSession((prev) => (prev ? { ...prev, status: "ended" } : prev));
			setShowEndConfirm(false);
			// Trigger burst for each winner group
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

	// Voice
	function toggleVoice() {
		if (micState === "listening") {
			recognitionRef.current?.stop();
			setMicState("idle");
			return;
		}
		const SR =
			typeof window !== "undefined"
				? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
				: null;
		if (!SR) {
			toast.error("Speech recognition not supported");
			return;
		}
		const r = new SR();
		r.continuous = false;
		r.interimResults = false;
		r.lang = "en-US";
		r.onresult = async (e: SpeechRecognitionEvent) => {
			const transcript = e.results[0]?.[0]?.transcript ?? "";
			if (transcript && session) {
				setMicState("processing");
				await dispatchVoiceCommand(transcript);
			}
			setMicState("idle");
		};
		r.onend = () => setMicState("idle");
		r.onerror = () => setMicState("idle");
		recognitionRef.current = r;
		r.start();
		setMicState("listening");
	}

	async function dispatchVoiceCommand(command: string) {
		if (!session) return;
		// Guard word check — if a guard word is set, command must contain it (case-insensitive)
		if (voiceGuardWord.trim()) {
			const wordLower = voiceGuardWord.trim().toLowerCase();
			if (!command.toLowerCase().includes(wordLower)) {
				// Silently drop — student voice or missing guard word
				return;
			}
		}
		try {
			const res = await fetch("/api/coach/di-voice", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					command,
					groups: session.groups.map((g) => ({
						id: g.id,
						name: g.name,
						color: g.color,
						members: g.memberRosterIds.map((rid) => {
							const s = students.find((st) => st.rosterId === rid);
							return { rosterId: rid, displayName: s?.displayName ?? rid };
						}),
					})),
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

			if (action.action === "score") {
				await handleScore(action.groupId, action.delta);
			} else if (action.action === "add-to-group") {
				for (const rosterId of action.rosterIds) {
					await handleAddMember(action.groupId, rosterId);
				}
			} else {
				toast("Couldn't understand. Try: 'Red gets 2 points' or 'Add Marcus to Blue'");
			}
		} catch {
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

	// PRE-SESSION SETUP
	if (!session) {
		const assigned = assignedRosterIds(draftGroups);
		return (
			<div className="flex flex-col gap-5 p-4">
				<div>
					<h2 className="text-sm font-bold text-slate-200 mb-1">DI Group Session</h2>
					<p className="text-xs text-slate-500">Build teams, then score by voice or tap.</p>
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
				<div className="grid grid-cols-2 gap-3">
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
		);
	}

	// ACTIVE SESSION
	const allAssigned = assignedRosterIds(session.groups);
	const isEnded = session.status === "ended";
	const maxPoints = Math.max(...session.groups.map((g) => g.points));

	return (
		<div className="flex flex-col gap-0">
			{/* Top strip */}
			<div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800 flex-wrap">
				<div className="flex items-center gap-2 flex-1 min-w-0">
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

			{/* Centered voice orb */}
			{!isEnded && (
				<div className="flex flex-col items-center gap-3 py-6 border-b border-slate-800">
					<MicButton state={micState} onClick={toggleVoice} size="lg" />
					<p className="text-xs text-slate-500">
						{micState === "listening"
							? "Listening…"
							: micState === "processing"
								? "Processing…"
								: 'Tap mic: "Red gets 2 points" or "Add Marcus to Blue"'}
					</p>
				</div>
			)}

			{/* Group cards grid */}
			<div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
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
	);
}
