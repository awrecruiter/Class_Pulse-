"use client";

import { useEffect, useRef, useState } from "react";
import type { FeeRow, LedgerEntry } from "@/app/api/sessions/[id]/ledger/route";

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
	currencyName?: string;
	currencyEmoji?: string;
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

const KIND_CONFIG = {
	credit: { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", sign: "+" },
	debit: { color: "text-rose-600", bg: "bg-rose-50 border-rose-200", sign: "" },
	pending: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", sign: "" },
	rejected: { color: "text-slate-500", bg: "bg-slate-50 border-slate-200", sign: "" },
};

const EARN_GUIDE = [
	{ emoji: "✅", label: "Correct answer", amount: 5 },
	{ emoji: "⭐", label: "Mastery bonus", amount: 25 },
	{ emoji: "📊", label: "iReady goal", amount: 20 },
	{ emoji: "🌟", label: "Good behavior", amount: null, note: "Teacher's choice" },
	{ emoji: "🏆", label: "Group activity win", amount: null, note: "Teacher's choice" },
];

function LedgerPanel({
	sessionId,
	balance,
	onClose,
	currencyName = "RAM Bucks",
	currencyEmoji = "🐏",
}: {
	sessionId: string;
	balance: number;
	onClose: () => void;
	currencyName?: string;
	currencyEmoji?: string;
}) {
	const [tab, setTab] = useState<"history" | "guide">("history");
	const [entries, setEntries] = useState<LedgerEntry[]>([]);
	const [fees, setFees] = useState<FeeRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const res = await fetch(`/api/sessions/${sessionId}/ledger`);
				if (!res.ok) {
					const { error: e } = await res.json();
					throw new Error(e ?? "Failed to load");
				}
				const data: { entries: LedgerEntry[]; fees: FeeRow[] } = await res.json();
				if (!cancelled) {
					setEntries(data.entries);
					setFees(data.fees ?? []);
				}
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : "Could not load");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	function fmt(iso: string) {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHrs = Math.floor(diffMins / 60);
		if (diffHrs < 24) return `${diffHrs}h ago`;
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Header */}
			<div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
				<div className="flex items-center gap-2">
					<span className="text-lg">{currencyEmoji}</span>
					<span className="text-base font-black text-slate-700">{currencyName}</span>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
					aria-label="Close"
				>
					×
				</button>
			</div>

			{/* Balance + tabs */}
			<div className="shrink-0 bg-amber-50 border-b border-amber-100">
				<div className="flex items-center justify-between px-4 py-2">
					<span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Balance</span>
					<span className="text-lg font-black text-amber-600">🪙 {balance}</span>
				</div>
				<div className="flex px-3 pb-0 gap-1">
					{(["history", "guide"] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className={`flex-1 py-1.5 text-xs font-bold rounded-t-lg transition-colors ${
								tab === t
									? "bg-white text-indigo-600 shadow-sm"
									: "text-amber-700 hover:text-amber-900"
							}`}
						>
							{t === "history" ? "📋 History" : "💡 How to Earn"}
						</button>
					))}
				</div>
			</div>

			{/* Tab content */}
			<div className="flex-1 overflow-y-auto px-3 py-2">
				{tab === "history" ? (
					loading ? (
						<div className="flex flex-col gap-2 pt-2">
							{[1, 2, 3, 4].map((i) => (
								<div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
							))}
						</div>
					) : error ? (
						<div className="flex flex-col items-center gap-2 py-10 text-center">
							<span className="text-3xl">😬</span>
							<p className="text-xs text-slate-500">{error}</p>
						</div>
					) : entries.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-10 text-center">
							<span className="text-3xl">📭</span>
							<p className="text-sm font-semibold text-slate-500">No transactions yet</p>
							<p className="text-xs text-slate-400">{`Earn ${currencyName} by answering questions!`}</p>
						</div>
					) : (
						<div className="flex flex-col gap-1.5 pb-2">
							{entries.map((entry) => {
								const cfg = KIND_CONFIG[entry.kind];
								return (
									<div
										key={entry.id}
										className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${cfg.bg}`}
									>
										<div className="flex-1 min-w-0">
											<p className="text-xs font-semibold text-slate-700 leading-tight truncate">
												{entry.label}
											</p>
											<p className="text-xs text-slate-400 mt-0.5">{fmt(entry.date)}</p>
										</div>
										<div className="shrink-0 text-right">
											{entry.amount !== null ? (
												<span className={`text-sm font-black ${cfg.color}`}>
													{entry.amount > 0 ? "+" : ""}
													{entry.amount} {currencyEmoji}
												</span>
											) : entry.kind === "pending" ? (
												<span className="text-xs font-bold text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">
													Pending ⏳
												</span>
											) : (
												<span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
													Denied ❌
												</span>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)
				) : (
					<div className="flex flex-col gap-3 pb-2 pt-1">
						{/* Ways to earn */}
						<div>
							<p className="text-xs font-black text-emerald-700 uppercase tracking-wide mb-1.5 px-1">
								{`Ways to Earn ${currencyEmoji}`}
							</p>
							<div className="flex flex-col gap-1.5">
								{EARN_GUIDE.map((row) => (
									<div
										key={row.label}
										className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5"
									>
										<span className="text-lg leading-none shrink-0">{row.emoji}</span>
										<p className="flex-1 text-xs font-semibold text-slate-700">{row.label}</p>
										<span className="shrink-0 text-sm font-black text-emerald-600">
											{row.amount !== null ? (
												`+${row.amount} ${currencyEmoji}`
											) : (
												<span className="text-xs font-bold text-emerald-500">{row.note}</span>
											)}
										</span>
									</div>
								))}
							</div>
						</div>

						{/* Behavior fines */}
						{fees.length > 0 && (
							<div>
								<p className="text-xs font-black text-rose-600 uppercase tracking-wide mb-1.5 px-1">
									Behavior Fines ⚠️
								</p>
								<div className="flex flex-col gap-1.5">
									{fees.map((fee) => (
										<div
											key={fee.step}
											className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5"
										>
											<span className="shrink-0 text-xs font-black text-rose-400 w-5 text-center">
												{fee.step}
											</span>
											<p className="flex-1 text-xs font-semibold text-slate-700">{fee.label}</p>
											<span className="shrink-0 text-sm font-black text-rose-600">
												−{fee.deductionAmount} {currencyEmoji}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

export function StudentStore({
	sessionId,
	isOpen: isOpenProp,
	purchaseUpdate,
	currencyName = "RAM Bucks",
	currencyEmoji = "🐏",
}: Props) {
	const [isOpen, setIsOpen] = useState(isOpenProp);
	const [items, setItems] = useState<StoreItem[]>([]);
	const [balance, setBalance] = useState(0);
	const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
	const [deniedItemIds, setDeniedItemIds] = useState<Set<string>>(new Set());
	const [approvedItemIds, setApprovedItemIds] = useState<Set<string>>(new Set());
	const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [showLedger, setShowLedger] = useState(false);
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

	// ── Ledger overlay ──────────────────────────────────────────────────────────
	if (showLedger) {
		return (
			<LedgerPanel
				sessionId={sessionId}
				balance={balance}
				onClose={() => setShowLedger(false)}
				currencyName={currencyName}
				currencyEmoji={currencyEmoji}
			/>
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
				<button
					type="button"
					onClick={() => setShowLedger(true)}
					className="rounded-2xl bg-indigo-50 border border-indigo-200 px-5 py-3 text-sm font-semibold text-indigo-600 active:scale-95 transition-transform"
				>
					Your balance:{" "}
					<span className="text-amber-600">
						{currencyEmoji} {balance}
					</span>
					<span className="text-xs text-indigo-400 ml-2">tap for history</span>
				</button>
			</div>
		);
	}

	// ── Store open ──────────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Sticky balance banner — tappable to open ledger */}
			<button
				type="button"
				onClick={() => setShowLedger(true)}
				className="shrink-0 flex justify-center py-3 px-4 bg-white border-b border-slate-100 active:bg-slate-50 transition-colors w-full"
			>
				<div className="flex items-center gap-2 rounded-2xl bg-amber-50 border-2 border-amber-300 px-6 py-2.5 shadow-sm">
					<span className="text-2xl leading-none">🪙</span>
					<div className="flex flex-col leading-tight">
						<span className="text-xl font-black text-amber-600">{balance}</span>
						<span className="text-xs font-bold text-amber-500 uppercase tracking-wide">
							{currencyName} · tap for history
						</span>
					</div>
				</div>
			</button>

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
											<span className="text-base leading-none">{currencyEmoji}</span>
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
											{`Need ${shortage} more ${currencyEmoji}`}
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
