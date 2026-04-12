"use client";

import { createContext, useCallback, useContext, useReducer, useRef, useState } from "react";
import type { BoardPanel } from "@/components/board/side-strip";
import { playActivationChime } from "@/lib/chime";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueItemData =
	// ── Existing ─────────────────────────────────────────────────────────────
	| { type: "consequence"; studentName: string; step: number; stepLabel: string }
	| { type: "ram_bucks"; studentName: string; amount: number }
	| { type: "group_coins"; group: string; amount: number }
	| { type: "parent_message"; studentName: string; messageText: string }
	| { type: "move_to_group"; studentName: string; groupName: string }
	// ── New (voice agent) ─────────────────────────────────────────────────────
	| { type: "behavior_log"; studentName: string; notes: string }
	| { type: "ram_bucks_deduct"; studentName: string; amount: number; reason: string }
	| { type: "clear_group"; groupName: string }
	| { type: "start_session" }
	| { type: "end_session" }
	| { type: "open_store" }
	| { type: "close_store" }
	| { type: "start_lecture" }
	| { type: "stop_lecture" }
	| {
			type: "navigate";
			destination:
				| "board"
				| "classes"
				| "settings"
				| "coach"
				| "store"
				| "gradebook"
				| "parent-comms";
	  }
	| { type: "ask_coach"; question: string }
	| { type: "show_schedule" }
	| { type: "show_groups" }
	| { type: "open_doc"; label: string; url: string }
	| { type: "create_class"; label: string }
	| { type: "open_class"; className: string }
	| { type: "export_gradebook"; from?: string; to?: string }
	| { type: "approve_purchase"; studentName?: string; itemName?: string }
	| { type: "reject_purchase"; studentName?: string; itemName?: string }
	| { type: "draft_parent_message"; studentName: string; messageText: string }
	| { type: "send_parent_message"; studentName: string; messageText: string };

export interface QueueItem {
	id: string;
	data: QueueItemData;
	transcript: string;
	createdAt: number;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
	| { type: "ENQUEUE"; item: QueueItem }
	| { type: "CONFIRM"; id: string }
	| { type: "DISMISS"; id: string }
	| { type: "DISMISS_ALL" };

function reducer(state: QueueItem[], action: Action): QueueItem[] {
	switch (action.type) {
		case "ENQUEUE":
			return [action.item, ...state];
		case "CONFIRM":
		case "DISMISS":
			return state.filter((i) => i.id !== action.id);
		case "DISMISS_ALL":
			return [];
		default:
			return state;
	}
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface VoiceQueueCtx {
	queue: QueueItem[];
	enqueue: (data: QueueItemData, transcript: string) => void;
	confirm: (id: string) => void;
	dismiss: (id: string) => void;
	dismissAll: () => void;
	commandsEnabled: boolean;
	toggleCommands: () => void;
	drawerOpen: boolean;
	setDrawerOpen: (open: boolean) => void;
	micActive: boolean;
	setMicActive: (v: boolean) => void;
	lectureMicActive: boolean;
	setLectureMicActive: (v: boolean) => void;
	commsDictating: boolean;
	setCommsDictating: (v: boolean) => void;
	activeClassId: string;
	setActiveClassId: (id: string) => void;
	// Imperative stop — call before startListening() to synchronously kill global command mic
	stopCommandsNow: () => void;
	registerCommandStopper: (fn: () => void) => void;
	// Schedule overlay state
	scheduleOverlayOpen: boolean;
	setScheduleOverlayOpen: (open: boolean) => void;
	// Board commands
	boardPanel: BoardPanel | null;
	setBoardPanel: (panel: BoardPanel | null) => void;
	boardOpenLast: number; // increments to signal "open last resource"
	triggerBoardOpenLast: () => void;
	// Voice agent thinking indicator
	agentThinking: boolean;
	setAgentThinking: (v: boolean) => void;
}

const VoiceQueueContext = createContext<VoiceQueueCtx | null>(null);

export function VoiceQueueProvider({ children }: { children: React.ReactNode }) {
	const [queue, dispatch] = useReducer(reducer, []);
	const [commandsEnabled, setCommandsEnabled] = useState(true);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [micActive, setMicActive] = useState(false);
	const [lectureMicActive, setLectureMicActive] = useState(false);
	const [commsDictating, setCommsDictating] = useState(false);
	const [activeClassId, setActiveClassIdRaw] = useState(() => {
		try {
			return localStorage.getItem("activeClassId") ?? "";
		} catch {
			return "";
		}
	});
	const setActiveClassId = useCallback((id: string) => {
		setActiveClassIdRaw(id);
		try {
			if (id) localStorage.setItem("activeClassId", id);
			else localStorage.removeItem("activeClassId");
		} catch {
			/* noop */
		}
	}, []);
	const [boardPanel, setBoardPanel] = useState<BoardPanel | null>(null);
	const [boardOpenLast, setBoardOpenLast] = useState(0);
	const [agentThinking, setAgentThinking] = useState(false);
	const [scheduleOverlayOpen, setScheduleOverlayOpen] = useState(false);

	const enqueue = useCallback((data: QueueItemData, transcript: string) => {
		const item: QueueItem = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
			data,
			transcript,
			createdAt: Date.now(),
		};
		dispatch({ type: "ENQUEUE", item });
	}, []);

	const confirm = useCallback((id: string) => dispatch({ type: "CONFIRM", id }), []);
	const dismiss = useCallback((id: string) => dispatch({ type: "DISMISS", id }), []);
	const dismissAll = useCallback(() => dispatch({ type: "DISMISS_ALL" }), []);
	const commandsEnabledRef = useRef(true);
	const toggleCommands = useCallback(() => {
		const turningOn = !commandsEnabledRef.current;
		if (turningOn) playActivationChime();
		commandsEnabledRef.current = turningOn;
		setCommandsEnabled(turningOn);
	}, []);
	const triggerBoardOpenLast = useCallback(() => setBoardOpenLast((n) => n + 1), []);
	const commandStopperRef = useRef<() => void>(() => {});
	const stopCommandsNow = useCallback(() => commandStopperRef.current(), []);
	const registerCommandStopper = useCallback((fn: () => void) => {
		commandStopperRef.current = fn;
	}, []);

	return (
		<VoiceQueueContext.Provider
			value={{
				queue,
				enqueue,
				confirm,
				dismiss,
				dismissAll,
				commandsEnabled,
				toggleCommands,
				drawerOpen,
				setDrawerOpen,
				micActive,
				setMicActive,
				lectureMicActive,
				setLectureMicActive,
				commsDictating,
				setCommsDictating,
				activeClassId,
				setActiveClassId,
				stopCommandsNow,
				registerCommandStopper,
				boardPanel,
				setBoardPanel,
				boardOpenLast,
				triggerBoardOpenLast,
				agentThinking,
				setAgentThinking,
				scheduleOverlayOpen,
				setScheduleOverlayOpen,
			}}
		>
			{children}
		</VoiceQueueContext.Provider>
	);
}

export function useVoiceQueue() {
	const ctx = useContext(VoiceQueueContext);
	if (!ctx) throw new Error("useVoiceQueue must be used inside VoiceQueueProvider");
	return ctx;
}
