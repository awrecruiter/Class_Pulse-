"use client";

import {
	CheckIcon,
	ClockIcon,
	CoinsIcon,
	EyeOffIcon,
	GiftIcon,
	MinusCircleIcon,
	PencilIcon,
	PlusIcon,
	ShoppingBagIcon,
	ShoppingCartIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PrivilegeItem = {
	id: string;
	name: string;
	cost: number;
	durationMinutes: number | null;
	isActive: boolean;
	sortOrder: number;
};

type Purchase = {
	id: string;
	rosterId: string;
	itemId: string;
	cost: number;
	status: string;
	requestedAt: string;
	firstInitial: string;
	lastInitial: string;
	itemName: string;
	itemDurationMinutes: number | null;
};

type ClassRow = { id: string; label: string; isArchived: boolean };
type RosterEntry = { id: string; firstInitial: string; lastInitial: string; balance: number };

// ─── Fine types ───────────────────────────────────────────────────────────────

type FinePreset = {
	id: string;
	name: string;
	amount: number;
};

const DEFAULT_FINES: FinePreset[] = [
	{ id: "1", name: "Talking out of turn", amount: 5 },
	{ id: "2", name: "Off task", amount: 5 },
	{ id: "3", name: "Missing homework", amount: 10 },
	{ id: "4", name: "Phone out", amount: 15 },
	{ id: "5", name: "Disrespectful", amount: 10 },
	{ id: "6", name: "No materials", amount: 5 },
	{ id: "7", name: "Tardy", amount: 10 },
];

const FINES_STORAGE_KEY = "ram-buck-fines";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
	return new Date(iso).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function CostBadge({ cost }: { cost: number }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-400">
			<CoinsIcon className="h-3 w-3" />
			{cost}
		</span>
	);
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
	item,
	classId,
	roster,
	onGranted,
	onUpdate,
	onDelete,
}: {
	item: PrivilegeItem;
	classId: string;
	roster: RosterEntry[];
	onGranted: () => void;
	onUpdate: (updated: PrivilegeItem) => void;
	onDelete: (id: string) => void;
}) {
	const [showPicker, setShowPicker] = useState(false);
	const [grantState, setGrantState] = useState<"idle" | "loading" | "done" | "error">("idle");
	const [selectedRosterId, setSelectedRosterId] = useState("");
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState({
		name: item.name,
		cost: item.cost,
		durationMinutes: item.durationMinutes,
	});
	const [saving, setSaving] = useState(false);
	const pickerRef = useRef<HTMLDivElement>(null);

	// Close picker on outside click
	useEffect(() => {
		if (!showPicker) return;
		function handler(e: MouseEvent) {
			if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
				setShowPicker(false);
			}
		}
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showPicker]);

	async function handleGrant() {
		if (!selectedRosterId || !classId || grantState === "loading") return;
		setGrantState("loading");
		try {
			const createRes = await fetch(`/api/classes/${classId}/purchases`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId: selectedRosterId, itemId: item.id }),
			});
			const createData = await createRes.json();
			if (!createRes.ok) throw new Error(createData.error ?? "Failed");
			const approveRes = await fetch(
				`/api/classes/${classId}/purchases/${createData.purchase.id}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action: "approve" }),
				},
			);
			if (!approveRes.ok) throw new Error("Failed to approve");
			setGrantState("done");
			setTimeout(() => {
				setGrantState("idle");
				setShowPicker(false);
				setSelectedRosterId("");
				onGranted();
			}, 1000);
		} catch {
			setGrantState("error");
			setTimeout(() => setGrantState("idle"), 2000);
		}
	}

	async function saveEdit() {
		if (!draft.name.trim()) return;
		setSaving(true);
		try {
			const res = await fetch(`/api/privilege-items/${item.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: draft.name.trim(),
					cost: draft.cost,
					durationMinutes: draft.durationMinutes,
				}),
			});
			if (!res.ok) throw new Error("Failed");
			const json = await res.json();
			onUpdate(json.item);
			setEditing(false);
		} catch {
			/* noop */
		} finally {
			setSaving(false);
		}
	}

	async function toggleActive() {
		const res = await fetch(`/api/privilege-items/${item.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ isActive: !item.isActive }),
		});
		if (res.ok) {
			const json = await res.json();
			onUpdate(json.item);
		}
	}

	async function handleDelete() {
		const res = await fetch(`/api/privilege-items/${item.id}`, { method: "DELETE" });
		if (res.ok) onDelete(item.id);
	}

	return (
		<div
			className={`rounded-2xl border bg-slate-900 p-4 flex flex-col gap-3 transition-colors relative ${item.isActive ? "border-slate-800 hover:border-primary/30" : "border-slate-800/50 opacity-60"}`}
		>
			{/* Edit mode */}
			{editing ? (
				<>
					<input
						type="text"
						value={draft.name}
						onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
						className="rounded-lg border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						placeholder="Item name"
					/>
					<div className="flex gap-2">
						<div className="flex items-center gap-1 flex-1">
							<input
								type="number"
								min={0}
								max={10000}
								value={draft.cost}
								onChange={(e) => setDraft((d) => ({ ...d, cost: Number(e.target.value) }))}
								className="w-full rounded-lg border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
							/>
							<span className="text-xs text-slate-400 shrink-0">RAM</span>
						</div>
						<div className="flex items-center gap-1 flex-1">
							<input
								type="number"
								min={1}
								max={300}
								placeholder="min"
								value={draft.durationMinutes ?? ""}
								onChange={(e) =>
									setDraft((d) => ({
										...d,
										durationMinutes: e.target.value ? Number(e.target.value) : null,
									}))
								}
								className="w-full rounded-lg border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
							/>
							<span className="text-xs text-slate-400 shrink-0">min</span>
						</div>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setEditing(false)}
							className="flex-1 rounded-xl border border-slate-800 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/50 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={saveEdit}
							disabled={saving || !draft.name.trim()}
							className="flex-1 rounded-xl bg-primary text-indigo-400-foreground py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
						>
							{saving ? "Saving…" : "Save"}
						</button>
					</div>
				</>
			) : (
				<>
					<div className="flex items-start justify-between gap-2">
						<div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
							<ShoppingBagIcon className="h-5 w-5 text-amber-400" />
						</div>
						<div className="flex items-center gap-1">
							<CostBadge cost={item.cost} />
							{/* Edit button */}
							<button
								type="button"
								onClick={() => {
									setDraft({
										name: item.name,
										cost: item.cost,
										durationMinutes: item.durationMinutes,
									});
									setEditing(true);
								}}
								className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
								aria-label="Edit item"
							>
								<PencilIcon className="h-3.5 w-3.5" />
							</button>
							{/* Toggle hide/show */}
							<button
								type="button"
								onClick={toggleActive}
								className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
								aria-label={item.isActive ? "Hide from store" : "Show in store"}
								title={item.isActive ? "Hide from store" : "Show in store"}
							>
								<EyeOffIcon className="h-3.5 w-3.5" />
							</button>
							{/* Delete */}
							<button
								type="button"
								onClick={handleDelete}
								className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-destructive/10 transition-colors"
								aria-label="Delete item"
							>
								<Trash2Icon className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
					<div>
						<p className="text-sm font-semibold text-slate-200">{item.name}</p>
						<div className="flex items-center gap-2 mt-1">
							{item.durationMinutes && (
								<p className="text-xs text-slate-400 flex items-center gap-1">
									<ClockIcon className="h-3 w-3" />
									{item.durationMinutes}min
								</p>
							)}
							{!item.isActive && (
								<span className="text-xs text-slate-400 flex items-center gap-1">
									<EyeOffIcon className="h-3 w-3" />
									Hidden
								</span>
							)}
						</div>
					</div>

					{/* Grant button — only for active items */}
					{item.isActive && classId && roster.length > 0 && (
						<div className="relative" ref={pickerRef}>
							<button
								type="button"
								onClick={() => setShowPicker((s) => !s)}
								disabled={grantState === "loading"}
								className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-500/40 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 active:scale-95 disabled:opacity-50 transition-all"
							>
								<GiftIcon className="h-3 w-3" />
								Grant to student
							</button>

							{showPicker && (
								<div className="absolute bottom-full mb-2 left-0 right-0 z-20 rounded-xl border border-slate-800 bg-popover shadow-xl p-2 flex flex-col gap-1.5">
									<select
										value={selectedRosterId}
										onChange={(e) => setSelectedRosterId(e.target.value)}
										className="w-full rounded-lg border border-slate-800 bg-slate-800/30 px-2 py-1.5 text-sm text-slate-200 focus:outline-none"
									>
										<option value="">Pick a student…</option>
										{roster.map((s) => (
											<option key={s.id} value={s.id}>
												{s.firstInitial}.{s.lastInitial}. — 🐏 {s.balance}
											</option>
										))}
									</select>
									<button
										type="button"
										onClick={handleGrant}
										disabled={!selectedRosterId || grantState === "loading"}
										className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 active:scale-95 transition-all py-1.5 text-xs font-bold text-white"
									>
										{grantState === "loading"
											? "Granting…"
											: grantState === "done"
												? "✓ Granted!"
												: grantState === "error"
													? "Failed — try again"
													: `Grant (${item.cost} 🐏)`}
									</button>
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}

// ─── Purchase approval card ───────────────────────────────────────────────────

function PurchaseCard({
	purchase,
	classId,
	onProcessed,
}: {
	purchase: Purchase;
	classId: string;
	onProcessed: () => void;
}) {
	const [state, setState] = useState<"idle" | "loading" | "done">("idle");

	async function process(action: "approve" | "reject") {
		setState("loading");
		try {
			await fetch(`/api/classes/${classId}/purchases/${purchase.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});
			setState("done");
			setTimeout(onProcessed, 600);
		} catch {
			setState("idle");
		}
	}

	if (state === "done") {
		return (
			<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-2">
				<CheckIcon className="h-4 w-4 text-emerald-400" />
				<span className="text-sm text-emerald-400">Processed</span>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
					<span className="text-[11px] font-bold text-white">
						{purchase.firstInitial}
						{purchase.lastInitial}
					</span>
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold text-slate-200">
						{purchase.firstInitial}.{purchase.lastInitial}.
					</p>
					<p className="text-xs text-slate-400 truncate">{purchase.itemName}</p>
				</div>
				<CostBadge cost={purchase.cost} />
			</div>

			{purchase.itemDurationMinutes && (
				<p className="text-xs text-slate-400 flex items-center gap-1">
					<ClockIcon className="h-3 w-3" />
					{purchase.itemDurationMinutes}min
				</p>
			)}

			<p className="text-[10px] text-slate-400">Requested {fmtTime(purchase.requestedAt)}</p>

			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => process("approve")}
					disabled={state === "loading"}
					className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 transition-all py-2 text-xs font-semibold text-white"
				>
					<CheckIcon className="h-3.5 w-3.5" />
					Approve
				</button>
				<button
					type="button"
					onClick={() => process("reject")}
					disabled={state === "loading"}
					className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-800/70 active:scale-95 disabled:opacity-50 transition-all py-2 text-xs font-semibold text-slate-400"
				>
					<XIcon className="h-3.5 w-3.5" />
					Reject
				</button>
			</div>
		</div>
	);
}

