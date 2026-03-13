"use client";

import {
	ActivityIcon,
	ChevronLeftIcon,
	ClipboardCheckIcon,
	CoinsIcon,
	FolderOpenIcon,
	GlobeIcon,
	GraduationCapIcon,
	MicIcon,
	MicOffIcon,
	RadioIcon,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useVoiceQueue } from "@/contexts/voice-queue";

export type BoardPanel = "portal" | "resources" | "pulse" | "groups";

interface SideStripProps {
	activePanel: BoardPanel;
	onPanelChange: (panel: BoardPanel) => void;
	isListening: boolean;
	onToggleMic: () => void;
	wordCount: number;
	attendanceUrl?: string;
	onHide: () => void;
}

function QueueBadgeButton() {
	const { queue, setDrawerOpen } = useVoiceQueue();
	const count = queue.length;
	return (
		<button
			type="button"
			onClick={() => setDrawerOpen(true)}
			className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
				count > 0
					? "bg-violet-500/15 text-violet-400 hover:bg-violet-500/25"
					: "text-slate-600 hover:text-slate-400 hover:bg-slate-800"
			}`}
			title="Voice queue"
		>
			<MicIcon className="h-4 w-4" />
			<span className="text-[9px] mt-0.5 font-medium">Queue</span>
			{count > 0 && (
				<span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center">
					{count}
				</span>
			)}
		</button>
	);
}

const PANELS: { id: BoardPanel; label: string; icon: React.ElementType; color: string }[] = [
	{ id: "portal", label: "Portal", icon: GlobeIcon, color: "text-indigo-400" },
	{ id: "resources", label: "Files", icon: FolderOpenIcon, color: "text-violet-400" },
	{ id: "pulse", label: "Pulse", icon: ActivityIcon, color: "text-amber-400" },
	{ id: "groups", label: "Groups", icon: CoinsIcon, color: "text-amber-400" },
];

export function SideStrip({
	activePanel,
	onPanelChange,
	isListening,
	onToggleMic,
	wordCount: _wordCount,
	attendanceUrl,
	onHide,
}: SideStripProps) {
	const { commandsEnabled, toggleCommands } = useVoiceQueue();
	const now = new Date();
	const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

	return (
		<aside className="flex flex-col items-center w-[72px] shrink-0 bg-slate-900 border-r border-slate-800 py-3 gap-1 overflow-hidden">
			{/* Back to coach */}
			<Link
				href="/coach"
				className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors mb-1"
				title="Back to Coach"
			>
				<GraduationCapIcon className="h-5 w-5" />
				<span className="text-[9px] mt-0.5 font-medium">Coach</span>
			</Link>

			<div className="w-8 h-px bg-slate-800" />

			{/* Mic toggle */}
			<button
				type="button"
				onClick={onToggleMic}
				className={`relative flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-colors ${
					isListening
						? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
						: "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
				}`}
				title={isListening ? "Mic on — tap to stop" : "Tap to start listening"}
			>
				{isListening && (
					<span className="absolute inset-0 rounded-xl ring-2 ring-emerald-500/50 animate-pulse" />
				)}
				{isListening ? <MicIcon className="h-5 w-5" /> : <MicOffIcon className="h-5 w-5" />}
				<span className="text-[9px] mt-0.5 font-medium">{isListening ? "ON" : "Off"}</span>
			</button>

			{/* Command toggle */}
			<button
				type="button"
				onClick={toggleCommands}
				className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
					commandsEnabled
						? "bg-violet-500/15 text-violet-400 hover:bg-violet-500/25"
						: "text-slate-600 hover:text-slate-400 hover:bg-slate-800"
				}`}
				title={commandsEnabled ? "Voice commands on" : "Voice commands off"}
			>
				<RadioIcon className={`h-4 w-4 ${commandsEnabled ? "animate-pulse" : ""}`} />
				<span className="text-[9px] mt-0.5 font-medium">Command</span>
			</button>

			<div className="w-8 h-px bg-slate-800 mt-1" />

			{/* Panel nav */}
			<div className="flex flex-col items-center gap-1 mt-1 flex-1">
				{PANELS.map(({ id, label, icon: Icon, color }) => {
					const active = activePanel === id;
					return (
						<button
							key={id}
							type="button"
							onClick={() => onPanelChange(id)}
							className={`relative flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-colors ${
								active
									? "bg-slate-800 text-slate-100"
									: "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
							}`}
							title={label}
						>
							{active && (
								<span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-indigo-400 rounded-r" />
							)}
							<Icon className={`h-5 w-5 ${active ? color : ""}`} />
							<span className="text-[9px] mt-0.5 font-medium">{label}</span>
						</button>
					);
				})}
			</div>

			{/* Bottom: queue + clock + attendance + hide */}
			<div className="flex flex-col items-center gap-2 mt-auto">
				<QueueBadgeButton />
				{attendanceUrl && (
					<a
						href={attendanceUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
						title="Open attendance system"
					>
						<ClipboardCheckIcon className="h-5 w-5" />
						<span className="text-[9px] mt-0.5 font-medium">Attend</span>
					</a>
				)}
				<div className="text-[10px] text-slate-600 font-mono tabular-nums">{time}</div>
				<button
					type="button"
					onClick={onHide}
					className="flex flex-col items-center justify-center w-12 h-10 rounded-xl text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
					title="Hide sidebar"
				>
					<ChevronLeftIcon className="h-4 w-4" />
					<span className="text-[9px] mt-0.5 font-medium">Hide</span>
				</button>
			</div>
		</aside>
	);
}
