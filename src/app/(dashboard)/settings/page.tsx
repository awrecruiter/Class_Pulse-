"use client";

import {
	AlertCircleIcon,
	CalendarIcon,
	MicIcon,
	PlusIcon,
	ShieldCheckIcon,
	ShieldOffIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar";
import { Button } from "@/components/ui/button";
import {
	clearVoiceProfile,
	enrollVoiceProfile,
	getVoiceProfile,
	type VoiceProfile,
} from "@/lib/voice-profile";

type Settings = {
	masteryThreshold: number;
	confusionAlertPercent: number;
	useAliasMode: boolean;
	storeResetSchedule: "daily" | "weekly" | "monthly" | "quarterly" | "manual";
	storeIsOpen: boolean;
	diRewardAmount: number;
	scheduleDocOpenMode: "toast" | "new-tab";
	voiceNavMode: "immediate" | "toast";
	voiceAppOpenMode: "immediate" | "confirm";
};

type FeeEntry = {
	step: number;
	label: string;
	deductionAmount: number;
};

type PrivilegeItem = {
	id: string;
	name: string;
	cost: number;
	durationMinutes: number | null;
	isActive: boolean;
	sortOrder: number;
};

type ClassRow = { id: string; label: string };

// ─── Schedule Manager ─────────────────────────────────────────────────────────

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ScheduleManager() {
	const [blocks, setBlocks] = useState<ScheduleBlockRow[]>([]);
	const [importing, setImporting] = useState(false);
	const [extractStatus, setExtractStatus] = useState<{
		type: "success" | "warning" | "error";
		msg: string;
	} | null>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const icsInputRef = useRef<HTMLInputElement>(null);

	const fetchBlocks = useCallback(async () => {
		try {
			const res = await fetch("/api/schedule");
			const json = await res.json();
			const fetched = json.blocks ?? [];
			setBlocks(fetched);
		} catch {
			// silent
		}
	}, []);

	useEffect(() => {
		fetchBlocks();
	}, [fetchBlocks]);

	function todayWeekday(): number {
		// 0=Sun,1=Mon...6=Sat — clamp to Mon-Fri
		const d = new Date().getDay();
		if (d === 0) return 1; // Sun → Mon
		if (d === 6) return 5; // Sat → Fri
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
						console.warn("[schedule/extract] 0 blocks. debug:", json.debug ?? "(no debug field)");
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
					console.error("[schedule/extract] error:", msg);
					setExtractStatus({ type: "error", msg: `Error: ${msg}` });
					toast.error(`Extract failed: ${msg}`);
				} finally {
					setImporting(false);
				}
			};
			reader.readAsDataURL(file);
		} catch {
			toast.error("Could not read image file");
			setImporting(false);
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
		}
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Import buttons */}
			<div className="flex gap-2">
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

			{/* Extract status */}
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

			<ScheduleCalendar blocks={blocks} onBlocksChange={setBlocks} />
		</div>
	);
}

