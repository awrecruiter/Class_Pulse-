"use client";

import {
	AlertCircleIcon,
	CalendarIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	RefreshCwIcon,
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

export function ScheduleManager({ classId: initialClassId }: { classId?: string | null }) {
	const [activeClassId, setActiveClassId] = useState<string | null>(initialClassId ?? null);
	const [blocks, setBlocks] = useState<ScheduleBlockRow[]>([]);
	const [importing, setImporting] = useState(false);
	const [extractStatus, setExtractStatus] = useState<{
		type: "success" | "warning" | "error";
		msg: string;
	} | null>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const icsInputRef = useRef<HTMLInputElement>(null);
	const [weekOffset, setWeekOffset] = useState(0);
	const [resourcesByDate, setResourcesByDate] = useState<Record<string, string[]>>({});
	const [loadingResources, setLoadingResources] = useState(false);

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
		const handler = (e: Event) => {
			setActiveClassId((e as CustomEvent<{ classId: string }>).detail.classId ?? null);
		};
		window.addEventListener("class-selected", handler);
		return () => window.removeEventListener("class-selected", handler);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: weekOffset is the trigger, setResourcesByDate is stable
	useEffect(() => {
		setResourcesByDate({});
	}, [weekOffset]);

	const loadResources = useCallback(async () => {
		setLoadingResources(true);
		try {
			const today = new Date();
			const dow = today.getDay();
			const monday = new Date(today);
			monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
			const dates = Array.from({ length: 5 }, (_, i) => {
				const d = new Date(monday);
				d.setDate(monday.getDate() + i);
				return d.toISOString().slice(0, 10);
			});
			const classParam = activeClassId ? `&classId=${encodeURIComponent(activeClassId)}` : "";
			const results = await Promise.all(
				dates.map((date) =>
					fetch(`/api/resources/today?date=${date}${classParam}`)
						.then((r) => r.json())
						.then((j) => ({
							date,
							types: (j.sections ?? []).map(
								(s: { resourceType: string }) => s.resourceType,
							) as string[],
						}))
						.catch(() => ({ date, types: [] as string[] })),
				),
			);
			const map: Record<string, string[]> = {};
			for (const { date, types } of results) map[date] = types;
			setResourcesByDate(map);
			const total = Object.values(map).reduce((n, arr) => n + arr.length, 0);
			if (total === 0) toast.info("No resources uploaded for this week");
		} finally {
			setLoadingResources(false);
		}
	}, [weekOffset, activeClassId]);

	// Listen for the "load-resources" event dispatched by the question bank panel
	useEffect(() => {
		const handler = () => {
			loadResources();
		};
		window.addEventListener("load-resources", handler);
		return () => window.removeEventListener("load-resources", handler);
	}, [loadResources]);

	function todayWeekday(): number {
		const d = new Date().getDay();
		if (d === 0) return 1;
		if (d === 6) return 5;
		return d;
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
				<button
					type="button"
					onClick={fetchBlocks}
					disabled={loadingResources}
					className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
				>
					<RefreshCwIcon className={`h-3.5 w-3.5 ${loadingResources ? "animate-spin" : ""}`} />
					Refresh
				</button>
			</div>

			<ScheduleCalendar
				blocks={blocks}
				onBlocksChange={setBlocks}
				weekOffset={weekOffset}
				resourcesByDate={resourcesByDate}
			/>
		</div>
	);
}
