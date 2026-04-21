"use client";

import { useEffect, useRef, useState } from "react";

type StoreItem = {
	id: string;
	name: string;
	cost: number;
	durationMinutes: number | null;
	sortOrder: number;
};

type StoreData = {
	isOpen: boolean;
	items: StoreItem[];
	balance: number;
	rosterId: string;
};

type PurchaseUpdate = {
	purchaseId: string;
	itemId: string;
	status: "approved" | "rejected";
	newBalance?: number;
};

type Props = {
	sessionId: string;
	isOpen: boolean;
	purchaseUpdate?: PurchaseUpdate | null;
};

const CARD_COLORS = [
	"border-indigo-300 bg-indigo-50",
	"border-violet-300 bg-violet-50",
	"border-pink-300 bg-pink-50",
	"border-amber-300 bg-amber-50",
];

const CARD_ACCENT = ["text-indigo-700", "text-violet-700", "text-pink-700", "text-amber-700"];

function SkeletonCard() {
	return (
		<div className="rounded-2xl border-2 border-slate-200 bg-slate-100 p-4 animate-pulse">
			<div className="h-5 w-3/4 rounded bg-slate-200 mb-3" />
			<div className="h-4 w-1/3 rounded bg-slate-200 mb-4" />
			<div className="h-9 w-full rounded-full bg-slate-200" />
		</div>
	);
}