export default function SettingsPage() {
	const [settings, setSettings] = useState<Settings | null>(null);
	const [loadError, setLoadError] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// Voice lock
	const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
	const [enrolling, setEnrolling] = useState(false);
	const [enrollCountdown, setEnrollCountdown] = useState(0);
	useEffect(() => {
		setVoiceProfile(getVoiceProfile());
	}, []);

	// Fee schedule state
	const [feeSchedule, setFeeSchedule] = useState<FeeEntry[]>([]);
	const [feeLoading, setFeeLoading] = useState(true);
	const [feeSaving, setFeeSaving] = useState(false);

	// Privilege items state
	const [privilegeItems, setPrivilegeItems] = useState<PrivilegeItem[]>([]);
	const [itemsLoading, setItemsLoading] = useState(true);
	const [_itemsSaving, setItemsSaving] = useState<Record<string, boolean>>({});

	// Classes (for group reset)
	const [classes, setClasses] = useState<ClassRow[]>([]);
	const [clearingClass, setClearingClass] = useState<string | null>(null);

	const fetchSettings = useCallback(async () => {
		try {
			const res = await fetch("/api/teacher-settings");
			if (!res.ok) {
				setLoadError(true);
				return;
			}
			const json = await res.json();
			if (json.settings) {
				setSettings(json.settings);
			} else {
				setLoadError(true);
			}
		} catch {
			toast.error("Failed to load settings");
			setLoadError(true);
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchFeeSchedule = useCallback(async () => {
		try {
			const res = await fetch("/api/teacher-settings/fee-schedule");
			const json = await res.json();
			setFeeSchedule(json.schedule ?? []);
		} catch {
			toast.error("Failed to load fee schedule");
		} finally {
			setFeeLoading(false);
		}
	}, []);

	const fetchPrivilegeItems = useCallback(async () => {
		try {
			const res = await fetch("/api/privilege-items?all=true");
			const json = await res.json();
			setPrivilegeItems(json.items ?? []);
		} catch {
			toast.error("Failed to load store items");
		} finally {
			setItemsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchSettings();
		fetchFeeSchedule();
		fetchPrivilegeItems();
		fetch("/api/classes")
			.then((r) => r.json())
			.then((j) =>
				setClasses(
					(j.classes ?? [])
						.filter((c: ClassRow & { isArchived: boolean }) => !c.isArchived)
						.map((c: ClassRow) => ({ id: c.id, label: c.label })),
				),
			)
			.catch(() => {});
	}, [fetchSettings, fetchFeeSchedule, fetchPrivilegeItems]);

	async function handleEnrollVoice() {
		setEnrolling(true);
		setEnrollCountdown(5);
		try {
			const profile = await enrollVoiceProfile((secondsLeft) => setEnrollCountdown(secondsLeft));
			setVoiceProfile(profile);
			toast.success(
				`Voice lock enrolled — detected at ${profile.meanPitch} Hz ±${profile.toleranceHz} Hz`,
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enrollment failed");
		} finally {
			setEnrolling(false);
			setEnrollCountdown(0);
		}
	}

	function handleClearVoice() {
		clearVoiceProfile();
		setVoiceProfile(null);
		toast.success("Voice lock cleared — all voices can trigger commands");
	}

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		if (!settings) return;
		setSaving(true);
		try {
			const res = await fetch("/api/teacher-settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings),
			});
			if (!res.ok) throw new Error("Failed to save");
			// Cache voice settings in localStorage so VoiceCommandProvider reads them instantly on next mount
			if (settings.voiceNavMode)
				localStorage.setItem("voiceSettings.voiceNavMode", settings.voiceNavMode);
			if (settings.scheduleDocOpenMode)
				localStorage.setItem("voiceSettings.scheduleDocOpenMode", settings.scheduleDocOpenMode);
			toast.success("Settings saved");
		} catch {
			toast.error("Failed to save settings");
		} finally {
			setSaving(false);
		}
	}

	async function handleSaveFeeSchedule() {
		setFeeSaving(true);
		try {
			const res = await fetch("/api/teacher-settings/fee-schedule", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ schedule: feeSchedule }),
			});
			if (!res.ok) throw new Error("Failed to save fee schedule");
			toast.success("Fee schedule saved");
		} catch {
			toast.error("Failed to save fee schedule");
		} finally {
			setFeeSaving(false);
		}
	}

	function updateFeeEntry(step: number, field: keyof FeeEntry, value: string | number) {
		setFeeSchedule((prev) =>
			prev.map((entry) => (entry.step === step ? { ...entry, [field]: value } : entry)),
		);
	}

	async function handleAddPrivilegeItem() {
		try {
			const res = await fetch("/api/privilege-items", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "New Item", cost: 20 }),
			});
			if (!res.ok) throw new Error("Failed to add item");
			const json = await res.json();
			setPrivilegeItems((prev) => [...prev, json.item]);
			toast.success("Item added");
		} catch {
			toast.error("Failed to add item");
		}
	}

	async function handleUpdateItem(item: PrivilegeItem) {
		setItemsSaving((prev) => ({ ...prev, [item.id]: true }));
		try {
			const res = await fetch(`/api/privilege-items/${item.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: item.name,
					cost: item.cost,
					durationMinutes: item.durationMinutes,
					isActive: item.isActive,
				}),
			});
			if (!res.ok) throw new Error("Failed to update item");
			toast.success("Item updated");
		} catch {
			toast.error("Failed to update item");
		} finally {
			setItemsSaving((prev) => ({ ...prev, [item.id]: false }));
		}
	}

	async function handleToggleItem(item: PrivilegeItem) {
		const updated = { ...item, isActive: !item.isActive };
		setPrivilegeItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
		await handleUpdateItem(updated);
	}

	async function handleClearGroupAssignments(classId: string) {
		setClearingClass(classId);
		try {
			const res = await fetch(`/api/classes/${classId}/groups`, { method: "DELETE" });
			if (!res.ok) throw new Error("Failed");
			toast.success("All group assignments cleared");
		} catch {
			toast.error("Failed to clear assignments");
		} finally {
			setClearingClass(null);
		}
	}

	function updateLocalItem(
		id: string,
		field: keyof PrivilegeItem,
		value: string | number | boolean | null,
	) {
		setPrivilegeItems((prev) =>
			prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
		);
	}

	if (loading) {
		return (
			<div className="mx-auto max-w-lg px-4 py-8 flex flex-col gap-4">
				{[1, 2, 3].map((i) => (
					<div key={i} className="h-16 rounded-lg bg-slate-800/30 animate-pulse" />
				))}
			</div>
		);
	}

	if (loadError || !settings) {
		return (
			<div className="mx-auto max-w-lg px-4 py-16 flex flex-col items-center gap-4 text-center">
				<AlertCircleIcon className="h-10 w-10 text-slate-400/50" />
				<div>
					<p className="text-sm font-medium text-slate-200">Couldn't load settings</p>
					<p className="text-xs text-slate-400 mt-1">
						Make sure you're signed in. If this persists, try signing out and back in.
					</p>
				</div>
				<Link
					href="/login"
					className="text-xs text-indigo-400 underline underline-offset-2 hover:no-underline"
				>
					Go to sign in →
				</Link>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-lg px-4 py-8">
			<div className="mb-6">
				<h1 className="text-xl font-bold text-slate-200">Settings</h1>
				<p className="text-sm text-slate-400 mt-0.5">Configure your classroom preferences</p>
			</div>

			{/* ── Section nav ───────────────────────────────────── */}
			<nav className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[#0d1525]/90 backdrop-blur border-b border-slate-800 flex gap-1.5 overflow-x-auto scrollbar-none mb-2">
				{(
					[
						["mastery", "Mastery"],
						["comprehension", "Comprehension"],
						["privacy", "Privacy"],
						["store", "Store"],
						["di", "DI Sessions"],
						["voice", "Voice"],
						["groups", "Groups"],
						["fees", "Fees"],
						["schedule", "Schedule"],
					] as [string, string][]
				).map(([id, label]) => (
					<a
						key={id}
						href={`#${id}`}
						className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
					>
						{label}
					</a>
				))}
			</nav>

			<form onSubmit={handleSave} className="flex flex-col gap-6">
				{/* ── Mastery Loop ────────────────────────────────── */}
				<section id="mastery" className="flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
						Mastery Loop
					</h2>

					<div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="text-sm font-medium text-slate-200">Consecutive correct to master</p>
								<p className="text-xs text-slate-400 mt-0.5">
									How many right answers in a row = mastered
								</p>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<button
									type="button"
									onClick={() =>
										setSettings((s) =>
											s ? { ...s, masteryThreshold: Math.max(1, s.masteryThreshold - 1) } : s,
										)
									}
									className="h-8 w-8 rounded-lg border border-slate-800 flex items-center justify-center text-lg font-bold hover:bg-slate-800 transition-colors"
								>
									-
								</button>
								<span className="text-xl font-bold text-slate-200 w-8 text-center tabular-nums">
									{settings.masteryThreshold}
								</span>
								<button
									type="button"
									onClick={() =>
										setSettings((s) =>
											s ? { ...s, masteryThreshold: Math.min(10, s.masteryThreshold + 1) } : s,
										)
									}
									className="h-8 w-8 rounded-lg border border-slate-800 flex items-center justify-center text-lg font-bold hover:bg-slate-800 transition-colors"
								>
									+
								</button>
							</div>
						</div>
					</div>
				</section>

				{/* ── Comprehension Pulse ─────────────────────────── */}
				<section id="comprehension" className="flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
						Comprehension Pulse
					</h2>

					<div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
						<div>
							<div className="flex items-center justify-between mb-2">
								<div>
									<p className="text-sm font-medium text-slate-200">Confusion alert threshold</p>
									<p className="text-xs text-slate-400 mt-0.5">
										Alert when this % of class signals "Lost"
									</p>
								</div>
								<span className="text-xl font-bold text-slate-200 tabular-nums">
									{settings.confusionAlertPercent}%
								</span>
							</div>
							<input
								type="range"
								min={10}
								max={90}
								step={5}
								value={settings.confusionAlertPercent}
								onChange={(e) =>
									setSettings((s) =>
										s ? { ...s, confusionAlertPercent: Number(e.target.value) } : s,
									)
								}
								className="w-full accent-primary"
							/>
							<div className="flex justify-between text-xs text-slate-400 mt-1">
								<span>10%</span>
								<span>90%</span>
							</div>
						</div>
					</div>
				</section>

				{/* ── Privacy ─────────────────────────────────────── */}
				<section id="privacy" className="flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Privacy</h2>

					<div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
						<label className="flex items-center justify-between gap-3 cursor-pointer">
							<div>
								<p className="text-sm font-medium text-slate-200">Alias mode</p>
								<p className="text-xs text-slate-400 mt-0.5">
									Replace student initials with animal names in reports
								</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settings.useAliasMode}
								onClick={() =>
									setSettings((s) => (s ? { ...s, useAliasMode: !s.useAliasMode } : s))
								}
								className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
									settings.useAliasMode ? "bg-primary" : "bg-slate-800"
								}`}
							>
								<span
									className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
										settings.useAliasMode ? "translate-x-5" : "translate-x-0"
									}`}
								/>
							</button>
						</label>
					</div>
				</section>

				{/* ── RAM Buck Store ───────────────────────────────── */}
				<section id="store" className="flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
						RAM Buck Store
					</h2>

					<div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<p className="text-sm font-medium text-slate-200">Store open schedule</p>
							<p className="text-xs text-slate-400">When students can browse and spend RAM Bucks</p>
							<div className="grid grid-cols-3 gap-2 mt-1 sm:grid-cols-5">
								{(["daily", "weekly", "monthly", "quarterly", "manual"] as const).map(
									(schedule) => (
										<button
											key={schedule}
											type="button"
											onClick={() =>
												setSettings((s) => (s ? { ...s, storeResetSchedule: schedule } : s))
											}
											className={`rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-colors ${
												settings.storeResetSchedule === schedule
													? "border-primary bg-indigo-500/20 text-indigo-400"
													: "border-slate-800 bg-[#0d1525] text-slate-400 hover:bg-slate-800/50"
											}`}
										>
											{schedule}
										</button>
									),
								)}
							</div>
						</div>

						<label className="flex items-center justify-between gap-3 cursor-pointer border-t border-slate-800 pt-4">
							<div>
								<p className="text-sm font-medium text-slate-200">Store is open now</p>
								<p className="text-xs text-slate-400 mt-0.5">
									Toggle to open or close the store immediately
								</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settings.storeIsOpen}
								onClick={() => setSettings((s) => (s ? { ...s, storeIsOpen: !s.storeIsOpen } : s))}
								className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
									settings.storeIsOpen ? "bg-green-500" : "bg-slate-800"
								}`}
							>
								<span
									className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
										settings.storeIsOpen ? "translate-x-5" : "translate-x-0"
									}`}
								/>
							</button>
						</label>
					</div>
				</section>

				{/* ── DI Group Sessions ───────────────────────────────────── */}
				<section id="di" className="flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
						DI Group Sessions
					</h2>
					<div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="text-sm font-medium text-slate-200">RAM Bucks awarded to winners</p>
								<p className="text-xs text-slate-400 mt-0.5">
									Given to each member of the winning group when a DI session ends
								</p>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<button
									type="button"
									onClick={() =>
										setSettings((s) =>
											s ? { ...s, diRewardAmount: Math.max(1, (s.diRewardAmount ?? 10) - 5) } : s,
										)
									}
									className="h-8 w-8 rounded-lg border border-slate-800 flex items-center justify-center text-lg font-bold hover:bg-slate-800 transition-colors"
								>
									-
								</button>
								<span className="text-xl font-bold text-slate-200 w-10 text-center tabular-nums">
									{settings.diRewardAmount ?? 10}
								</span>
								<button
									type="button"
									onClick={() =>
										setSettings((s) =>
											s ? { ...s, diRewardAmount: Math.min(500, (s.diRewardAmount ?? 10) + 5) } : s,
										)
									}
									className="h-8 w-8 rounded-lg border border-slate-800 flex items-center justify-center text-lg font-bold hover:bg-slate-800 transition-colors"
								>
									+
								</button>
							</div>
						</div>
					</div>
				</section>

				{/* ── Voice Lock ──────────────────────────────────── */}
				<section id="voice" className="flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
						Voice Lock
					</h2>

					<div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
						<div className="flex items-start gap-3">
							{voiceProfile ? (
								<ShieldCheckIcon className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
							) : (
								<ShieldOffIcon className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
							)}
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-slate-200">
									{voiceProfile ? "Voice lock active" : "Voice lock not enrolled"}
								</p>
								{voiceProfile ? (
									<p className="text-xs text-slate-400 mt-0.5">
										Your voice profile:{" "}
										<span className="text-emerald-400 font-mono">
											{voiceProfile.meanPitch} Hz ±{voiceProfile.toleranceHz} Hz
										</span>
										{" · "}only your voice will trigger commands
									</p>
								) : (
									<p className="text-xs text-slate-400 mt-0.5">
										Without enrollment, any voice near the microphone can trigger commands. Enroll
										to restrict to your voice only.
									</p>
								)}
							</div>
						</div>

						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleEnrollVoice}
								disabled={enrolling}
								className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-white transition-colors"
							>
								<MicIcon className={`h-3.5 w-3.5 ${enrolling ? "animate-pulse" : ""}`} />
								{enrolling
									? `Recording… ${enrollCountdown}s`
									: voiceProfile
										? "Re-enroll"
										: "Enroll My Voice"}
							</button>
							{voiceProfile && (
								<button
									type="button"
									onClick={handleClearVoice}
									className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-red-400 hover:border-red-400/40 transition-colors"
								>
									Clear Profile
								</button>
							)}
						</div>

						{enrolling && (
							<div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 text-xs text-indigo-300">
								<strong>Speak now</strong> — say a few sentences in your normal classroom voice.
								Recording for {enrollCountdown} more second{enrollCountdown !== 1 ? "s" : ""}…
							</div>
						)}
					</div>
				</section>

				<Button type="submit" disabled={saving} className="w-full">
					{saving ? "Saving..." : "Save Settings"}
				</Button>
			</form>

			{/* ── Student Groups ───────────────────────────────── */}
			<div id="groups" className="mt-8 flex flex-col gap-4">
				<div>
					<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
						Student Groups
					</h2>
					<p className="text-xs text-slate-400 mt-0.5">
						Clear all group assignments for a class (keeps the group circles, unassigns everyone)
					</p>
				</div>
				{classes.length === 0 ? (
					<p className="text-xs text-slate-500">No classes found.</p>
				) : (
					<div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
						{classes.map((cls, i) => (
							<div
								key={cls.id}
								className={`flex items-center justify-between gap-3 px-4 py-3 ${i !== classes.length - 1 ? "border-b border-slate-800" : ""}`}
							>
								<span className="text-sm text-slate-200">{cls.label}</span>
								<button
									type="button"
									onClick={() => handleClearGroupAssignments(cls.id)}
									disabled={clearingClass === cls.id}
									className="text-xs font-medium text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
								>
									{clearingClass === cls.id ? "Clearing…" : "Clear Assignments"}
								</button>
							</div>
						))}
					</div>
				)}
			</div>

			{/* ── Fee Schedule ─────────────────────────────────── */}
			<div id="fees" className="mt-8 flex flex-col gap-4">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
					Behavior Fee Schedule
				</h2>
				<p className="text-xs text-slate-400 -mt-2">
					RAM Buck deductions applied automatically at each behavior step
				</p>

				{feeLoading ? (
					<div className="h-48 rounded-lg bg-slate-800/30 animate-pulse" />
				) : (
					<div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
						{feeSchedule.map((entry, i) => (
							<div
								key={entry.step}
								className={`flex items-center gap-3 px-3 py-2.5 ${
									i !== feeSchedule.length - 1 ? "border-b border-slate-800" : ""
								}`}
							>
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400">
									{entry.step}
								</span>
								<input
									type="text"
									value={entry.label}
									onChange={(e) => updateFeeEntry(entry.step, "label", e.target.value)}
									className="flex-1 rounded border border-slate-800 bg-[#0d1525] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
								/>
								<div className="flex items-center gap-1 shrink-0">
									<span className="text-xs text-slate-400">-</span>
									<input
										type="number"
										min={0}
										max={10000}
										value={entry.deductionAmount}
										onChange={(e) =>
											updateFeeEntry(entry.step, "deductionAmount", Number(e.target.value))
										}
										className="w-16 rounded border border-slate-800 bg-[#0d1525] px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
									/>
									<span className="text-xs text-slate-400">RAM</span>
								</div>
							</div>
						))}
					</div>
				)}

				<Button
					type="button"
					variant="outline"
					onClick={handleSaveFeeSchedule}
					disabled={feeSaving}
					className="w-full"
				>
					{feeSaving ? "Saving..." : "Save Fee Schedule"}
				</Button>
			</div>

			{/* ── Store Items ──────────────────────────────────── */}
			<div className="mt-8 flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
							Store Items
						</h2>
						<p className="text-xs text-slate-400 mt-0.5">
							Privileges students can purchase with RAM Bucks
						</p>
					</div>
					<Button size="sm" variant="outline" onClick={handleAddPrivilegeItem}>
						<PlusIcon className="h-3.5 w-3.5 mr-1" />
						Add Item
					</Button>
				</div>

				{itemsLoading ? (
					<div className="h-48 rounded-lg bg-slate-800/30 animate-pulse" />
				) : (
					<div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
						{privilegeItems.length === 0 ? (
							<div className="p-6 text-center">
								<p className="text-sm text-slate-400">No items yet. Add one above.</p>
							</div>
						) : (
							privilegeItems.map((item, i) => (
								<div
									key={item.id}
									className={`flex flex-col gap-2 px-3 py-3 ${
										i !== privilegeItems.length - 1 ? "border-b border-slate-800" : ""
									} ${!item.isActive ? "opacity-50" : ""}`}
								>
									<div className="flex items-center gap-2">
										{/* Active toggle */}
										<button
											type="button"
											role="switch"
											aria-checked={item.isActive}
											onClick={() => handleToggleItem(item)}
											className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
												item.isActive ? "bg-primary" : "bg-slate-800"
											}`}
										>
											<span
												className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
													item.isActive ? "translate-x-4" : "translate-x-0"
												}`}
											/>
										</button>

										{/* Name */}
										<input
											type="text"
											value={item.name}
											onChange={(e) => updateLocalItem(item.id, "name", e.target.value)}
											onBlur={() => handleUpdateItem(item)}
											className="flex-1 rounded border border-slate-800 bg-[#0d1525] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
										/>

										{/* Cost */}
										<div className="flex items-center gap-1 shrink-0">
											<input
												type="number"
												min={0}
												max={10000}
												value={item.cost}
												onChange={(e) => updateLocalItem(item.id, "cost", Number(e.target.value))}
												onBlur={() => handleUpdateItem(item)}
												className="w-16 rounded border border-slate-800 bg-[#0d1525] px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
											/>
											<span className="text-xs text-slate-400">RAM</span>
										</div>

										{/* Duration */}
										<div className="flex items-center gap-1 shrink-0">
											<input
												type="number"
												min={1}
												max={300}
												placeholder="min"
												value={item.durationMinutes ?? ""}
												onChange={(e) =>
													updateLocalItem(
														item.id,
														"durationMinutes",
														e.target.value ? Number(e.target.value) : null,
													)
												}
												onBlur={() => handleUpdateItem(item)}
												className="w-14 rounded border border-slate-800 bg-[#0d1525] px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
											/>
											<span className="text-xs text-slate-400">min</span>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				)}
			</div>

			{/* ── Schedule Settings + CRUD ────────────────────── */}
			<div id="schedule" className="mt-8 flex flex-col gap-4">
				<div>
					<h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Schedule</h2>
					<p className="text-xs text-slate-400 mt-0.5">
						Configure your daily schedule and doc links for the schedule overlay
					</p>
				</div>

				{/* Doc open mode */}
				<div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="text-sm font-medium text-slate-200">Document open mode</p>
							<p className="text-xs text-slate-500 mt-0.5">
								How schedule doc links open when tapped or triggered by voice
							</p>
						</div>
						<select
							value={settings.scheduleDocOpenMode ?? "toast"}
							onChange={(e) =>
								setSettings((s) =>
									s
										? {
												...s,
												scheduleDocOpenMode: e.target.value as "toast" | "new-tab",
											}
										: s,
								)
							}
							className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5"
						>
							<option value="toast">Tappable toast (confirm first)</option>
							<option value="new-tab">Open immediately in new tab</option>
						</select>
					</div>
				</div>

				<div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="text-sm font-medium text-slate-200">Voice navigation</p>
							<p className="text-xs text-slate-500 mt-0.5">
								How voice commands like "go to classes" behave
							</p>
						</div>
						<select
							value={settings.voiceNavMode ?? "toast"}
							onChange={async (e) => {
								const v = e.target.value as "immediate" | "toast";
								setSettings((s) => (s ? { ...s, voiceNavMode: v } : s));
								localStorage.setItem("voiceSettings.voiceNavMode", v);
								window.dispatchEvent(
									new CustomEvent("voice-nav-mode-changed", { detail: { voiceNavMode: v } }),
								);
								await fetch("/api/teacher-settings", {
									method: "PUT",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ voiceNavMode: v }),
								});
							}}
							className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5"
						>
							<option value="toast">Tappable toast (confirm first)</option>
							<option value="immediate">Navigate immediately</option>
						</select>
					</div>
				</div>

				<div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="text-sm font-medium text-slate-200">Voice app opens</p>
							<p className="text-xs text-slate-500 mt-0.5">
								How “open Pinnacle / iReady / Schoology…” behaves
							</p>
						</div>
						<select
							value={settings.voiceAppOpenMode ?? "immediate"}
							onChange={async (e) => {
								const v = e.target.value as "immediate" | "confirm";
								setSettings((s) => (s ? { ...s, voiceAppOpenMode: v } : s));
								localStorage.setItem("voiceSettings.voiceAppOpenMode", v);
								window.dispatchEvent(
									new CustomEvent("voice-app-open-mode-changed", {
										detail: { voiceAppOpenMode: v },
									}),
								);
								await fetch("/api/teacher-settings", {
									method: "PUT",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ voiceAppOpenMode: v }),
								});
							}}
							className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5"
						>
							<option value="immediate">Open immediately (same tab)</option>
							<option value="confirm">Tap to open (new tab)</option>
						</select>
					</div>
				</div>

				<ScheduleManager />
			</div>
		</div>
	);
}
