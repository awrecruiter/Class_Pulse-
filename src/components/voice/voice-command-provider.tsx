"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { VoiceAction } from "@/app/api/coach/voice-agent/route";
import type { QueueItem } from "@/contexts/voice-queue";
import { useVoiceQueue } from "@/contexts/voice-queue";
import type { BoardCommand } from "@/hooks/use-board-voice";
import { useGlobalVoiceCommands } from "@/hooks/use-global-voice-commands";
import {
	readBooleanPreference,
	TOASTS_ENABLED_KEY,
	VOICE_DEBUG_FEEDBACK_ENABLED_KEY,
} from "@/lib/ui-prefs";
import {
	getVoiceSurface,
	getVoiceSurfaceSummary,
	matchNavigationDestination,
} from "@/lib/voice/registry";
import { QueueDrawer } from "./queue-drawer";

export function VoiceCommandProvider({ children }: { children: React.ReactNode }) {
	const {
		enqueue,
		confirm,
		dismiss,
		commandsEnabled,
		setCommandsEnabled,
		drawerOpen,
		setDrawerOpen,
		setMicActive,
		lectureMicActive,
		commsDictating,
		activeClassId,
		setBoardPanel,
		triggerBoardOpenLast,
		registerCommandStopper,
		agentThinking,
		setAgentThinking,
		setScheduleOverlayOpen,
	} = useVoiceQueue();

	// Keep a stable ref to activeClassId so async callbacks always see the latest
	const activeClassIdRef = useRef(activeClassId);
	useEffect(() => {
		activeClassIdRef.current = activeClassId;
	}, [activeClassId]);

	// Suppress unused-variable lint — agentThinking is consumed by nav-bar via context
	void agentThinking;

	// ── Schedule doc open mode + voice nav mode + voice app open mode ───────────
	// Read from localStorage immediately (no async wait) so ref is ready before first command
	const scheduleDocOpenModeRef = useRef<"toast" | "new-tab">(
		((typeof window !== "undefined"
			? localStorage.getItem("voiceSettings.scheduleDocOpenMode")
			: null) as "toast" | "new-tab") ?? "toast",
	);
	const voiceNavModeRef = useRef<"immediate" | "toast">(
		((typeof window !== "undefined" ? localStorage.getItem("voiceSettings.voiceNavMode") : null) as
			| "immediate"
			| "toast") ?? "toast",
	);
	const voiceAppOpenModeRef = useRef<"immediate" | "confirm">(
		((typeof window !== "undefined"
			? localStorage.getItem("voiceSettings.voiceAppOpenMode")
			: null) as "immediate" | "confirm") ?? "immediate",
	);
	const [_scheduleDocOpenMode, setScheduleDocOpenMode] = useState<"toast" | "new-tab">(
		scheduleDocOpenModeRef.current,
	);
	const [_voiceNavMode, setVoiceNavMode] = useState<"immediate" | "toast">(voiceNavModeRef.current);
	const [pendingExternalOpen, setPendingExternalOpen] = useState<{
		label: string;
		href: string;
	} | null>(null);
	// NOTE: do NOT sync refs from state on render (scheduleDocOpenModeRef.current = scheduleDocOpenMode).
	// Render-time overwrites race against direct ref assignments in event listeners and init effect.
	// Refs are updated only by: (1) init (localStorage), (2) init effect (API), (3) event listeners.
	useEffect(() => {
		fetch("/api/teacher-settings")
			.then((r) => (r.ok ? r.json() : { settings: {} }))
			.then((j) => {
				if (j.settings?.scheduleDocOpenMode) {
					const v = j.settings.scheduleDocOpenMode as "toast" | "new-tab";
					scheduleDocOpenModeRef.current = v;
					setScheduleDocOpenMode(v);
					localStorage.setItem("voiceSettings.scheduleDocOpenMode", v);
				}
				if (j.settings?.voiceNavMode) {
					const v = j.settings.voiceNavMode as "immediate" | "toast";
					voiceNavModeRef.current = v;
					setVoiceNavMode(v);
					localStorage.setItem("voiceSettings.voiceNavMode", v);
				}
				if (j.settings?.voiceAppOpenMode) {
					const v = j.settings.voiceAppOpenMode as "immediate" | "confirm";
					voiceAppOpenModeRef.current = v;
					localStorage.setItem("voiceSettings.voiceAppOpenMode", v);
				}
			})
			.catch(() => {});
	}, []);

	// Listen for live setting changes dispatched by the settings page (same tab, no remount needed)
	useEffect(() => {
		function handleNavModeChange(e: Event) {
			const v = (e as CustomEvent<{ voiceNavMode: "immediate" | "toast" }>).detail.voiceNavMode;
			// Update ref directly — instant, no re-render needed before next voice command fires
			voiceNavModeRef.current = v;
			setVoiceNavMode(v);
		}
		function handleDocOpenModeChange(e: Event) {
			const v = (e as CustomEvent<{ scheduleDocOpenMode: "toast" | "new-tab" }>).detail
				.scheduleDocOpenMode;
			scheduleDocOpenModeRef.current = v;
			setScheduleDocOpenMode(v);
		}
		function handleAppOpenModeChange(e: Event) {
			const v = (e as CustomEvent<{ voiceAppOpenMode: "immediate" | "confirm" }>).detail
				.voiceAppOpenMode;
			voiceAppOpenModeRef.current = v;
		}
		window.addEventListener("voice-nav-mode-changed", handleNavModeChange);
		window.addEventListener("schedule-doc-open-mode-changed", handleDocOpenModeChange);
		window.addEventListener("voice-app-open-mode-changed", handleAppOpenModeChange);
		return () => {
			window.removeEventListener("voice-nav-mode-changed", handleNavModeChange);
			window.removeEventListener("schedule-doc-open-mode-changed", handleDocOpenModeChange);
			window.removeEventListener("voice-app-open-mode-changed", handleAppOpenModeChange);
		};
	}, []);

	// ── Shared helpers ───────────────────────────────────────────────────────────

	// Levenshtein edit distance — used for phonetic/ethnic name fuzzy matching
	function levenshtein(a: string, b: string): number {
		const m = a.length;
		const n = b.length;
		const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
			Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
		);
		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				dp[i][j] =
					a[i - 1] === b[j - 1]
						? (dp[i - 1][j - 1] ?? 0)
						: 1 + Math.min(dp[i - 1]?.[j] ?? n, dp[i]?.[j - 1] ?? m, dp[i - 1]?.[j - 1] ?? n);
			}
		}
		return dp[m]?.[n] ?? Math.max(m, n);
	}

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

		// Exact and prefix matches first
		const exact =
			students.find((s) => s.firstName?.toLowerCase() === needle) ??
			students.find((s) => s.displayName.toLowerCase() === needle) ??
			students.find((s) => s.displayName.toLowerCase().includes(needle)) ??
			students.find((s) => needle.includes(s.displayName.toLowerCase())) ??
			students.find((s) => s.firstName?.toLowerCase().startsWith(needle)) ??
			students.find((s) => needle.startsWith(s.firstName?.toLowerCase() ?? " ")) ??
			students.find(
				(s) =>
					s.firstInitial.toLowerCase() === needle[0] &&
					s.lastInitial.toLowerCase() === (needle.split(" ").at(-1)?.[0] ?? needle[0]),
			);
		if (exact) return exact;

		// Fuzzy fallback: handles phonetic/ethnic name variants that speech recognition mishears
		// e.g. spoken "Shomara" → transcribed → roster "Xiomara" (edit distance 2)
		// Threshold: 40% of the longer name's length, minimum 2 edits allowed
		let bestStudent: (typeof students)[0] | null = null;
		let bestDist = Infinity;
		for (const s of students) {
			const candidate = (s.firstName ?? s.displayName).toLowerCase();
			const dist = levenshtein(needle, candidate);
			const threshold = Math.max(2, Math.floor(Math.max(needle.length, candidate.length) * 0.4));
			if (dist <= threshold && dist < bestDist) {
				bestDist = dist;
				bestStudent = s;
			}
		}
		return bestStudent ?? undefined;
	}

	async function resolveGroup(classId: string, name: string) {
		const res = await fetch(`/api/classes/${classId}/groups`);
		const json = await res.json();
		const needle = name
			.toLowerCase()
			.replace(/\s+group$/i, "")
			.replace(/s$/, ""); // strip " group" suffix and trailing s
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

	// ── Doc open helper ─────────────────────────────────────────────────────────

	const tryOpenExternal = useCallback((label: string, href: string) => {
		const newWin = window.open(href, "_blank", "noopener,noreferrer");
		void label;
		return !!newWin;
	}, []);

	function handleDocOpen(label: string, url: string, linkType: string, mode: "toast" | "new-tab") {
		console.log("[voice] handleDocOpen:", { label, url, linkType, mode });
		if (mode === "new-tab") {
			if (linkType === "internal") {
				window.location.href = url;
			} else {
				tryOpenExternal(label, url);
			}
		} else {
			// toast mode — matches board open_app pattern (popup blocker safe)
			if (linkType === "internal") {
				toast.success(`Go to ${label}?`, {
					duration: 8000,
					action: {
						label: "Go",
						onClick: () => {
							window.location.href = url;
						},
					},
				});
			} else {
				if (!tryOpenExternal(label, url)) {
					if (readBooleanPreference(TOASTS_ENABLED_KEY, true)) {
						toast.success(`Open ${label}?`, {
							description: `Heard: "open ${label}"`,
							duration: 8000,
							action: { label: "Open", onClick: () => window.open(url, "_blank") },
						});
					} else {
						setPendingExternalOpen({ label, href: url });
					}
				}
			}
		}
	}

	const handleNavigate = useCallback(
		(
			destination:
				| "board"
				| "classes"
				| "settings"
				| "coach"
				| "store"
				| "gradebook"
				| "parent-comms",
		) => {
			const href = `/${destination}`;
			if (voiceNavModeRef.current === "toast") {
				toast.success(`Go to ${destination}?`, {
					duration: 8000,
					action: {
						label: "Go",
						onClick: () => {
							window.location.href = href;
						},
					},
				});
				return;
			}
			window.location.href = href;
		},
		[],
	);

	// ── Incoming voice command handler ───────────────────────────────────────────

	// biome-ignore lint/correctness/useExhaustiveDependencies: setScheduleOverlayOpen, scheduleDocOpenMode, and voiceNavMode are stable state values; including them would cause rebuilds on every render
	const handleCommand = useCallback((data: Parameters<typeof enqueue>[0], transcript: string) => {
		// move_to_group: execute immediately
		if (data.type === "move_to_group") {
			executeMoveToGroupRef.current(data.studentName, data.groupName);
			return;
		}

		// navigate: always immediate — window.location.href is internal routing, no popup blocker concern
		if (data.type === "navigate") {
			console.log("[voice] handleCommand navigate:", data.destination);
			handleNavigate(data.destination);
			return;
		}

		// show_schedule: open overlay immediately
		if (data.type === "show_schedule") {
			setScheduleOverlayOpen(true);
			return;
		}

		// show_groups: open the coach groups surface immediately
		if (data.type === "show_groups") {
			window.dispatchEvent(new CustomEvent("voice-show_groups"));
			return;
		}

		// open_doc: open document via toast or new tab
		// Internal URLs (start with "/") always navigate immediately — voice commands are already confirmed by speech
		if (data.type === "open_doc") {
			if (data.url.startsWith("/")) {
				window.location.href = data.url;
				return;
			}
			handleDocOpen(data.label, data.url, "url", scheduleDocOpenModeRef.current);
			return;
		}

		if (data.type === "parent_message") {
			enqueue(data, transcript);
			return;
		}

		if (data.type === "create_class") {
			window.dispatchEvent(
				new CustomEvent("voice-create_class", { detail: { label: data.label } }),
			);
			return;
		}

		if (data.type === "open_class") {
			window.dispatchEvent(
				new CustomEvent("voice-open_class", { detail: { className: data.className } }),
			);
			return;
		}

		if (data.type === "export_gradebook") {
			window.dispatchEvent(
				new CustomEvent("voice-export_gradebook", {
					detail: { from: data.from, to: data.to },
				}),
			);
			return;
		}

		if (data.type === "approve_purchase" || data.type === "reject_purchase") {
			window.dispatchEvent(
				new CustomEvent(`voice-${data.type}`, {
					detail: { studentName: data.studentName, itemName: data.itemName },
				}),
			);
			return;
		}

		if (data.type === "draft_parent_message" || data.type === "send_parent_message") {
			enqueue(data, transcript);
			return;
		}

		// All other commands: execute immediately via ref — no queue, no confirmation
		const item: QueueItem = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
			data,
			transcript,
			createdAt: Date.now(),
		};
		executeCommandRef.current(item);
	}, []);

	// ── Board commands — execute immediately, no queue ───────────────────────────
	const handleBoardCommand = useCallback(
		(cmd: BoardCommand, transcript: string) => {
			if (cmd.type === "open_app") {
				if (voiceAppOpenModeRef.current === "confirm") {
					if (!tryOpenExternal(cmd.label, cmd.href)) {
						if (readBooleanPreference(TOASTS_ENABLED_KEY, true)) {
							toast.success(`Open ${cmd.label}?`, {
								description: `Heard: "${transcript}"`,
								duration: 8000,
								action: { label: "Open", onClick: () => window.open(cmd.href, "_blank") },
							});
						} else {
							setPendingExternalOpen({ label: cmd.label, href: cmd.href });
						}
					}
				} else {
					if (!tryOpenExternal(cmd.label, cmd.href)) {
						// Popup blocked — fall back to toast so the teacher can still open it
						toast.success(`Open ${cmd.label}?`, {
							description: `Heard: "${transcript}"`,
							duration: 8000,
							action: { label: "Open", onClick: () => window.open(cmd.href, "_blank") },
						});
					}
				}
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
		[setBoardPanel, triggerBoardOpenLast, tryOpenExternal],
	);

	// ── Voice agent context cache (refreshed every 30s, not per-utterance) ─────────

	type AgentContext = {
		students: Array<{ rosterId: string; displayName: string; firstName: string | null }>;
		groups: Array<{ id: string; name: string }>;
		storeIsOpen: boolean;
		scheduleBlocks: Array<{ title: string; docs: Array<{ label: string; url: string }> }>;
	};
	const agentContextRef = useRef<AgentContext>({
		students: [],
		groups: [],
		storeIsOpen: false,
		scheduleBlocks: [],
	});
	const contextLastFetchedRef = useRef<{ classId: string; ts: number } | null>(null);
	const CONTEXT_TTL = 30_000; // 30 seconds

	const refreshAgentContext = useCallback(async (classId: string) => {
		const now = Date.now();
		const last = contextLastFetchedRef.current;
		if (last && last.classId === classId && now - last.ts < CONTEXT_TTL) return; // still fresh
		contextLastFetchedRef.current = { classId, ts: now };
		try {
			const today = new Date();
			const [studentsRes, groupsRes, settingsRes, scheduleRes] = await Promise.all([
				fetch(`/api/classes/${classId}/roster-overview`),
				fetch(`/api/classes/${classId}/groups`),
				fetch("/api/teacher-settings"),
				fetch(`/api/schedule?day=${today.getDay()}&date=${today.toISOString().slice(0, 10)}`),
			]);
			const students = studentsRes.ok
				? ((await studentsRes.json()).students ?? [])
				: agentContextRef.current.students;
			const groups = groupsRes.ok
				? ((await groupsRes.json()).groups ?? [])
				: agentContextRef.current.groups;
			const settings = settingsRes.ok ? (await settingsRes.json()).settings : {};
			const scheduleData = scheduleRes.ok ? await scheduleRes.json() : { blocks: [] };
			agentContextRef.current = {
				students,
				groups,
				storeIsOpen: settings?.storeIsOpen ?? false,
				scheduleBlocks: (scheduleData.blocks ?? []).map(
					(b: { title: string; docs: Array<{ label: string; url: string }> }) => ({
						title: b.title,
						docs: b.docs ?? [],
					}),
				),
			};
		} catch {
			// keep stale context on error
		}
	}, []);

	// Invalidate context cache when group assignments change
	useEffect(() => {
		function invalidate() {
			contextLastFetchedRef.current = null;
		}
		window.addEventListener("group-assignment-changed", invalidate);
		return () => window.removeEventListener("group-assignment-changed", invalidate);
	}, []);

	// ── Voice agent caller ────────────────────────────────────────────────────────

	const callVoiceAgent = useCallback(
		async (transcript: string) => {
			const classId = activeClassIdRef.current;

			// Fast-path: navigate commands don't need AI — regex is instant, reliable, and not rate-limited
			const dest = matchNavigationDestination(transcript);
			if (dest) {
				handleNavigate(dest);
				return;
			}

			// Fast-path: move_to_group — regex is instant and reliable, no AI or network needed
			// Handles: "move/put/add/assign/place [name] to/into [the] [group] [group]"
			const moveMatch = transcript
				.trim()
				.match(
					/\b(?:put|move|add|place|assign)\s+(\w+)\s+(?:in(?:to)?|to)\s+(?:the\s+)?(\w+)(?:\s+group)?\b/i,
				);
			if (moveMatch) {
				const skipWords = ["a", "an", "the", "his", "her", "my", "their", "this", "that"];
				const rawGroup = moveMatch[2];
				if (!skipWords.includes(rawGroup.toLowerCase()) && rawGroup.length > 1) {
					executeMoveToGroupRef.current(moveMatch[1], rawGroup);
					return;
				}
			}

			// Fast-path: give/award [name] [amount] (ram) bucks
			// Handles mishearings: "books", "box", "bugs", "bus", "bux" all treated as "bucks"
			const WORD_TO_NUM: Record<string, number> = {
				one: 1,
				two: 2,
				three: 3,
				four: 4,
				five: 5,
				six: 6,
				seven: 7,
				eight: 8,
				nine: 9,
				ten: 10,
				eleven: 11,
				twelve: 12,
				fifteen: 15,
				twenty: 20,
				thirty: 30,
				forty: 40,
				fifty: 50,
				hundred: 100,
			};
			const NUM_WORDS =
				"\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred";
			const BUCKS_WORDS = "bucks?|books?|box|bugs?|bux|bus";
			// Pattern 1: "give/award/add [name] [amount] (ram) bucks"
			const ramAwardMatch = transcript
				.trim()
				.match(
					new RegExp(
						`\\b(?:give|award|add)\\s+(\\w+)\\s+(${NUM_WORDS})\\s+(?:\\w+\\s+)?(?:${BUCKS_WORDS})\\b`,
						"i",
					),
				);
			// Pattern 2: "[name] [amount] (ram) bucks" — no trigger word (e.g. "Darius five Ram books")
			const ramAwardMatchAlt =
				!ramAwardMatch &&
				transcript
					.trim()
					.match(new RegExp(`^(\\w+)\\s+(${NUM_WORDS})\\s+(?:ram\\s+)?(?:${BUCKS_WORDS})\\b`, "i"));
			// Pattern 3: "[trigger] [amount] (ram) bucks to [name]" (e.g. "give five Rand bucks to Kamari")
			const ramAwardMatchTo =
				!ramAwardMatch &&
				!ramAwardMatchAlt &&
				transcript
					.trim()
					.match(
						new RegExp(
							`\\b(?:give|award|add)\\s+(${NUM_WORDS})\\s+(?:\\w+\\s+)?(?:${BUCKS_WORDS})\\s+to\\s+(\\w+)\\b`,
							"i",
						),
					);
			// For pattern 3 the capture groups are swapped: [1]=amount [2]=name — normalise below
			const ramAwardResult =
				ramAwardMatch ??
				ramAwardMatchAlt ??
				(ramAwardMatchTo ? [ramAwardMatchTo[0], ramAwardMatchTo[2], ramAwardMatchTo[1]] : null);
			if (ramAwardResult) {
				const rawAmt = ramAwardResult[2].toLowerCase();
				const amount = Number.parseInt(rawAmt, 10) || WORD_TO_NUM[rawAmt] || 0;
				if (amount > 0) {
					handleCommand({ type: "ram_bucks", studentName: ramAwardResult[1], amount }, transcript);
					return;
				}
			}

			// Fast-path: take/deduct/remove [amount] (ram) bucks from [name]
			const ramDeductMatch = transcript
				.trim()
				.match(
					/\b(?:take|deduct|remove|subtract|fine)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\s+(?:ram\s+)?(?:bucks?|books?)\s+(?:from\s+)?(\w+)\b/i,
				);
			if (ramDeductMatch) {
				const rawAmt = ramDeductMatch[1].toLowerCase();
				const amount = Number.parseInt(rawAmt, 10) || WORD_TO_NUM[rawAmt] || 0;
				if (amount > 0) {
					handleCommand(
						{
							type: "ram_bucks_deduct",
							studentName: ramDeductMatch[2],
							amount,
							reason: "Voice command",
						},
						transcript,
					);
					return;
				}
			}

			// Fast-path: give/award/add [the] [group] [N] coins
			// e.g. "give the dogs two coins", "award cats five coins"
			const groupCoinsMatch = transcript
				.trim()
				.match(
					new RegExp(
						`\\b(?:give|award|add)\\s+(?:the\\s+)?(\\w+)\\s+(${NUM_WORDS})\\s+coins?\\b`,
						"i",
					),
				);
			// Also handle: "give [N] coins to [the] [group]"
			const groupCoinsToMatch =
				!groupCoinsMatch &&
				transcript
					.trim()
					.match(
						new RegExp(
							`\\b(?:give|award|add)\\s+(${NUM_WORDS})\\s+coins?\\s+to\\s+(?:the\\s+)?(\\w+)\\b`,
							"i",
						),
					);
			const gcRaw = groupCoinsMatch
				? { group: groupCoinsMatch[1], amtStr: groupCoinsMatch[2] }
				: groupCoinsToMatch
					? { group: groupCoinsToMatch[2], amtStr: groupCoinsToMatch[1] }
					: null;
			if (gcRaw) {
				const amount =
					Number.parseInt(gcRaw.amtStr, 10) || WORD_TO_NUM[gcRaw.amtStr.toLowerCase()] || 0;
				if (amount > 0) {
					handleCommand({ type: "group_coins", group: gcRaw.group, amount }, transcript);
					return;
				}
			}

			setAgentThinking(true);
			try {
				// Refresh context cache (no-op if still fresh — prevents rate limit hammering)
				if (classId) await refreshAgentContext(classId);
				const ctx = agentContextRef.current;

				const res = await fetch("/api/coach/voice-agent", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						transcript,
						context: {
							surfaceId: getVoiceSurface(window.location.pathname)?.id,
							surfaceLabel: getVoiceSurface(window.location.pathname)?.label,
							surfaceCommands: getVoiceSurfaceSummary(window.location.pathname),
							students: ctx.students.map((s) => ({
								rosterId: s.rosterId,
								displayName: s.displayName,
								firstName: s.firstName,
							})),
							groups: ctx.groups.map((g) => ({ id: g.id, name: g.name })),
							hasActiveSession: false,
							storeIsOpen: ctx.storeIsOpen,
							isLectureActive: false,
							scheduleBlocks: ctx.scheduleBlocks,
						},
					}),
				});

				if (!res.ok) {
					toast.error("Voice agent unavailable");
					return;
				}
				const { action } = (await res.json()) as { action: VoiceAction };
				if (action.type === "ignore") {
					if (readBooleanPreference(VOICE_DEBUG_FEEDBACK_ENABLED_KEY, false)) {
						toast.info("Didn't catch a command");
					}
					return;
				}

				// Fan out comma-separated studentName into one command per student
				if (
					"studentName" in action &&
					typeof action.studentName === "string" &&
					action.studentName.includes(",")
				) {
					const names = action.studentName
						.split(",")
						.map((n) => n.trim())
						.filter(Boolean);
					for (const name of names) {
						handleCommand({ ...action, studentName: name }, transcript);
					}
				} else {
					handleCommand(action, transcript);
				}
			} catch {
				toast.error("Voice command failed — check your connection");
			} finally {
				setAgentThinking(false);
			}
		},
		[setAgentThinking, handleCommand, refreshAgentContext, handleNavigate],
	);

	const callVoiceAgentRef = useRef(callVoiceAgent);
	useEffect(() => {
		callVoiceAgentRef.current = callVoiceAgent;
	}, [callVoiceAgent]);

	// Listen for orb-transcript events (orb push-to-talk routes through agent)
	useEffect(() => {
		function handleOrbTranscript(e: Event) {
			const transcript = (e as CustomEvent<{ transcript: string }>).detail.transcript;
			callVoiceAgentRef.current(transcript);
		}
		window.addEventListener("orb-transcript", handleOrbTranscript);
		return () => window.removeEventListener("orb-transcript", handleOrbTranscript);
	}, []);

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
					window.dispatchEvent(new CustomEvent("ram-bucks-updated"));
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
				} else if (d.type === "behavior_log") {
					const student = await resolveStudent(classId, d.studentName);
					if (!student) {
						toast.error(`Student "${d.studentName}" not found on roster`);
						dismiss(item.id);
						return;
					}
					const res = await fetch(`/api/classes/${classId}/behavior/incident`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ rosterId: student.rosterId, notes: d.notes }),
					});
					if (!res.ok) throw new Error("Failed");
					toast.success(`Behavior logged for ${d.studentName}`);
					confirm(item.id);
				} else if (d.type === "ram_bucks_deduct") {
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
							amount: -Math.abs(d.amount),
							type: "manual-deduct",
							reason: d.reason,
						}),
					});
					if (!res.ok) throw new Error("Failed");
					toast.success(`-${d.amount} RAM Bucks from ${d.studentName}`);
					window.dispatchEvent(new CustomEvent("ram-bucks-updated"));
					confirm(item.id);
				} else if (d.type === "clear_group") {
					const groupRes = await fetch(`/api/classes/${classId}/groups`);
					const groupJson = await groupRes.json();
					const target = (
						groupJson.groups as Array<{
							id: string;
							name: string;
							members: { rosterId: string }[];
						}>
					).find((g) => g.name.toLowerCase() === d.groupName.toLowerCase());
					if (!target) {
						toast.error(`Group "${d.groupName}" not found`);
						dismiss(item.id);
						return;
					}
					if (target.members?.length) {
						await Promise.all(
							target.members.map((m) =>
								fetch(`/api/classes/${classId}/groups/${target.id}`, {
									method: "DELETE",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ rosterId: m.rosterId }),
								}),
							),
						);
					}
					toast.success(`${d.groupName} group cleared`);
					window.dispatchEvent(new CustomEvent("group-assignment-changed"));
					confirm(item.id);
				} else if (d.type === "open_store") {
					await fetch("/api/teacher-settings", {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ storeIsOpen: true }),
					});
					toast.success("Store is now open");
					confirm(item.id);
				} else if (d.type === "close_store") {
					const current = await fetch("/api/teacher-settings").then((r) => r.json());
					await fetch("/api/teacher-settings", {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ ...(current.settings ?? {}), storeIsOpen: false }),
					});
					toast.success("Store is now closed");
					confirm(item.id);
				} else if (
					d.type === "start_session" ||
					d.type === "end_session" ||
					d.type === "start_lecture" ||
					d.type === "stop_lecture"
				) {
					window.dispatchEvent(new CustomEvent(`voice-${d.type}`));
					const label =
						d.type === "start_session"
							? "Starting session…"
							: d.type === "end_session"
								? "Ending session…"
								: d.type === "start_lecture"
									? "Starting lecture recording…"
									: "Stopping lecture recording…";
					toast.success(label);
					confirm(item.id);
				} else if (d.type === "navigate") {
					handleNavigate(d.destination);
					confirm(item.id);
				} else if (d.type === "ask_coach") {
					window.dispatchEvent(
						new CustomEvent("voice-ask-coach", { detail: { question: d.question } }),
					);
					confirm(item.id);
				}
			} catch {
				toast.error("Command failed — check your connection");
			}
		},
		[confirm, dismiss],
	);

	const executeCommandRef = useRef(executeCommand);
	useEffect(() => {
		executeCommandRef.current = executeCommand;
	}, [executeCommand]);

	const { isListening, stop: stopGlobalNow } = useGlobalVoiceCommands({
		onBoardCommand: handleBoardCommand,
		onError: (error) => {
			if (error === "no-speech") return;
			if (error === "aborted") {
				setCommandsEnabled(false);
				toast.error("Voice commands were stopped by the browser — tap Command to re-enable them");
				return;
			}
			if (error === "not-supported") {
				toast.error("Voice commands are not supported in this browser");
				return;
			}
			if (error === "not-allowed" || error === "service-not-allowed") {
				toast.error("Microphone access is blocked — allow mic access in your browser");
				return;
			}
			if (error === "audio-capture") {
				toast.error("No microphone found");
				return;
			}
			if (error === "network") {
				toast.error("Speech recognition lost connection");
				return;
			}
			if (error === "start-failed") {
				toast.error(
					"Voice commands could not start — refresh the page and allow microphone access",
				);
				return;
			}
			toast.error(`Voice commands failed: ${error}`);
		},
		onVoiceTranscript: callVoiceAgent,
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
			{pendingExternalOpen && (
				<div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
					<div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur">
						<div className="min-w-0 flex-1">
							<p className="text-sm font-semibold text-slate-100">
								Open {pendingExternalOpen.label}?
							</p>
							<p className="truncate text-xs text-slate-400">Voice command requested a new tab.</p>
						</div>
						<button
							type="button"
							onClick={() => setPendingExternalOpen(null)}
							className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
						>
							Dismiss
						</button>
						<button
							type="button"
							onClick={() => {
								window.open(pendingExternalOpen.href, "_blank");
								setPendingExternalOpen(null);
							}}
							className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
						>
							Open
						</button>
					</div>
				</div>
			)}
			<QueueDrawer
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				onExecute={executeCommand}
			/>
		</>
	);
}