export function StudentStore({ sessionId, isOpen: isOpenProp, purchaseUpdate }: Props) {
	const [isOpen, setIsOpen] = useState(isOpenProp);
	const [items, setItems] = useState<StoreItem[]>([]);
	const [balance, setBalance] = useState(0);
	const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
	const [deniedItemIds, setDeniedItemIds] = useState<Set<string>>(new Set());
	const [approvedItemIds, setApprovedItemIds] = useState<Set<string>>(new Set());
	const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const seenPurchaseIds = useRef<Set<string>>(new Set());

	// Sync SSE prop → local open state
	useEffect(() => {
		setIsOpen(isOpenProp);
	}, [isOpenProp]);

	// React to teacher approve/reject decisions
	useEffect(() => {
		if (!purchaseUpdate) return;
		const { purchaseId, itemId, status, newBalance } = purchaseUpdate;
		if (seenPurchaseIds.current.has(purchaseId)) return;
		seenPurchaseIds.current.add(purchaseId);

		setPendingItemIds((prev) => {
			const next = new Set(prev);
			next.delete(itemId);
			return next;
		});

		if (status === "approved") {
			if (newBalance !== undefined) setBalance(newBalance);
			setApprovedItemIds((prev) => new Set(prev).add(itemId));
			setTimeout(() => {
				setApprovedItemIds((prev) => {
					const next = new Set(prev);
					next.delete(itemId);
					return next;
				});
			}, 4000);
		} else {
			setDeniedItemIds((prev) => new Set(prev).add(itemId));
			setTimeout(() => {
				setDeniedItemIds((prev) => {
					const next = new Set(prev);
					next.delete(itemId);
					return next;
				});
			}, 6000);
		}
	}, [purchaseUpdate]);

	// Fetch store data on mount
	useEffect(() => {
		let cancelled = false;
		async function fetchStore() {
			setLoading(true);
			setLoadError(null);
			try {
				const res = await fetch(`/api/sessions/${sessionId}/store`);
				if (!res.ok) {
					const { error } = await res.json();
					throw new Error(error ?? "Failed to load store");
				}
				const data: StoreData = await res.json();
				if (!cancelled) {
					setIsOpen(data.isOpen);
					setItems(data.items);
					setBalance(data.balance);
				}
			} catch (err) {
				if (!cancelled) {
					setLoadError(err instanceof Error ? err.message : "Could not load store");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		fetchStore();
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	async function requestItem(itemId: string) {
		setItemErrors((prev) => ({ ...prev, [itemId]: "" }));
		try {
			const res = await fetch(`/api/sessions/${sessionId}/store`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ itemId }),
			});
			if (!res.ok) {
				const { error } = await res.json();
				setItemErrors((prev) => ({ ...prev, [itemId]: error ?? "Request failed" }));
				return;
			}
			setPendingItemIds((prev) => new Set(prev).add(itemId));
		} catch {
			setItemErrors((prev) => ({ ...prev, [itemId]: "Something went wrong — try again" }));
		}
	}

	// ── Loading skeleton ────────────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="flex flex-col gap-4 p-2">
				{/* Balance skeleton */}
				<div className="flex justify-center">
					<div className="h-14 w-40 rounded-2xl bg-amber-100 animate-pulse" />
				</div>
				{/* Item skeletons */}
				<div className="grid grid-cols-1 gap-3">
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
				</div>
			</div>
		);
	}

	// ── Load error ──────────────────────────────────────────────────────────────
	if (loadError) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
				<span className="text-5xl">😬</span>
				<p className="text-base font-bold text-slate-700">Oops!</p>
				<p className="text-sm text-slate-500">{loadError}</p>
			</div>
		);
	}

	// ── Store closed ────────────────────────────────────────────────────────────
	if (!isOpen) {
		return (
			<div className="flex flex-col items-center justify-center gap-5 py-12 text-center">
				<div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100 shadow-inner text-5xl">
					🔒
				</div>
				<div>
					<p className="text-xl font-black text-slate-700">Store is Closed</p>
					<p className="text-sm text-slate-500 mt-1 max-w-[200px] leading-relaxed">
						Check back later — your teacher will open it soon!
					</p>
				</div>
				<div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-5 py-3 text-sm font-semibold text-indigo-600">
					Your balance: <span className="text-amber-600">🐏 {balance}</span>
				</div>
			</div>
		);
	}

	// ── Store open ──────────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Sticky balance banner */}
			<div className="shrink-0 flex justify-center py-3 px-4 bg-white border-b border-slate-100">
				<div className="flex items-center gap-2 rounded-2xl bg-amber-50 border-2 border-amber-300 px-6 py-2.5 shadow-sm">
					<span className="text-2xl leading-none">🪙</span>
					<div className="flex flex-col leading-tight">
						<span className="text-xl font-black text-amber-600">{balance}</span>
						<span className="text-xs font-bold text-amber-500 uppercase tracking-wide">
							RAM Bucks
						</span>
					</div>
				</div>
			</div>

			{/* Scrollable items */}
			<div className="flex-1 overflow-y-auto px-4 py-3">
			{items.length === 0 ? (
				<div className="flex flex-col items-center gap-3 py-8 text-center">
					<span className="text-4xl">🛒</span>
					<p className="text-sm font-semibold text-slate-500">No items available right now</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 pb-2">
					{items.map((item, idx) => {
						const colorIdx = idx % CARD_COLORS.length;
						const isPending = pendingItemIds.has(item.id);
						const isApproved = approvedItemIds.has(item.id);
						const isDenied = deniedItemIds.has(item.id);
						const canAfford = balance >= item.cost;
						const shortage = item.cost - balance;
						const err = itemErrors[item.id];

						return (
							<div
								key={item.id}
								className={`rounded-2xl border-2 p-4 shadow-sm transition-shadow hover:shadow-md ${CARD_COLORS[colorIdx]}`}
							>
								<div className="flex items-start justify-between gap-3 mb-3">
									<p className={`text-base font-black leading-tight ${CARD_ACCENT[colorIdx]}`}>
										{item.name}
									</p>
									<div className="shrink-0 flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5">
										<span className="text-base leading-none">🐏</span>
										<span className="text-sm font-black text-amber-700">{item.cost}</span>
									</div>
								</div>

								{item.durationMinutes != null && (
									<p className="text-xs font-semibold text-slate-500 mb-3">
										⏱ {item.durationMinutes} min
									</p>
								)}

								{err && (
									<p className="text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 mb-2">
										{err}
									</p>
								)}

								{isApproved ? (
									<button
										type="button"
										disabled
										className="w-full rounded-full bg-emerald-500 border border-emerald-400 py-2 text-sm font-black text-white cursor-default"
									>
										Approved! 🎉
									</button>
								) : isDenied ? (
									<button
										type="button"
										disabled
										className="w-full rounded-full bg-rose-100 border border-rose-300 py-2 text-sm font-black text-rose-600 cursor-not-allowed"
									>
										Denied ❌
									</button>
								) : isPending ? (
									<button
										type="button"
										disabled
										className="w-full rounded-full bg-amber-50 border border-amber-300 py-2 text-sm font-black text-amber-600 cursor-not-allowed"
									>
										Pending… ⏳
									</button>
								) : canAfford ? (
									<button
										type="button"
										onClick={() => requestItem(item.id)}
										className="w-full rounded-full bg-indigo-500 py-2 text-sm font-black text-white shadow-sm active:scale-95 transition-transform hover:bg-indigo-600"
									>
										Request 🛒
									</button>
								) : (
									<button
										type="button"
										disabled
										className="w-full rounded-full bg-slate-200 border border-slate-300 py-2 text-xs font-black text-slate-500 cursor-not-allowed"
									>
										Need {shortage} more 🐏
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}
			</div>
		</div>
	);
}
