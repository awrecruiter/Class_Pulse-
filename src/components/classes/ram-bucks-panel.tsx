"use client";

import { ChevronDownIcon, ChevronUpIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Account = {
	id: string;
	rosterId: string;
	balance: number;
	lifetimeEarned: number;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
};

type GroupAccount = {
	groupId: string;
	name: string;
	emoji: string;
	color: string;
	balance: number;
};

type Transaction = {
	id: string;
	rosterId: string;
	type: string;
	amount: number;
	reason: string;
	createdAt: string;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
};

const TX_COLORS: Record<string, string> = {
	"academic-correct": "bg-green-100 text-green-800",
	"academic-mastery": "bg-emerald-100 text-emerald-800",
	"academic-iready": "bg-teal-100 text-teal-800",
	"behavior-positive": "bg-blue-100 text-blue-800",
	"behavior-fine": "bg-red-100 text-red-800",
	purchase: "bg-purple-100 text-purple-800",
	"manual-award": "bg-yellow-100 text-yellow-800",
	"manual-deduct": "bg-orange-100 text-orange-800",
	reset: "bg-gray-100 text-gray-700",
};

export function RamBucksPanel({ classId }: { classId: string }) {
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [groupAccounts, setGroupAccounts] = useState<GroupAccount[]>([]);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [loading, setLoading] = useState(true);
	const [showTx, setShowTx] = useState(false);
	const [txLoading, setTxLoading] = useState(false);

	// Award/deduct form
	const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
	const [mode, setMode] = useState<"award" | "deduct">("award");
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const fetchAccounts = useCallback(async () => {
		try {
			const [accRes, grpRes] = await Promise.all([
				fetch(`/api/classes/${classId}/ram-bucks`),
				fetch(`/api/classes/${classId}/group-accounts`),
			]);
			if (accRes.ok) {
				const json = await accRes.json();
				setAccounts(json.accounts ?? []);
			}
			if (grpRes.ok) {
				const json = await grpRes.json();
				setGroupAccounts(json.groups ?? []);
			}
		} catch {
			// ignore
		} finally {
			setLoading(false);
		}
	}, [classId]);

	useEffect(() => {
		fetchAccounts();
	}, [fetchAccounts]);

	const fetchAccountsRef = useRef(fetchAccounts);
	useEffect(() => {
		fetchAccountsRef.current = fetchAccounts;
	}, [fetchAccounts]);
	useEffect(() => {
		function handle() {
			fetchAccountsRef.current();
		}
		window.addEventListener("ram-bucks-updated", handle);
		return () => window.removeEventListener("ram-bucks-updated", handle);
	}, []);

	// Poll every 10 s so the panel stays live after voice commands regardless of
	// whether the event was caught (e.g. user on a different tab when it fired).
	useEffect(() => {
		const id = setInterval(() => {
			if (document.visibilityState === "visible") {
				fetchAccountsRef.current();
			}
		}, 10_000);
		return () => clearInterval(id);
	}, []);

	async function loadTransactions() {
		setTxLoading(true);
		try {
			const res = await fetch(`/api/classes/${classId}/ram-bucks/transactions?limit=50`);
			if (res.ok) {
				const json = await res.json();
				setTransactions(json.transactions ?? []);
			}
		} finally {
			setTxLoading(false);
		}
	}

	function toggleTx() {
		if (!showTx && transactions.length === 0) {
			loadTransactions();
		}
		setShowTx((v) => !v);
	}

	async function handleAward(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedRosterId || !amount) return;
		const parsed = Number.parseInt(amount, 10);
		if (Number.isNaN(parsed) || parsed <= 0) return;

		setSubmitting(true);
		try {
			const res = await fetch(`/api/classes/${classId}/ram-bucks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rosterId: selectedRosterId,
					amount: mode === "award" ? parsed : -parsed,
					type: mode === "award" ? "manual-award" : "manual-deduct",
					reason: reason || (mode === "award" ? "Teacher award" : "Teacher deduction"),
				}),
			});
			if (!res.ok) throw new Error("Failed");
			toast.success(mode === "award" ? `+${parsed} 🐏 awarded` : `-${parsed} 🐏 deducted`);
			setAmount("");
			setReason("");
			setSelectedRosterId(null);
			fetchAccounts();
			if (showTx) loadTransactions();
		} catch {
			toast.error("Failed to update balance");
		} finally {
			setSubmitting(false);
		}
	}

	async function resetStudent(rosterId: string) {
		if (!window.confirm("Reset this student's balance to 0?")) return;
		try {
			await fetch(`/api/classes/${classId}/ram-bucks/reset`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rosterId }),
			});
			toast.success("Balance reset");
			fetchAccounts();
			if (showTx) loadTransactions();
		} catch {
			toast.error("Failed to reset");
		}
	}

	async function resetAll() {
		if (!window.confirm("Reset ALL student balances to 0? This cannot be undone.")) return;
		try {
			await fetch(`/api/classes/${classId}/ram-bucks/reset`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			toast.success("All balances reset");
			fetchAccounts();
			if (showTx) loadTransactions();
		} catch {
			toast.error("Failed to reset");
		}
	}

	if (loading) {
		return <div className="h-24 rounded-lg bg-muted/30 animate-pulse" />;
	}

	const selectedAccount = accounts.find((a) => a.rosterId === selectedRosterId);

	return (
		<div className="flex flex-col gap-4">
			{/* Group balances */}
			{groupAccounts.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{groupAccounts.map((g) => (
						<div
							key={g.groupId}
							className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium"
						>
							<span>{g.emoji}</span>
							<span>{g.name}</span>
							<span className="text-muted-foreground">·</span>
							<span className="font-bold">🐏 {g.balance}</span>
						</div>
					))}
				</div>
			)}

			{/* Student list */}
			{accounts.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border p-4 text-center">
					<p className="text-sm text-muted-foreground">
						No RAM Buck accounts yet. Auto-assign groups to initialize accounts.
					</p>
				</div>
			) : (
				<div className="rounded-lg border border-border overflow-hidden">
					{accounts.map((account, i) => {
						const isSelected = selectedRosterId === account.rosterId;
						return (
							<div key={account.id}>
								{/* biome-ignore lint/a11y/useSemanticElements: contains nested <button>, cannot use <button> here */}
								<div
									role="button"
									tabIndex={0}
									className={cn(
										"flex w-full items-center justify-between px-3 py-2.5 text-left cursor-pointer hover:bg-muted/30 transition-colors",
										i !== accounts.length - 1 ? "border-b border-border" : "",
										isSelected ? "bg-muted/40" : "",
									)}
									onClick={() => setSelectedRosterId(isSelected ? null : account.rosterId)}
									onKeyDown={(e) =>
										e.key === "Enter" && setSelectedRosterId(isSelected ? null : account.rosterId)
									}
								>
									<div className="flex items-center gap-3">
										<span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
											{account.firstInitial}
											{account.lastInitial}
										</span>
										<div>
											<p className="text-sm font-medium text-foreground">
												{account.firstInitial}.{account.lastInitial}.
											</p>
											<p className="text-xs text-muted-foreground">ID: {account.studentId}</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-sm font-bold text-amber-700">🐏 {account.balance}</span>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												resetStudent(account.rosterId);
											}}
											className="p-1 text-muted-foreground hover:text-destructive transition-colors"
											title="Reset balance"
										>
											<RotateCcwIcon className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>

								{/* Inline award/deduct form */}
								{isSelected && (
									<div className="border-b border-border bg-muted/20 px-3 py-3">
										<p className="text-xs font-medium text-muted-foreground mb-2">
											Adjust balance for {account.firstInitial}.{account.lastInitial}. (current:{" "}
											{selectedAccount?.balance ?? 0} 🐏)
										</p>
										<form onSubmit={handleAward} className="flex flex-col gap-2">
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => setMode("award")}
													className={cn(
														"flex-1 rounded-lg border py-1.5 text-sm font-semibold transition-colors",
														mode === "award"
															? "border-green-500 bg-green-50 text-green-700"
															: "border-border bg-background text-muted-foreground hover:bg-muted/40",
													)}
												>
													+ Award
												</button>
												<button
													type="button"
													onClick={() => setMode("deduct")}
													className={cn(
														"flex-1 rounded-lg border py-1.5 text-sm font-semibold transition-colors",
														mode === "deduct"
															? "border-red-400 bg-red-50 text-red-700"
															: "border-border bg-background text-muted-foreground hover:bg-muted/40",
													)}
												>
													− Deduct
												</button>
											</div>
											<div className="flex gap-2">
												<input
													type="number"
													min={1}
													placeholder="Amount"
													value={amount}
													onChange={(e) => setAmount(e.target.value)}
													className="w-24 rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
													required
												/>
												<input
													type="text"
													placeholder="Reason (optional)"
													value={reason}
													onChange={(e) => setReason(e.target.value)}
													className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
												/>
												<Button type="submit" size="sm" disabled={submitting}>
													{submitting ? "..." : "Save"}
												</Button>
											</div>
										</form>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Reset all + transaction history controls */}
			<div className="flex items-center justify-between gap-2">
				{accounts.length > 0 && (
					<button
						type="button"
						onClick={resetAll}
						className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
					>
						<RotateCcwIcon className="h-3 w-3" />
						Reset All Balances
					</button>
				)}
				<button
					type="button"
					onClick={toggleTx}
					className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
				>
					{showTx ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
					Transaction history
				</button>
			</div>

			{/* Transaction history */}
			{showTx && (
				<div className="rounded-lg border border-border overflow-hidden">
					{txLoading ? (
						<div className="h-16 bg-muted/30 animate-pulse" />
					) : transactions.length === 0 ? (
						<p className="px-3 py-4 text-sm text-muted-foreground text-center">
							No transactions yet.
						</p>
					) : (
						transactions.map((tx, i) => (
							<div
								key={tx.id}
								className={cn(
									"flex items-center justify-between px-3 py-2 text-xs",
									i !== transactions.length - 1 ? "border-b border-border" : "",
								)}
							>
								<div className="flex items-center gap-2 min-w-0">
									<span
										className={cn(
											"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
											TX_COLORS[tx.type] ?? "bg-gray-100 text-gray-700",
										)}
									>
										{tx.type}
									</span>
									<span className="text-muted-foreground truncate">
										{tx.firstInitial}.{tx.lastInitial}. — {tx.reason}
									</span>
								</div>
								<span
									className={cn(
										"shrink-0 font-bold ml-2",
										tx.amount >= 0 ? "text-green-700" : "text-red-600",
									)}
								>
									{tx.amount >= 0 ? "+" : ""}
									{tx.amount} 🐏
								</span>
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}
