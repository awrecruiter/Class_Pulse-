"use client";

import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ClassOption = {
	id: string;
	label: string;
	periodTime: string;
};

type RosterEntry = {
	id: string;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
};

type CfuEntry = {
	rosterId: string;
	score: number;
	notes: string;
};

const SCORE_OPTIONS = [
	{ value: 0, label: "0 - Absent" },
	{ value: 1, label: "1 - Below" },
	{ value: 2, label: "2 - Approaching" },
	{ value: 3, label: "3 - Meeting" },
	{ value: 4, label: "4 - Exceeding" },
] as const;

const SCORE_COLORS: Record<number, string> = {
	0: "bg-muted text-muted-foreground",
	1: "bg-red-100 text-red-700",
	2: "bg-orange-100 text-orange-700",
	3: "bg-blue-100 text-blue-700",
	4: "bg-green-100 text-green-700",
};

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export default function GradebookPage() {
	const [classes, setClasses] = useState<ClassOption[]>([]);
	const [selectedClassId, setSelectedClassId] = useState<string>("");
	const [roster, setRoster] = useState<RosterEntry[]>([]);
	const [date, setDate] = useState<string>(today());
	const [standardCode, setStandardCode] = useState<string>("");
	const [scores, setScores] = useState<Record<string, { score: number; notes: string }>>({});
	const [_existingEntries, setExistingEntries] = useState<CfuEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [exportFrom, setExportFrom] = useState<string>(today());
	const [exportTo, setExportTo] = useState<string>(today());

	// Fetch class list
	useEffect(() => {
		fetch("/api/classes")
			.then((r) => r.json())
			.then((json) => {
				const cls: ClassOption[] = (json.classes ?? []).filter(
					(c: ClassOption & { isArchived: boolean }) => !c.isArchived,
				);
				setClasses(cls);
				if (cls.length > 0 && !selectedClassId) {
					setSelectedClassId(cls[0]?.id);
				}
			})
			.catch(() => toast.error("Failed to load classes"));
	}, [selectedClassId]);

	// Fetch roster when class changes
	useEffect(() => {
		if (!selectedClassId) return;
		fetch(`/api/classes/${selectedClassId}`)
			.then((r) => r.json())
			.then((json) => {
				const rosterData: RosterEntry[] = (json.roster ?? []).filter(
					(s: RosterEntry & { isActive: boolean }) => s.isActive,
				);
				setRoster(rosterData);
				// Initialize scores to 0 for all students
				const initial: Record<string, { score: number; notes: string }> = {};
				for (const s of rosterData) {
					initial[s.id] = { score: 0, notes: "" };
				}
				setScores(initial);
			})
			.catch(() => toast.error("Failed to load roster"));
	}, [selectedClassId]);

	// Fetch existing entries when class + date change
	const fetchExisting = useCallback(async () => {
		if (!selectedClassId || !date) return;
		setLoading(true);
		try {
			const res = await fetch(`/api/classes/${selectedClassId}/gradebook?date=${date}`);
			if (!res.ok) throw new Error("Failed to fetch");
			const json = await res.json();
			setExistingEntries(json.entries ?? []);

			// Pre-fill scores from existing entries
			setScores((prev) => {
				const updated = { ...prev };
				for (const entry of json.entries ?? []) {
					updated[entry.rosterId] = { score: entry.score, notes: entry.notes };
				}
				return updated;
			});

			// Set standard code if entries exist
			if (json.entries?.length > 0 && !standardCode) {
				setStandardCode(json.entries[0].standardCode);
			}
		} catch {
			// Silently fail — no entries yet
		} finally {
			setLoading(false);
		}
	}, [selectedClassId, date, standardCode]);

	useEffect(() => {
		fetchExisting();
	}, [fetchExisting]);

	function setScore(rosterId: string, score: number) {
		setScores((prev) => ({
			...prev,
			[rosterId]: { notes: prev[rosterId]?.notes ?? "", score },
		}));
	}

	function setNotes(rosterId: string, notes: string) {
		setScores((prev) => ({
			...prev,
			[rosterId]: { score: prev[rosterId]?.score ?? 0, notes },
		}));
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedClassId || !date || !standardCode) {
			toast.error("Select a class, date, and standard code");
			return;
		}

		setSubmitting(true);
		try {
			const entries = roster.map((s) => ({
				rosterId: s.id,
				score: scores[s.id]?.score ?? 0,
				notes: scores[s.id]?.notes ?? "",
			}));

			const res = await fetch(`/api/classes/${selectedClassId}/gradebook`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ date, standardCode, entries }),
			});

			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Failed to save");
			}

			const json = await res.json();
			toast.success(`Saved ${json.count} entries`);
			fetchExisting();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSubmitting(false);
		}
	}

	function handleExport() {
		if (!selectedClassId) return;
		const url = `/api/classes/${selectedClassId}/gradebook/export?from=${exportFrom}&to=${exportTo}`;
		window.open(url, "_blank");
	}

	const selectedClass = classes.find((c) => c.id === selectedClassId);

	return (
		<div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-bold text-foreground">Gradebook</h1>
				<p className="text-sm text-muted-foreground mt-0.5">Record daily CFU scores per standard</p>
			</div>

			{/* Controls */}
			<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{/* Class selector */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-muted-foreground" htmlFor="class-select">
							Class
						</label>
						<select
							id="class-select"
							value={selectedClassId}
							onChange={(e) => setSelectedClassId(e.target.value)}
							className="rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						>
							{classes.map((c) => (
								<option key={c.id} value={c.id}>
									{c.label}
									{c.periodTime ? ` (${c.periodTime})` : ""}
								</option>
							))}
						</select>
					</div>

					{/* Date picker */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-muted-foreground" htmlFor="date-picker">
							Date
						</label>
						<input
							id="date-picker"
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>

					{/* Standard code */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-medium text-muted-foreground" htmlFor="standard-code">
							Standard Code
						</label>
						<input
							id="standard-code"
							type="text"
							placeholder="e.g. MA.5.FR.1.1"
							value={standardCode}
							onChange={(e) => setStandardCode(e.target.value.toUpperCase())}
							className="rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
				</div>
			</div>

			{/* Student score grid */}
			{selectedClassId && roster.length === 0 && !loading && (
				<div className="rounded-lg border border-dashed border-border p-6 text-center">
					<p className="text-sm text-muted-foreground">
						No students in this class. Add students from the Classes page.
					</p>
				</div>
			)}

			{roster.length > 0 && (
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<p className="text-sm font-semibold text-foreground">
							{selectedClass?.label} — {date}
						</p>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={fetchExisting}
							disabled={loading}
						>
							<RefreshCwIcon className="h-3.5 w-3.5 mr-1.5" />
							Refresh
						</Button>
					</div>

					{/* Score legend */}
					<div className="flex flex-wrap gap-2">
						{SCORE_OPTIONS.map((opt) => (
							<span
								key={opt.value}
								className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SCORE_COLORS[opt.value]}`}
							>
								{opt.label}
							</span>
						))}
					</div>

					<div className="rounded-lg border border-border overflow-hidden">
						{/* Table header */}
						<div className="grid grid-cols-[1fr,auto,1fr] gap-2 px-3 py-2 bg-muted/30 border-b border-border">
							<span className="text-xs font-medium text-muted-foreground">Student</span>
							<span className="text-xs font-medium text-muted-foreground text-center">Score</span>
							<span className="text-xs font-medium text-muted-foreground">Notes</span>
						</div>

						{roster.map((student, i) => {
							const currentScore = scores[student.id]?.score ?? 0;
							const currentNotes = scores[student.id]?.notes ?? "";

							return (
								<div
									key={student.id}
									className={`grid grid-cols-[1fr,auto,1fr] gap-2 items-center px-3 py-2.5 ${
										i !== roster.length - 1 ? "border-b border-border" : ""
									}`}
								>
									{/* Student */}
									<div className="flex items-center gap-2">
										<span
											className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${SCORE_COLORS[currentScore]}`}
										>
											{student.firstInitial}
											{student.lastInitial}
										</span>
										<div>
											<p className="text-sm font-medium text-foreground">
												{student.firstInitial}.{student.lastInitial}.
											</p>
											<p className="text-xs text-muted-foreground">ID: {student.studentId}</p>
										</div>
									</div>

									{/* Score select */}
									<select
										value={currentScore}
										onChange={(e) => setScore(student.id, Number(e.target.value))}
										className={`rounded border border-border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring ${SCORE_COLORS[currentScore]}`}
									>
										{SCORE_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.value}
											</option>
										))}
									</select>

									{/* Notes */}
									<input
										type="text"
										placeholder="Notes..."
										value={currentNotes}
										onChange={(e) => setNotes(student.id, e.target.value)}
										className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
									/>
								</div>
							);
						})}
					</div>

					<Button type="submit" disabled={submitting || !standardCode}>
						{submitting ? "Saving..." : `Save ${roster.length} Entries`}
					</Button>
				</form>
			)}

			{/* Export section */}
			<section className="flex flex-col gap-3">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Export CSV
				</h2>
				<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
					<div className="flex flex-col gap-1.5">
						<label className="text-xs text-muted-foreground" htmlFor="export-from">
							From
						</label>
						<input
							id="export-from"
							type="date"
							value={exportFrom}
							onChange={(e) => setExportFrom(e.target.value)}
							className="rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label className="text-xs text-muted-foreground" htmlFor="export-to">
							To
						</label>
						<input
							id="export-to"
							type="date"
							value={exportTo}
							onChange={(e) => setExportTo(e.target.value)}
							className="rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={handleExport}
						disabled={!selectedClassId}
					>
						<DownloadIcon className="h-3.5 w-3.5 mr-1.5" />
						Export CSV
					</Button>
				</div>
			</section>
		</div>
	);
}
