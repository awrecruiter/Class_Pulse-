"use client";

import {
	AlertCircleIcon,
	AlertTriangleIcon,
	ArrowRightIcon,
	CheckIcon,
	CoinsIcon,
	GraduationCapIcon,
	MessageSquareIcon,
	MicIcon,
	MinusCircleIcon,
	PlayCircleIcon,
	ShoppingBagIcon,
	Trash2Icon,
	TrophyIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { type QueueItem, useVoiceQueue } from "@/contexts/voice-queue";
import { PRODUCTION_HANDOFF_MODE_KEY, readBooleanPreference } from "@/lib/ui-prefs";

function itemIcon(item: QueueItem) {
	switch (item.data.type) {
		case "consequence":
			return <AlertTriangleIcon className="h-4 w-4 text-red-400" />;
		case "ram_bucks":
			return <TrophyIcon className="h-4 w-4 text-amber-400" />;
		case "group_coins":
			return <CoinsIcon className="h-4 w-4 text-yellow-400" />;
		case "parent_message":
			return <MessageSquareIcon className="h-4 w-4 text-violet-400" />;
		case "move_to_group":
			return <UsersIcon className="h-4 w-4 text-cyan-400" />;
		case "behavior_log":
			return <AlertCircleIcon className="h-4 w-4 text-orange-400" />;
		case "ram_bucks_deduct":
			return <MinusCircleIcon className="h-4 w-4 text-red-400" />;
		case "clear_group":
			return <Trash2Icon className="h-4 w-4 text-red-400" />;
		case "start_session":
		case "end_session":
			return <PlayCircleIcon className="h-4 w-4 text-emerald-400" />;
		case "open_store":
		case "close_store":
			return <ShoppingBagIcon className="h-4 w-4 text-amber-400" />;
		case "start_lecture":
		case "stop_lecture":
			return <MicIcon className="h-4 w-4 text-blue-400" />;
		case "navigate":
			return <ArrowRightIcon className="h-4 w-4 text-slate-400" />;
		case "ask_coach":
			return <GraduationCapIcon className="h-4 w-4 text-indigo-400" />;
		case "show_schedule":
		case "open_doc":
			return <ArrowRightIcon className="h-4 w-4 text-slate-400" />;
		case "create_class":
		case "open_class":
			return <UsersIcon className="h-4 w-4 text-indigo-400" />;
		case "export_gradebook":
			return <ArrowRightIcon className="h-4 w-4 text-emerald-400" />;
		case "approve_purchase":
			return <CheckIcon className="h-4 w-4 text-emerald-400" />;
		case "reject_purchase":
			return <XIcon className="h-4 w-4 text-red-400" />;
		case "draft_parent_message":
		case "send_parent_message":
			return <MessageSquareIcon className="h-4 w-4 text-violet-400" />;
	}
}

function itemLabel(item: QueueItem): string {
	const d = item.data;
	switch (d.type) {
		case "consequence":
			return `${d.stepLabel} → ${d.studentName}`;
		case "ram_bucks":
			return `+${d.amount} RAM Bucks → ${d.studentName}`;
		case "group_coins":
			return `+${d.amount} coins → ${d.group} group`;
		case "parent_message":
			return `Message to ${d.studentName}'s parent`;
		case "move_to_group":
			return `Move ${d.studentName} → ${d.groupName} group`;
		case "behavior_log":
			return `Log behavior — ${d.studentName}`;
		case "ram_bucks_deduct":
			return `-${d.amount} RAM Bucks — ${d.studentName}`;
		case "clear_group":
			return `Clear ${d.groupName} group`;
		case "start_session":
			return "Start class session";
		case "end_session":
			return "End class session";
		case "open_store":
			return "Open the store";
		case "close_store":
			return "Close the store";
		case "start_lecture":
			return "Start lecture recording";
		case "stop_lecture":
			return "Stop lecture recording";
		case "navigate":
			return `Go to ${d.destination}`;
		case "ask_coach":
			return `Ask coach: "${d.question.slice(0, 40)}${d.question.length > 40 ? "\u2026" : ""}"`;
		case "show_schedule":
			return "Show today's schedule";
		case "open_doc":
			return `Open doc: ${d.label}`;
		case "create_class":
			return `Create class: ${d.label}`;
		case "open_class":
			return `Open class: ${d.className}`;
		case "export_gradebook":
			return "Export gradebook CSV";
		case "approve_purchase":
			return `Approve purchase${d.studentName ? ` for ${d.studentName}` : ""}`;
		case "reject_purchase":
			return `Reject purchase${d.studentName ? ` for ${d.studentName}` : ""}`;
		case "draft_parent_message":
			return `Draft parent message for ${d.studentName}`;
		case "send_parent_message":
			return `Send parent message for ${d.studentName}`;
		default:
			return `Heard: "${item.transcript}"`;
	}
}

function itemSub(item: QueueItem): string {
	const d = item.data;
	if (d.type === "parent_message") return `"${d.messageText}"`;
	if (d.type === "behavior_log") return d.notes;
	if (d.type === "ram_bucks_deduct") return d.reason;
	if (d.type === "approve_purchase" || d.type === "reject_purchase")
		return [d.studentName, d.itemName].filter(Boolean).join(" • ") || `Heard: "${item.transcript}"`;
	if (d.type === "draft_parent_message" || d.type === "send_parent_message") return d.messageText;
	return `Heard: "${item.transcript}"`;
}

interface QueueDrawerProps {
	open: boolean;
	onClose: () => void;
	onExecute: (item: QueueItem) => void;
}

export function QueueDrawer({ open, onClose, onExecute }: QueueDrawerProps) {
	const { queue, dismiss, dismissAll } = useVoiceQueue();
	const [handoffMode, setHandoffMode] = useState(false);

	useEffect(() => {
		function syncPrefs() {
			setHandoffMode(readBooleanPreference(PRODUCTION_HANDOFF_MODE_KEY, false));
		}
		syncPrefs();
		window.addEventListener("storage", syncPrefs);
		window.addEventListener("toast-visibility-changed", syncPrefs);
		return () => {
			window.removeEventListener("storage", syncPrefs);
			window.removeEventListener("toast-visibility-changed", syncPrefs);
		};
	}, []);

	if (!open || handoffMode) return null;

	return (
		<>
			{/* Backdrop */}
			<button
				type="button"
				aria-label="Close"
				className="fixed inset-0 z-40 bg-black/50 cursor-default"
				onClick={onClose}
			/>

			{/* Drawer */}
			<div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
					<div className="flex items-center gap-2">
						<MicIcon className="h-4 w-4 text-violet-400" />
						<h2 className="text-sm font-semibold text-slate-100">Voice Queue</h2>
						{queue.length > 0 && (
							<span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold">
								{queue.length}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						{queue.length > 0 && (
							<button
								type="button"
								onClick={dismissAll}
								className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-slate-800"
							>
								Clear all
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
						>
							<XIcon className="h-4 w-4" />
						</button>
					</div>
				</div>

				{/* Queue items */}
				<div className="flex-1 overflow-y-auto p-4 space-y-3">
					{queue.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
							<MicIcon className="h-8 w-8" />
							<p className="text-sm text-center">
								No pending commands.
								<br />
								Say something like
								<br />
								<span className="text-slate-400 italic">"give Marcus a warning"</span>
							</p>
						</div>
					) : (
						queue.map((item) => (
							<div
								key={item.id}
								className="flex items-start gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700"
							>
								<div className="mt-0.5 shrink-0">{itemIcon(item)}</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-slate-200">{itemLabel(item)}</p>
									<p className="text-xs text-slate-500 mt-0.5 truncate">{itemSub(item)}</p>
								</div>
								<div className="flex items-center gap-1.5 shrink-0">
									<button
										type="button"
										onClick={() => onExecute(item)}
										className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-colors"
									>
										<CheckIcon className="h-3 w-3" />
										Send
									</button>
									<button
										type="button"
										onClick={() => dismiss(item.id)}
										className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-700 transition-colors"
									>
										<XIcon className="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						))
					)}
				</div>

				{/* Footer hint */}
				<div className="px-5 py-3 border-t border-slate-800 shrink-0">
					<p className="text-[11px] text-slate-700 text-center">
						Commands are queued — nothing sends until you tap Send
					</p>
				</div>
			</div>
		</>
	);
}
