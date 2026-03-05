"use client";

import {
	CheckIcon,
	ClockIcon,
	CoinsIcon,
	ShoppingBagIcon,
	ShoppingCartIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

function ItemCard({ item }: { item: PrivilegeItem }) {
	return (
		<div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
			<div className="flex items-start justify-between gap-2">
				<div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
					<ShoppingBagIcon className="h-5 w-5 text-amber-400" />
				</div>
				<CostBadge cost={item.cost} />
			</div>
			<div>
				<p className="text-sm font-semibold text-foreground">{item.name}</p>
				{item.durationMinutes && (
					<p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
						<ClockIcon className="h-3 w-3" />
						{item.durationMinutes}min
					</p>
				)}
			</div>
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
			{/* Student + item */}
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

			{/* Actions */}
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
	const [loading, setLoading] = useState(true);

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
		fetch("/api/privilege-items")
			.then((r) => r.json())
			.then((j) => setItems((j.items ?? []).filter((i: PrivilegeItem) => i.isActive)))
			.catch(() => {});
	}, []);

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
		if (selectedClassId) fetchPurchases(selectedClassId);
	}, [selectedClassId, fetchPurchases]);

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
								Manage items, approve requests, control store hours
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
					<h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
						Active Items ({items.length})
					</h2>
					{items.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border p-10 flex flex-col items-center gap-3 text-center">
							<ShoppingBagIcon className="h-10 w-10 text-muted-foreground/40" />
							<p className="text-sm text-muted-foreground">No privilege items yet.</p>
							<p className="text-xs text-muted-foreground/60">
								Add items in Settings to populate the store.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
							{items.map((item) => (
								<ItemCard key={item.id} item={item} />
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