// ─── Store open/closed toggle ─────────────────────────────────────────────────

function StoreStatusToggle() {
	const [open, setOpen] = useState<boolean | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		fetch("/api/teacher-settings")
			.then((r) => r.json())
			.then((j) => setOpen(j.settings?.storeIsOpen ?? false))
			.catch(() => setOpen(false));
	}, []);

	async function toggle() {
		if (open === null || saving) return;
		const next = !open;
		setSaving(true);
		setOpen(next);
		try {
			await fetch("/api/teacher-settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ storeIsOpen: next }),
			});
		} catch {
			/* noop */
		} finally {
			setSaving(false);
		}
	}

	if (open === null) return null;

	return (
		<button
			type="button"
			onClick={toggle}
			disabled={saving}
			className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 ${
				open
					? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
					: "bg-slate-800 text-slate-400 border border-slate-800 hover:bg-slate-800/70"
			}`}
		>
			<span
				className={`h-2 w-2 rounded-full ${open ? "bg-emerald-400 animate-pulse" : "bg-slate-800-foreground"}`}
			/>
			{open ? "Store Open" : "Store Closed"}
		</button>
	);
}

// ─── Fine preset card ─────────────────────────────────────────────────────────

function FineCard({
	fine,
	classId,
	roster,
	onUpdate,
	onDelete,
}: {
	fine: FinePreset;
	classId: string;
	roster: RosterEntry[];
	onUpdate: (updated: FinePreset) => void;
	onDelete: (id: string) => void;
}) {
	const [showPicker, setShowPicker] = useState(false);
	const [selectedRosterId, setSelectedRosterId] = useState("");
	const [applyState, setApplyState] = useState<"idle" | "loading" | "done" | "error">("idle");
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState({ name: fine.name, amount: fine.amount });
	const pickerRef = useRef<HTMLDivElement>(null);

	// Close picker on outside click
	useEffect(() => {
		if (!showPicker) return;
		function handler(e: MouseEvent) {
			if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
				setShowPicker(false);
			}
		}
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showPicker]);

	async function applyFine() {
		if (!selectedRosterId || !classId || applyState === "loading") return;
		setApplyState("loading");
		try {
			const res = await fetch(`/api/classes/${classId}/ram-bucks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rosterId: selectedRosterId,
					amount: -fine.amount,
					type: "behavior-fine",
					reason: fine.name,
				}),
			});
			if (!res.ok) throw new Error("Failed");
			setApplyState("done");
			setTimeout(() => {
				setApplyState("idle");
				setShowPicker(false);
				setSelectedRosterId("");
			}, 1500);
		} catch {
			setApplyState("error");
			setTimeout(() => setApplyState("idle"), 2000);
		}
	}

	function saveEdit() {
		if (!draft.name.trim()) return;
		onUpdate({ ...fine, name: draft.name.trim(), amount: draft.amount });
		setEditing(false);
	}

	return (
		<div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3">
			{editing ? (
				<>
					<input
						type="text"
						value={draft.name}
						onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
						className="rounded-lg border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						placeholder="Fine name"
					/>
					<div className="flex items-center gap-2">
						<input
							type="number"
							min={1}
							max={1000}
							value={draft.amount}
							onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))}
							className="w-24 rounded-lg border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						<span className="text-xs text-slate-400">🐏 RAM Bucks</span>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => {
								setDraft({ name: fine.name, amount: fine.amount });
								setEditing(false);
							}}
							className="flex-1 rounded-xl border border-slate-800 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800/50 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={saveEdit}
							disabled={!draft.name.trim()}
							className="flex-1 rounded-xl bg-primary py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
						>
							Save
						</button>
					</div>
				</>
			) : (
				<>
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 min-w-0">
							<div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
								<MinusCircleIcon className="h-4 w-4 text-red-400" />
							</div>
							<p className="text-sm font-semibold text-slate-200 truncate">{fine.name}</p>
						</div>
						<div className="flex items-center gap-1 shrink-0">
							<span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-xs font-bold text-red-400">
								- {fine.amount} 🐏
							</span>
							<button
								type="button"
								onClick={() => {
									setDraft({ name: fine.name, amount: fine.amount });
									setEditing(true);
								}}
								className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
								aria-label="Edit fine"
							>
								<PencilIcon className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onClick={() => onDelete(fine.id)}
								className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-destructive/10 transition-colors"
								aria-label="Delete fine"
							>
								<Trash2Icon className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					{/* Student picker */}
					{classId && roster.length > 0 && (
						<div className="relative" ref={pickerRef}>
							<button
								type="button"
								onClick={() => setShowPicker((s) => !s)}
								disabled={applyState === "loading"}
								className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-red-500/40 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 active:scale-95 disabled:opacity-50 transition-all"
							>
								<MinusCircleIcon className="h-3 w-3" />
								Fine a student
							</button>

							{showPicker && (
								<div className="absolute bottom-full mb-2 left-0 right-0 z-20 rounded-xl border border-slate-800 bg-popover shadow-xl p-2 flex flex-col gap-1.5">
									<select
										value={selectedRosterId}
										onChange={(e) => setSelectedRosterId(e.target.value)}
										className="w-full rounded-lg border border-slate-800 bg-slate-800/30 px-2 py-1.5 text-sm text-slate-200 focus:outline-none"
									>
										<option value="">Pick a student…</option>
										{roster.map((s) => (
											<option key={s.id} value={s.id}>
												{s.firstInitial}.{s.lastInitial}. — 🐏 {s.balance}
											</option>
										))}
									</select>
									<button
										type="button"
										onClick={applyFine}
										disabled={!selectedRosterId || applyState === "loading"}
										className="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 active:scale-95 transition-all py-1.5 text-xs font-bold text-white"
									>
										{applyState === "loading"
											? "Applying…"
											: applyState === "done"
												? "✓ Fine applied"
												: applyState === "error"
													? "Failed — try again"
													: `Deduct ${fine.amount} 🐏`}
									</button>
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ActiveTab = "items" | "fines" | "pending";

export default function StorePage() {
	const [classes, setClasses] = useState<ClassRow[]>([]);
	const [selectedClassId, setSelectedClassId] = useState("");
	const [items, setItems] = useState<PrivilegeItem[]>([]);
	const [purchases, setPurchases] = useState<Purchase[]>([]);
	const [roster, setRoster] = useState<RosterEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [addingItem, setAddingItem] = useState(false);
	const [showHidden, setShowHidden] = useState(false);
	const [activeTab, setActiveTab] = useState<ActiveTab>("items");

	// Fine presets — persisted to localStorage
	const [fines, setFines] = useState<FinePreset[]>(() => {
		if (typeof window === "undefined") return DEFAULT_FINES;
		try {
			const stored = localStorage.getItem(FINES_STORAGE_KEY);
			if (stored) return JSON.parse(stored) as FinePreset[];
		} catch {
			/* noop */
		}
		return DEFAULT_FINES;
	});

	// Persist fines to localStorage on change
	useEffect(() => {
		try {
			localStorage.setItem(FINES_STORAGE_KEY, JSON.stringify(fines));
		} catch {
			/* noop */
		}
	}, [fines]);

	const fetchItems = useCallback(async () => {
		try {
			const res = await fetch("/api/privilege-items?all=true");
			const j = await res.json();
			setItems(j.items ?? []);
		} catch {
			/* noop */
		}
	}, []);

	useEffect(() => {
		fetch("/api/classes")
			.then((r) => r.json())
			.then((j) => {
				const active = (j.classes ?? []).filter((c: ClassRow) => !c.isArchived);
				setClasses(active);
				if (active.length > 0) setSelectedClassId(active[0].id);
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		fetchItems();
	}, [fetchItems]);

	const fetchPurchases = useCallback(async (classId: string) => {
		if (!classId) return;
		setLoading(true);
		try {
			const res = await fetch(`/api/classes/${classId}/purchases`);
			if (res.ok) setPurchases((await res.json()).purchases ?? []);
		} catch {
			/* noop */
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!selectedClassId) return;
		fetch(`/api/classes/${selectedClassId}/roster-overview`)
			.then((r) => r.json())
			.then((j) =>
				setRoster(
					(j.students ?? []).map(
						(s: { rosterId: string; displayName: string; balance: number }) => ({
							id: s.rosterId,
							firstInitial: s.displayName.split(" ")[0]?.[0] ?? "?",
							lastInitial: s.displayName.split(" ")[1]?.[0] ?? "",
							balance: s.balance,
						}),
					),
				),
			)
			.catch(() => setRoster([]));
	}, [selectedClassId]);

	useEffect(() => {
		if (selectedClassId) fetchPurchases(selectedClassId);
	}, [selectedClassId, fetchPurchases]);

	async function handleAddItem() {
		setAddingItem(true);
		try {
			const res = await fetch("/api/privilege-items", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "New Item", cost: 20 }),
			});
			if (!res.ok) throw new Error("Failed");
			await fetchItems();
		} catch {
			/* noop */
		} finally {
			setAddingItem(false);
		}
	}

	function addFine() {
		const newFine: FinePreset = {
			id: String(Date.now()),
			name: "New Fine",
			amount: 5,
		};
		setFines((prev) => [...prev, newFine]);
	}

	function updateFine(updated: FinePreset) {
		setFines((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
	}

	function deleteFine(id: string) {
		setFines((prev) => prev.filter((f) => f.id !== id));
	}

	const activeItems = items.filter((i) => i.isActive);
	const hiddenItems = items.filter((i) => !i.isActive);
	const visibleItems = showHidden ? items : activeItems;
	const pendingCount = purchases.filter((p) => p.status === "pending").length;

	return (
		<div className="min-h-[calc(100vh-3.5rem)] bg-[#0d1525]">
			{/* Page header */}
			<div className="border-b bg-slate-900">
				<div className="mx-auto max-w-7xl px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-3">
					<div className="flex items-center gap-3 flex-1">
						<div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
							<ShoppingCartIcon className="h-5 w-5 text-amber-400" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-slate-200">Privilege Store</h1>
							<p className="text-xs text-slate-400">
								Grant items, approve requests, control store hours
							</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						{classes.length > 1 && (
							<select
								value={selectedClassId}
								onChange={(e) => setSelectedClassId(e.target.value)}
								className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
							>
								{classes.map((c) => (
									<option key={c.id} value={c.id}>
										{c.label}
									</option>
								))}
							</select>
						)}
						<StoreStatusToggle />
					</div>
				</div>

				{/* Tab bar */}
				<div className="mx-auto max-w-7xl px-4">
					<div className="flex gap-0">
						<button
							type="button"
							onClick={() => setActiveTab("items")}
							className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
								activeTab === "items"
									? "border-indigo-500 text-slate-100"
									: "border-transparent text-slate-500 hover:text-slate-300"
							}`}
						>
							<ShoppingBagIcon className="h-4 w-4" />
							Store Items
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("fines")}
							className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
								activeTab === "fines"
									? "border-indigo-500 text-slate-100"
									: "border-transparent text-slate-500 hover:text-slate-300"
							}`}
						>
							<MinusCircleIcon className="h-4 w-4" />
							RAM Buck Fines
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("pending")}
							className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
								activeTab === "pending"
									? "border-indigo-500 text-slate-100"
									: "border-transparent text-slate-500 hover:text-slate-300"
							}`}
						>
							<ClockIcon className="h-4 w-4" />
							Pending
							{pendingCount > 0 && (
								<span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 px-1.5">
									{pendingCount}
								</span>
							)}
						</button>
					</div>
				</div>
			</div>

			<div className="mx-auto max-w-7xl px-4 py-6">
				{/* ── Tab: Store Items ───────────────────────────────────── */}
				{activeTab === "items" && (
					<div>
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-3">
								<h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
									Items ({activeItems.length} active
									{hiddenItems.length > 0 ? `, ${hiddenItems.length} hidden` : ""})
								</h2>
								{hiddenItems.length > 0 && (
									<button
										type="button"
										onClick={() => setShowHidden((v) => !v)}
										className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200 transition-colors"
									>
										{showHidden ? "Hide inactive" : "Show all"}
									</button>
								)}
							</div>
							<button
								type="button"
								onClick={handleAddItem}
								disabled={addingItem}
								className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800/50 active:scale-95 transition-all px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
							>
								<PlusIcon className="h-3.5 w-3.5" />
								Add Item
							</button>
						</div>

						{visibleItems.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-slate-800 p-10 flex flex-col items-center gap-3 text-center">
								<ShoppingBagIcon className="h-10 w-10 text-slate-400/40" />
								<p className="text-sm text-slate-400">No items yet.</p>
								<button
									type="button"
									onClick={handleAddItem}
									className="flex items-center gap-1.5 rounded-xl bg-primary text-indigo-400-foreground px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
								>
									<PlusIcon className="h-3.5 w-3.5" />
									Add your first item
								</button>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
								{visibleItems.map((item) => (
									<ItemCard
										key={item.id}
										item={item}
										classId={selectedClassId}
										roster={roster}
										onGranted={() => fetchPurchases(selectedClassId)}
										onUpdate={(updated) =>
											setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
										}
										onDelete={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
									/>
								))}
							</div>
						)}
					</div>
				)}

				{/* ── Tab: RAM Buck Fines ────────────────────────────────── */}
				{activeTab === "fines" && (
					<div>
						<div className="flex items-center justify-between mb-4">
							<div>
								<h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
									Fine Presets ({fines.length})
								</h2>
								<p className="text-xs text-slate-500 mt-0.5">
									Quick RAM Buck deductions — saved to your browser
								</p>
							</div>
							<button
								type="button"
								onClick={addFine}
								className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800/50 active:scale-95 transition-all px-3 py-1.5 text-xs font-semibold text-slate-200"
							>
								<PlusIcon className="h-3.5 w-3.5" />
								Add Fine
							</button>
						</div>

						{fines.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-slate-800 p-10 flex flex-col items-center gap-3 text-center">
								<MinusCircleIcon className="h-10 w-10 text-slate-400/40" />
								<p className="text-sm text-slate-400">No fine presets yet.</p>
								<button
									type="button"
									onClick={addFine}
									className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
								>
									<PlusIcon className="h-3.5 w-3.5" />
									Add your first fine
								</button>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
								{fines.map((fine) => (
									<FineCard
										key={fine.id}
										fine={fine}
										classId={selectedClassId}
										roster={roster}
										onUpdate={updateFine}
										onDelete={deleteFine}
									/>
								))}
							</div>
						)}
					</div>
				)}

				{/* ── Tab: Pending Requests ──────────────────────────────── */}
				{activeTab === "pending" && (
					<div>
						<h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
							Pending Requests
							{pendingCount > 0 && (
								<span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 px-1.5">
									{pendingCount}
								</span>
							)}
						</h2>

						{loading ? (
							<div className="flex items-center justify-center py-12">
								<div className="flex gap-1.5">
									{[0, 1, 2].map((i) => (
										<span
											key={i}
											className="h-2 w-2 rounded-full bg-slate-800-foreground/40 animate-bounce"
											style={{ animationDelay: `${i * 150}ms` }}
										/>
									))}
								</div>
							</div>
						) : purchases.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-slate-800 p-8 flex flex-col items-center gap-2 text-center">
								<CheckIcon className="h-8 w-8 text-emerald-500/40" />
								<p className="text-sm text-slate-400">All caught up</p>
								<p className="text-xs text-slate-400/60">No pending purchase requests</p>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
								{purchases.map((p) => (
									<PurchaseCard
										key={p.id}
										purchase={p}
										classId={selectedClassId}
										onProcessed={() => fetchPurchases(selectedClassId)}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
