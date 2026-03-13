"use client";

import {
	AlertTriangleIcon,
	CheckIcon,
	CoinsIcon,
	MessageSquareIcon,
	MicIcon,
	TrophyIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { type QueueItem, useVoiceQueue } from "@/contexts/voice-queue";

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
	}
}

function itemSub(item: QueueItem): string {
	const d = item.data;
	if (d.type === "parent_message") return `"${d.messageText}"`;
	return `Heard: "${item.transcript}"`;
}

interface QueueDrawerProps {
	open: boolean;
	onClose: () => void;
	onExecute: (item: QueueItem) => void;
}

export function QueueDrawer({ open, onClose, onExecute }: QueueDrawerProps) {
	const { queue, dismiss, dismissAll } = useVoiceQueue();

	if (!open) return null;

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
