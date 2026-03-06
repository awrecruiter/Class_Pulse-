"use client";

import {
	CheckIcon,
	ClockIcon,
	CoinsIcon,
	EyeOffIcon,
	GiftIcon,
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
			className={`rounded-2xl border bg-card p-4 flex flex-col gap-3 transition-colors relative ${item.isActive ? "border-border hover:border-primary/30" : "border-border/50 opacity-60"}`}
		>
			{/* Edit mode */}
			{editing ? (
				<>
					<input
						type="text"
						value={draft.name}
						onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
						className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
								className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
							/>
							<span className="text-xs text-muted-foreground shrink-0">RAM</span>
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
								className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
							/>
							<span className="text-xs text-muted-foreground shrink-0">min</span>
						</div>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setEditing(false)}
							className="flex-1 rounded-xl border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={saveEdit}
							disabled={saving || !draft.name.trim()}
							className="flex-1 rounded-xl bg-primary text-primary-foreground py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
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
								className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
								aria-label="Edit item"
							>
								<PencilIcon className="h-3.5 w-3.5" />
							</button>
							{/* Toggle hide/show */}
							<button
								type="button"
								onClick={toggleActive}
								className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
								aria-label={item.isActive ? "Hide from store" : "Show in store"}
								title={item.isActive ? "Hide from store" : "Show in store"}
							>
								<EyeOffIcon className="h-3.5 w-3.5" />
							</button>
							{/* Delete */}
							<button
								type="button"
								onClick={handleDelete}
								className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
								aria-label="Delete item"
							>
								<Trash2Icon className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
					<div>
						<p className="text-sm font-semibold text-foreground">{item.name}</p>
						<div className="flex items-center gap-2 mt-1">
							{item.durationMinutes && (
								<p className="text-xs text-muted-foreground flex items-center gap-1">
									<ClockIcon className="h-3 w-3" />
									{item.durationMinutes}min
								</p>
							)}
							{!item.isActive && (
								<span className="text-xs text-muted-foreground flex items-center gap-1">
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
								<div className="absolute bottom-full mb-2 left-0 right-0 z-20 rounded-xl border border-border bg-popover shadow-xl p-2 flex flex-col gap-1.5">
									<select
										value={selectedRosterId}
										onChange={(e) => setSelectedRosterId(e.target.value)}
										className="w-full rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-sm text-foreground focus:outline-none"
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
		<div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
					<span className="text-[11px] font-bold text-white">
						{purchase.firstInitial}
						{purchase.lastInitial}
					</span>
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold text-foreground">
						{purchase.firstInitial}.{purchase.lastInitial}.
					</p>
					<p className="text-xs text-muted-foreground truncate">{purchase.itemName}</p>
				</div>
				<CostBadge cost={purchase.cost} />
			</div>

			{purchase.itemDurationMinutes && (
				<p className="text-xs text-muted-foreground flex items-center gap-1">
					<ClockIcon className="h-3 w-3" />
					{purchase.itemDurationMinutes}min
				</p>
			)}

			<p className="text-[10px] text-muted-foreground">Requested {fmtTime(purchase.requestedAt)}</p>

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
					className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-muted hover:bg-muted/70 active:scale-95 disabled:opacity-50 transition-all py-2 text-xs font-semibold text-muted-foreground"
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
					: "bg-muted text-muted-foreground border border-border hover:bg-muted/70"
			}`}
		>
			<span
				className={`h-2 w-2 rounded-full ${open ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`}
			/>
			{open ? "Store Open" : "Store Closed"}
		</button>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StorePage() {
	const [classes, setClasses] = useState<ClassRow[]>([]);
	const [selectedClassId, setSelectedClassId] = useState("");
	const [items, setItems] = useState<PrivilegeItem[]>([]);
	const [purchases, setPurchases] = useState<Purchase[]>([]);
	const [roster, setRoster] = useState<RosterEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [addingItem, setAddingItem] = useState(false);
	const [showHidden, setShowHidden] = useState(false);

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

	const activeItems = items.filter((i) => i.isActive);
	const hiddenItems = items.filter((i) => !i.isActive);
	const visibleItems = showHidden ? items : activeItems;
	const pendingCount = purchases.filter((p) => p.status === "pending").length;

	return (
		<div className="min-h-[calc(100vh-3.5rem)] bg-background">
			{/* Page header */}
			<div className="border-b bg-card">
				<div className="mx-auto max-w-7xl px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-3">
					<div className="flex items-center gap-3 flex-1">
						<div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
							<ShoppingCartIcon className="h-5 w-5 text-amber-400" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground">Privilege Store</h1>
							<p className="text-xs text-muted-foreground">
								Grant items, approve requests, control store hours
							</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						{classes.length > 1 && (
							<select
								value={selectedClassId}
								onChange={(e) => setSelectedClassId(e.target.value)}
								className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
			</div>

			<div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
				{/* ── LEFT: Privilege items ─────────────────────────────── */}
				<div>
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
								Items ({activeItems.length} active
								{hiddenItems.length > 0 ? `, ${hiddenItems.length} hidden` : ""})
							</h2>
							{hiddenItems.length > 0 && (
								<button
									type="button"
									onClick={() => setShowHidden((v) => !v)}
									className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
								>
									{showHidden ? "Hide inactive" : "Show all"}
								</button>
							)}
						</div>
						<button
							type="button"
							onClick={handleAddItem}
							disabled={addingItem}
							className="flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted/50 active:scale-95 transition-all px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50"
						>
							<PlusIcon className="h-3.5 w-3.5" />
							Add Item
						</button>
					</div>

					{visibleItems.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border p-10 flex flex-col items-center gap-3 text-center">
							<ShoppingBagIcon className="h-10 w-10 text-muted-foreground/40" />
							<p className="text-sm text-muted-foreground">No items yet.</p>
							<button
								type="button"
								onClick={handleAddItem}
								className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
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

				{/* ── RIGHT: Pending approvals ──────────────────────────── */}
				<div>
					<h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
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
										className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
										style={{ animationDelay: `${i * 150}ms` }}
									/>
								))}
							</div>
						</div>
					) : purchases.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border p-8 flex flex-col items-center gap-2 text-center">
							<CheckIcon className="h-8 w-8 text-emerald-500/40" />
							<p className="text-sm text-muted-foreground">All caught up</p>
							<p className="text-xs text-muted-foreground/60">No pending purchase requests</p>
						</div>
					) : (
						<div className="flex flex-col gap-3">
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
			</div>
		</div>
	);
}
