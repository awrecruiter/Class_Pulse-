"use client";

import { AlertCircleIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Settings = {
	masteryThreshold: number;
	confusionAlertPercent: number;
	useAliasMode: boolean;
	storeResetSchedule: "daily" | "weekly" | "monthly" | "quarterly" | "manual";
	storeIsOpen: boolean;
	diRewardAmount: number;
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

export default function SettingsPage() {
	const [settings, setSettings] = useState<Settings | null>(null);
	const [loadError, setLoadError] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// Fee schedule state
	const [feeSchedule, setFeeSchedule] = useState<FeeEntry[]>([]);
	const [feeLoading, setFeeLoading] = useState(true);
	const [feeSaving, setFeeSaving] = useState(false);

	// Privilege items state
	const [privilegeItems, setPrivilegeItems] = useState<PrivilegeItem[]>([]);
	const [itemsLoading, setItemsLoading] = useState(true);
	const [_itemsSaving, setItemsSaving] = useState<Record<string, boolean>>({});

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
	}, [fetchSettings, fetchFeeSchedule, fetchPrivilegeItems]);

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

			<form onSubmit={handleSave} className="flex flex-col gap-6">
				{/* ── Mastery Loop ────────────────────────────────── */}
				<section className="flex flex-col gap-4">
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
				<section className="flex flex-col gap-4">
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
				<section className="flex flex-col gap-4">
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
				<section className="flex flex-col gap-4">
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
													: "border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800/50"
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
				<section className="flex flex-col gap-4">
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

				<Button type="submit" disabled={saving} className="w-full">
					{saving ? "Saving..." : "Save Settings"}
				</Button>
			</form>

			{/* ── Fee Schedule ─────────────────────────────────── */}
			<div className="mt-8 flex flex-col gap-4">
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
									className="flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
										className="w-16 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
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
											className="flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
												className="w-16 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
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
												className="w-14 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
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
		</div>
	);
}
