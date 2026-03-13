"use client";

import { createContext, useCallback, useContext, useReducer, useRef, useState } from "react";
import type { BoardPanel } from "@/components/board/side-strip";
import { playActivationChime } from "@/lib/chime";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueItemData =
	| { type: "consequence"; studentName: string; step: number; stepLabel: string }
	| { type: "ram_bucks"; studentName: string; amount: number }
	| { type: "group_coins"; group: string; amount: number }
	| { type: "parent_message"; studentName: string; messageText: string }
	| { type: "move_to_group"; studentName: string; groupName: string };

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
	// Board commands
	boardPanel: BoardPanel | null;
	setBoardPanel: (panel: BoardPanel | null) => void;
	boardOpenLast: number; // increments to signal "open last resource"
	triggerBoardOpenLast: () => void;
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
			localStorage.setItem("activeClassId", id);
		} catch {
			/* noop */
		}
	}, []);
	const [boardPanel, setBoardPanel] = useState<BoardPanel | null>(null);
	const [boardOpenLast, setBoardOpenLast] = useState(0);

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
