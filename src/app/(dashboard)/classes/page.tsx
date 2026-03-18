"use client";

import { BookOpenIcon, ClockIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type ClassRow = {
	id: string;
	label: string;
	periodTime: string;
	gradeLevel: string;
	subject: string;
	isArchived: boolean;
	studentCount: number;
	createdAt: string;
};

export default function ClassesPage() {
	const router = useRouter();
	const [classes, setClasses] = useState<ClassRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [creating, setCreating] = useState(false);
	const [form, setForm] = useState({
		label: "",
		periodTime: "",
		gradeLevel: "5",
		subject: "Math",
	});

	const fetchClasses = useCallback(async () => {
		try {
			const res = await fetch("/api/classes");
			const json = await res.json();
			setClasses((json.classes ?? []).filter((c: ClassRow) => !c.isArchived));
		} catch {
			toast.error("Failed to load classes");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchClasses();
	}, [fetchClasses]);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!form.label.trim()) return;
		setCreating(true);
		try {
			const res = await fetch("/api/classes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Failed to create class");
			}
			toast.success("Class created");
			setShowForm(false);
			setForm({ label: "", periodTime: "", gradeLevel: "5", subject: "Math" });
			fetchClasses();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to create class");
		} finally {
			setCreating(false);
		}
	}

	return (
		<div className="min-h-[calc(100vh-3.5rem)] bg-[#0d1525] px-4 py-8">
			<div className="mx-auto max-w-2xl">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-lg font-bold text-slate-100">My Classes</h1>
						<p className="text-xs text-slate-500 mt-0.5">
							Each class has its own roster, groups, and RAM Buck balance
						</p>
					</div>
					<button
						type="button"
						onClick={() => setShowForm((v) => !v)}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 text-xs font-medium transition-colors border border-indigo-500/20"
					>
						<PlusIcon className="h-3.5 w-3.5" />
						New Class
					</button>
				</div>

				{/* Create form */}
				{showForm && (
					<form
						onSubmit={handleCreate}
						className="mb-6 rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-3"
					>
						<p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
							New Class
						</p>
						<div className="flex flex-col gap-1">
							<label className="text-xs text-slate-500" htmlFor="label">
								Class name *
							</label>
							<input
								id="label"
								type="text"
								required
								placeholder="AM Math, Period 3, PM Block..."
								value={form.label}
								onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
								className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-1">
								<label className="text-xs text-slate-500" htmlFor="periodTime">
									Period time
								</label>
								<input
									id="periodTime"
									type="text"
									placeholder="8:00 AM"
									value={form.periodTime}
									onChange={(e) => setForm((f) => ({ ...f, periodTime: e.target.value }))}
									className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-xs text-slate-500" htmlFor="gradeLevel">
									Grade
								</label>
								<select
									id="gradeLevel"
									value={form.gradeLevel}
									onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
									className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
								>
									{["3", "4", "5", "6", "7", "8"].map((g) => (
										<option key={g} value={g}>
											Grade {g}
										</option>
									))}
								</select>
							</div>
						</div>
						<div className="flex gap-2 justify-end">
							<button
								type="button"
								onClick={() => setShowForm(false)}
								className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={creating}
								className="px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 text-xs font-medium transition-colors border border-indigo-500/20 disabled:opacity-50"
							>
								{creating ? "Creating…" : "Create Class"}
							</button>
						</div>
					</form>
				)}

				{/* Class list */}
				{loading ? (
					<div className="flex flex-col gap-3">
						{[1, 2].map((i) => (
							<div
								key={i}
								className="h-20 rounded-xl border border-slate-800 bg-slate-800/40 animate-pulse"
							/>
						))}
					</div>
				) : classes.length === 0 ? (
					<div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
						<BookOpenIcon className="h-8 w-8 text-slate-600 mx-auto mb-3" />
						<p className="text-sm font-medium text-slate-400 mb-1">No classes yet</p>
						<p className="text-xs text-slate-600">
							Create your first class to start managing rosters and sessions
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{classes.map((cls) => (
							<button
								key={cls.id}
								type="button"
								onClick={() => router.push(`/classes/${cls.id}`)}
								className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-left hover:bg-slate-800 hover:border-slate-700 transition-colors group"
							>
								<div className="flex items-center justify-between gap-2">
									<div>
										<p className="text-sm font-semibold text-slate-100">{cls.label}</p>
										<div className="flex items-center gap-3 mt-1">
											{cls.periodTime && (
												<span className="flex items-center gap-1 text-xs text-slate-500">
													<ClockIcon className="h-3 w-3" />
													{cls.periodTime}
												</span>
											)}
											<span className="flex items-center gap-1 text-xs text-slate-500">
												<UsersIcon className="h-3 w-3" />
												{cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}
											</span>
											<span className="text-xs text-slate-600">Grade {cls.gradeLevel}</span>
										</div>
									</div>
									<span className="text-xs text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
										Manage →
									</span>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
