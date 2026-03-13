"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { QueueItem } from "@/contexts/voice-queue";
import { useVoiceQueue } from "@/contexts/voice-queue";
import type { BoardCommand } from "@/hooks/use-board-voice";
import { useGlobalVoiceCommands } from "@/hooks/use-global-voice-commands";
import { QueueDrawer } from "./queue-drawer";

export function VoiceCommandProvider({ children }: { children: React.ReactNode }) {
	const {
		enqueue,
		confirm,
		dismiss,
		commandsEnabled,
		drawerOpen,
		setDrawerOpen,
		setMicActive,
		lectureMicActive,
		commsDictating,
		activeClassId,
		setBoardPanel,
		triggerBoardOpenLast,
		registerCommandStopper,
	} = useVoiceQueue();

	// Keep a stable ref to activeClassId so async callbacks always see the latest
	const activeClassIdRef = useRef(activeClassId);
	useEffect(() => {
		activeClassIdRef.current = activeClassId;
	}, [activeClassId]);

	// ── Shared helpers ───────────────────────────────────────────────────────────

	async function resolveStudent(classId: string, name: string) {
		const res = await fetch(`/api/classes/${classId}/roster-overview`);
		const json = await res.json();
		const needle = name.toLowerCase();
		const students: Array<{
			firstName?: string | null;
			firstInitial: string;
			lastInitial: string;
			displayName: string;
			rosterId: string;
		}> = json.students ?? [];
		return (
			students.find((s) => s.firstName?.toLowerCase() === needle) ??
			students.find((s) => s.displayName.toLowerCase().includes(needle)) ??
			students.find((s) => s.firstName?.toLowerCase().startsWith(needle)) ??
			students.find(
				(s) =>
					s.firstInitial.toLowerCase() === needle[0] &&
					s.lastInitial.toLowerCase() === (needle[needle.length - 1] ?? needle[0]),
			)
		);
	}

	async function resolveGroup(classId: string, name: string) {
		const res = await fetch(`/api/classes/${classId}/groups`);
		const json = await res.json();
		const needle = name.toLowerCase().replace(/s$/, ""); // strip trailing s (dogs→dog)
		return (json.groups ?? []).find((g: { id: string; name: string }) => {
			const hay = g.name.toLowerCase().replace(/s$/, "");
			return hay === needle || g.name.toLowerCase() === name.toLowerCase();
		}) as { id: string } | undefined;
	}

	// ── Immediate move-to-group (no queue) ───────────────────────────────────────

	// biome-ignore lint/correctness/useExhaustiveDependencies: resolveStudent/resolveGroup are stable module-level functions; including them would cause infinite loops
	const executeMoveToGroup = useCallback(async (studentName: string, groupName: string) => {
		const classId = activeClassIdRef.current;
		toast.info(`Moving ${studentName} → ${groupName}…`, { duration: 3000 });
		if (!classId) {
			toast.error("No class selected — open Coach and pick a class first");
			return;
		}
		try {
			const student = await resolveStudent(classId, studentName);
			if (!student) {
				toast.error(`Student "${studentName}" not found on roster`);
				return;
			}
			const group = await resolveGroup(classId, groupName);
			if (!group) {
				toast.error(`Group "${groupName}" not found`);
				return;
			}
			const res = await fetch(`/api/classes/${classId}/groups/${group.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId: student.rosterId }),
			});
			if (!res.ok) throw new Error("Failed");
			toast.success(`Moved ${studentName} → ${groupName} group`);
			window.dispatchEvent(new CustomEvent("group-assignment-changed"));
		} catch {
			toast.error("Move failed — check your connection");
		}
	}, []);

	const executeMoveToGroupRef = useRef(executeMoveToGroup);
	useEffect(() => {
		executeMoveToGroupRef.current = executeMoveToGroup;
	}, [executeMoveToGroup]);

	// ── Incoming voice command handler ───────────────────────────────────────────

	const handleCommand = useCallback(
		(data: Parameters<typeof enqueue>[0], transcript: string) => {
			// move_to_group: execute immediately — no confirmation needed
			if (data.type === "move_to_group") {
				executeMoveToGroupRef.current(data.studentName, data.groupName);
				return;
			}

			enqueue(data, transcript);

			let label = "";
			switch (data.type) {
				case "consequence":
					label = `Queued: ${data.stepLabel} for ${data.studentName}`;
					break;
				case "ram_bucks":
					label = `Queued: +${data.amount} RAM Bucks for ${data.studentName}`;
					break;
				case "group_coins":
					label = `Queued: +${data.amount} coins for ${data.group}`;
					break;
				case "parent_message":
					label = `Queued: message to ${data.studentName}'s parent`;
					break;
			}

			toast.success(label, {
				description: "Tap Voice Queue to review",
				duration: 4000,
				action: { label: "Review", onClick: () => setDrawerOpen(true) },
			});
		},
		[enqueue, setDrawerOpen],
	);

	// ── Board commands — execute immediately, no queue ───────────────────────────
	const handleBoardCommand = useCallback(
		(cmd: BoardCommand, transcript: string) => {
			if (cmd.type === "open_app") {
				// window.open from speech recognition is blocked by popup blockers (not a user gesture)
				// Show a tappable toast so the teacher can confirm with a real click
				toast.success(`Open ${cmd.label}?`, {
					description: `Heard: "${transcript}"`,
					duration: 8000,
					action: { label: "Open", onClick: () => window.open(cmd.href, "_blank") },
				});
			} else if (cmd.type === "switch_panel") {
				setBoardPanel(cmd.panel);
				toast.success(`Board → ${cmd.panel}`, {
					description: `Heard: "${transcript}"`,
					duration: 2500,
				});
				if (!window.location.pathname.startsWith("/board")) {
					window.location.href = "/board";
				}
			} else if (cmd.type === "open_last_resource") {
				triggerBoardOpenLast();
				toast.success("Opening last resource", {
					description: `Heard: "${transcript}"`,
					duration: 2500,
				});
				if (!window.location.pathname.startsWith("/board")) {
					window.location.href = "/board";
				}
			}
		},
		[setBoardPanel, triggerBoardOpenLast],
	);

	// ── Execute a queued coach command via API ───────────────────────────────────
	// biome-ignore lint/correctness/useExhaustiveDependencies: resolveStudent/resolveGroup are stable module-level functions; including them would cause infinite loops
	const executeCommand = useCallback(
		async (item: QueueItem) => {
			const classId = activeClassIdRef.current;
			if (!classId) {
				toast.error("No class selected — open Coach and pick a class first");
				return;
			}

			const d = item.data;

			try {
				if (d.type === "consequence") {
					const student = await resolveStudent(classId, d.studentName);
					if (!student) {
						toast.error(`Student "${d.studentName}" not found on roster`);
						dismiss(item.id);
						return;
					}
					const res = await fetch(`/api/classes/${classId}/behavior/incident`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ rosterId: student.rosterId, step: d.step }),
					});
					if (!res.ok) throw new Error("Failed");
					toast.success(`${d.stepLabel} logged for ${d.studentName}`);
					confirm(item.id);
				} else if (d.type === "ram_bucks") {
					const student = await resolveStudent(classId, d.studentName);
					if (!student) {
						toast.error(`Student "${d.studentName}" not found on roster`);
						dismiss(item.id);
						return;
					}
					const res = await fetch(`/api/classes/${classId}/ram-bucks`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							rosterId: student.rosterId,
							amount: d.amount,
							type: "manual-award",
							reason: "Voice command",
						}),
					});
					if (!res.ok) throw new Error("Failed");
					toast.success(`+${d.amount} 🐏 RAM Bucks → ${d.studentName}`);
					confirm(item.id);
				} else if (d.type === "group_coins") {
					const group = await resolveGroup(classId, d.group);
					if (!group) {
						toast.error(`Group "${d.group}" not found`);
						dismiss(item.id);
						return;
					}
					const res = await fetch(`/api/classes/${classId}/group-accounts`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ groupId: group.id, amount: d.amount }),
					});
					if (!res.ok) throw new Error("Failed");
					toast.success(`+${d.amount} 🐏 → ${d.group} group`);
					confirm(item.id);
				} else if (d.type === "parent_message") {
					confirm(item.id);
				} else if (d.type === "move_to_group") {
					// Shouldn't reach here (executed immediately in handleCommand), but handle gracefully
					await executeMoveToGroupRef.current(d.studentName, d.groupName);
					confirm(item.id);
				}
			} catch {
				toast.error("Command failed — check your connection");
			}
		},
		[confirm, dismiss],
	);

	const { isListening, stop: stopGlobalNow } = useGlobalVoiceCommands({
		onCommand: handleCommand,
		onBoardCommand: handleBoardCommand,
		enabled: commandsEnabled && !lectureMicActive && !commsDictating,
	});
	// Register imperative stop so coach page can kill mic before startListening()
	useEffect(() => {
		registerCommandStopper(stopGlobalNow);
	}, [registerCommandStopper, stopGlobalNow]);

	useEffect(() => {
		setMicActive(isListening);
	}, [isListening, setMicActive]);

	return (
		<>
			{children}
			<QueueDrawer
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				onExecute={executeCommand}
			/>
		</>
	);
}
