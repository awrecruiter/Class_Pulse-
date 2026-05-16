"use client";

import {
	AlertCircleIcon,
	CalendarIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ExternalLinkIcon,
	PlayIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar";

type ScheduleDocLinkRow = {
	id: string;
	label: string;
	url: string;
	linkType: string;
};

type ScheduleBlockRow = {
	id: string;
	title: string;
	color: string;
	startTime: string;
	endTime: string;
	dayOfWeek: number | null;
	specificDate: string | null;
	sortOrder: number;
	docs: ScheduleDocLinkRow[];
};

type ProposedBlock = {
	title: string;
	startTime: string;
	endTime: string;
	dayOfWeek: number | null;
	color: string;
};

type QuestionBankItem = {
	id: string;
	resourceType: string;
	assignedDate: string | null;
	stem: string;
};

export function ScheduleManager({ activeSessionId }: { activeSessionId?: string | null }) {
	const [blocks, setBlocks] = useState<ScheduleBlockRow[]>([]);
	const [importing, setImporting] = useState(false);
	const [extractStatus, setExtractStatus] = useState<{
		type: "success" | "warning" | "error";
		msg: string;
	} | null>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const icsInputRef = useRef<HTMLInputElement>(null);
	const [todayResources, setTodayResources] = useState<Record<string, string>>({});
	const [todayQuestions, setTodayQuestions] = useState<Record<string, QuestionBankItem[]>>({});
	const [pushedIds, setPushedIds] = useState<Set<string>>(new Set());
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const [weekOffset, setWeekOffset] = useState(0);

	const fetchBlocks = useCallback(async () => {
		try {
			const res = await fetch("/api/schedule");
			const json = await res.json();
			setBlocks(json.blocks ?? []);
		} catch {
			// silent
		}
	}, []);

	useEffect(() => {
		fetchBlocks();
	}, [fetchBlocks]);

	useEffect(() => {
		const todayISO = new Date().toISOString().slice(0, 10);

		const fetchResources = () =>
			fetch("/api/resources/today")
				.then((r) => (r.ok ? r.json() : { sections: [] }))
				.then((j: { sections?: { resourceType: string; url: string }[] }) => {
					const map: Record<string, string> = {};
					for (const r of j.sections ?? []) map[r.resourceType] = r.url;
					setTodayResources(map);
				})
				.catch(() => {});

		const fetchQuestions = () =>
			fetch(`/api/questions?date=${todayISO}`)
				.then((r) => (r.ok ? r.json() : { questions: [] }))
				.then((j: { questions?: QuestionBankItem[] }) => {
					const grouped: Record<string, QuestionBankItem[]> = {};
					for (const q of j.questions ?? []) {
						if (!grouped[q.resourceType]) grouped[q.resourceType] = [];
						grouped[q.resourceType].push(q);
					}
					setTodayQuestions(grouped);
				})
				.catch(() => {});

		fetchResources();
		fetchQuestions();
		const ri = setInterval(fetchResources, 30_000);
		const qi = setInterval(fetchQuestions, 30_000);
		return () => {
			clearInterval(ri);
			clearInterval(qi);
		};
	}, []);

	function todayWeekday(): number {
		const d = new Date().getDay();
		if (d === 0) return 1;
		if (d === 6) return 5;
		return d;
	}

	async function sendNextQuestion(type: string) {
		const qs = (todayQuestions[type] ?? []).filter((q) => !pushedIds.has(q.id));
		if (!qs.length || !activeSessionId) return;
		const next = qs[0];
		const res = await fetch(`/api/sessions/${activeSessionId}/question-push`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ questionId: next.id }),
		});
		if (res.ok) {
			setPushedIds((prev) => new Set([...prev, next.id]));
			const sent = (todayQuestions[type] ?? []).length - qs.length + 1;
			toast.success(`Q${sent} sent`);
		} else {
			toast.error("Failed to push question");
		}
	}

	async function sendQuestion(questionId: string) {
		if (!activeSessionId) return;
		const res = await fetch(`/api/sessions/${activeSessionId}/question-push`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ questionId }),
		});
		if (res.ok) {
			setPushedIds((prev) => new Set([...prev, questionId]));
		} else {
			toast.error("Failed to send question");
		}
	}

	async function handlePhotoImport(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setImporting(true);
		try {
			const reader = new FileReader();
			reader.onload = async (ev) => {
				try {
					const dataUrl = ev.target?.result as string;
					const base64 = dataUrl.split(",")[1];
					const mimeType = file.type || "image/jpeg";
					const res = await fetch("/api/schedule/extract", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ type: "image", data: base64, mimeType }),
					});
					const json = await res.json();
					if (!res.ok) throw new Error(json.error || "Extraction failed");
					const extracted = json.blocks ?? [];
					if (extracted.length === 0) {
						setExtractStatus({
							type: "warning",
							msg: "No schedule blocks detected — try a different image.",
						});
					} else {
						const today = todayWeekday();
						const COLORS = [
							"blue",
							"indigo",
							"violet",
							"green",
							"emerald",
							"teal",
							"cyan",
							"red",
							"orange",
							"amber",
							"pink",
							"slate",
						] as const;
						const allSameColor = extracted.every(
							(b: ProposedBlock) => b.color === extracted[0]?.color,
						);
						const bulkRes = await fetch("/api/schedule/bulk", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								blocks: extracted.map((b: ProposedBlock, i: number) => ({
									...b,
									dayOfWeek: b.dayOfWeek ?? today,
									color: allSameColor ? COLORS[i % COLORS.length] : (b.color ?? "blue"),
								})),
							}),
						});
						if (!bulkRes.ok) {
							const bulkErr = await bulkRes.json();
							throw new Error(bulkErr.error || "Bulk save failed");
						}
						await fetchBlocks();
						setExtractStatus({
							type: "success",
							msg: `Added ${extracted.length} block${extracted.length === 1 ? "" : "s"} to your calendar`,
						});
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					setExtractStatus({ type: "error", msg: `Error: ${msg}` });
					toast.error(`Extract failed: ${msg}`);
				} finally {
					setImporting(false);
					if (photoInputRef.current) photoInputRef.current.value = "";
				}
			};
			reader.readAsDataURL(file);
		} catch {
			toast.error("Could not read image file");
			setImporting(false);
			if (photoInputRef.current) photoInputRef.current.value = "";
		}
	}

	async function handleIcsImport(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setImporting(true);
		try {
			const text = await file.text();
			const res = await fetch("/api/schedule/extract", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "ics", content: text }),
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Extraction failed");
			const extracted = json.blocks ?? [];
			if (extracted.length === 0) {
				setExtractStatus({ type: "warning", msg: "No events found in this calendar file." });
			} else {
				const today = todayWeekday();
				const COLORS = [
					"blue",
					"indigo",
					"violet",
					"green",
					"emerald",
					"teal",
					"cyan",
					"red",
					"orange",
					"amber",
					"pink",
					"slate",
				] as const;
				const allSameColor = extracted.every((b: ProposedBlock) => b.color === extracted[0]?.color);
				const bulkRes = await fetch("/api/schedule/bulk", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						blocks: extracted.map((b: ProposedBlock, i: number) => ({
							...b,
							dayOfWeek: b.dayOfWeek ?? today,
							color: allSameColor ? COLORS[i % COLORS.length] : (b.color ?? "blue"),
						})),
					}),
				});
				if (!bulkRes.ok) {
					const bulkErr = await bulkRes.json();
					throw new Error(bulkErr.error || "Bulk save failed");
				}
				await fetchBlocks();
				setExtractStatus({
					type: "success",
					msg: `Added ${extracted.length} block${extracted.length === 1 ? "" : "s"} to your calendar`,
				});
			}
		} catch {
			setExtractStatus({ type: "error", msg: "Could not parse calendar file." });
		} finally {
			setImporting(false);
			if (icsInputRef.current) icsInputRef.current.value = "";
		}
	}

	function weekLabel(): string {
		const today = new Date();
		const dow = today.getDay();
		const monday = new Date(today);
		monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
		const friday = new Date(monday);
		friday.setDate(monday.getDate() + 4);
		const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
		return weekOffset === 0 ? "This Week" : `${fmt(monday)} – ${fmt(friday)}`;
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex gap-2 flex-wrap">
				<input
					ref={photoInputRef}
					type="file"
					accept="image/*"
					onChange={handlePhotoImport}
					className="hidden"
				/>
				<input
					ref={icsInputRef}
					type="file"
					accept=".ics"
					onChange={handleIcsImport}
					className="hidden"
				/>
				<button
					type="button"
					onClick={() => photoInputRef.current?.click()}
					disabled={importing}
					className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
				>
					<CalendarIcon className="h-3.5 w-3.5" />
					{importing ? "Extracting…" : "Upload Photo"}
				</button>
				<button
					type="button"
					onClick={() => icsInputRef.current?.click()}
					disabled={importing}
					className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
				>
					<CalendarIcon className="h-3.5 w-3.5" />
					Import .ics
				</button>
				{blocks.length > 0 && (
					<button
						type="button"
						onClick={async () => {
							if (!confirm(`Clear all ${blocks.length} schedule blocks?`)) return;
							await fetch("/api/schedule", { method: "DELETE" });
							setBlocks([]);
						}}
						className="flex items-center gap-1.5 rounded-lg border border-red-900/50 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:border-red-700 transition-colors ml-auto"
					>
						<XIcon className="h-3.5 w-3.5" />
						Clear all
					</button>
				)}
			</div>

			{extractStatus && (
				<div
					className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
						extractStatus.type === "success"
							? "border-green-500/30 bg-green-500/10 text-green-300"
							: extractStatus.type === "warning"
								? "border-amber-500/30 bg-amber-500/10 text-amber-300"
								: "border-red-500/30 bg-red-500/10 text-red-300"
					}`}
				>
					<AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
					{extractStatus.msg}
				</div>
			)}

			{/* Today's Resources — expandable DI-group-style cards (current week only) */}
			{weekOffset === 0 &&
				(["bell-ringer", "cfu", "exit-ticket"] as const).map((rt) => {
					const label = rt === "bell-ringer" ? "Bell Ringer" : rt === "cfu" ? "CFU" : "Exit Ticket";
					const url = todayResources[rt];
					const qs = todayQuestions[rt] ?? [];
					const remaining = qs.filter((q) => !pushedIds.has(q.id));
					if (!url && !qs.length) return null;
					const isExpanded = !!expanded[rt];
					return (
						<div
							key={rt}
							className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden"
						>
							{/* Card header */}
							<div className="flex items-center gap-2 px-3 py-1.5">
								<button
									type="button"
									onClick={() => setExpanded((prev) => ({ ...prev, [rt]: !prev[rt] }))}
									className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
								>
									{isExpanded ? (
										<ChevronDownIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
									) : (
										<ChevronRightIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
									)}
									<span className="text-xs font-medium text-slate-200">{label}</span>
									{qs.length > 0 && (
										<span className="text-[10px] text-slate-500 ml-0.5">
											· {remaining.length}/{qs.length} left
										</span>
									)}
								</button>
								{url && (
									<a
										href={url}
										target="_blank"
										rel="noreferrer"
										className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-500/10 transition-colors shrink-0"
										title="Open PDF"
									>
										<ExternalLinkIcon className="h-3 w-3" />
										PDF
									</a>
								)}
								{qs.length > 0 && (
									<button
										type="button"
										onClick={() => void sendNextQuestion(rt)}
										disabled={!activeSessionId || remaining.length === 0}
										title={
											activeSessionId ? `Send next (${remaining.length} left)` : "No active session"
										}
										className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
									>
										<PlayIcon className="h-3 w-3" />
										Send Next
									</button>
								)}
							</div>

							{/* Expanded question list */}
							{isExpanded && qs.length > 0 && (
								<div className="border-t border-slate-700/50">
									{qs.map((q, i) => {
										const sent = pushedIds.has(q.id);
										return (
											<div
												key={q.id}
												className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700/30 last:border-b-0"
											>
												<span
													className={`h-2 w-2 rounded-full shrink-0 ${sent ? "bg-emerald-400" : "bg-slate-600"}`}
												/>
												<span className="text-xs text-slate-300 flex-1 truncate">
													{i + 1}. {q.stem ?? "(no stem)"}
												</span>
												<button
													type="button"
													onClick={() => void sendQuestion(q.id)}
													disabled={!activeSessionId || sent}
													title={sent ? "Already sent" : "Send this question"}
													className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
												>
													<PlayIcon className="h-3 w-3" />
												</button>
											</div>
										);
									})}
								</div>
							)}

							{isExpanded && qs.length === 0 && (
								<p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-700/50">
									No questions assigned for today
								</p>
							)}
						</div>
					);
				})}

			{/* Week navigation */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => setWeekOffset((o) => o - 1)}
					className="rounded p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
					title="Previous week"
				>
					<ChevronLeftIcon className="h-4 w-4" />
				</button>
				<span className="text-xs text-slate-400 min-w-[90px] text-center">{weekLabel()}</span>
				<button
					type="button"
					onClick={() => setWeekOffset((o) => o + 1)}
					className="rounded p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
					title="Next week"
				>
					<ChevronRightIcon className="h-4 w-4" />
				</button>
				{weekOffset !== 0 && (
					<button
						type="button"
						onClick={() => setWeekOffset(0)}
						className="ml-1 rounded px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors"
					>
						Today
					</button>
				)}
			</div>

			<ScheduleCalendar blocks={blocks} onBlocksChange={setBlocks} weekOffset={weekOffset} />
		</div>
	);
}
