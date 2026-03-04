"use client";

import { BookOpenIcon, ClockIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
		<div className="mx-auto max-w-2xl px-4 py-8">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-xl font-bold text-foreground">My Classes</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						Each class has its own roster, groups, and RAM Buck balance
					</p>
				</div>
				<Button size="sm" onClick={() => setShowForm((v) => !v)}>
					<PlusIcon className="h-4 w-4 mr-1.5" />
					New Class
				</Button>
			</div>

			{/* Create form */}
			{showForm && (
				<form
					onSubmit={handleCreate}
					className="mb-6 rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
				>
					<p className="text-sm font-semibold text-foreground">New Class</p>
					<div className="flex flex-col gap-1">
						<label className="text-xs text-muted-foreground" htmlFor="label">
							Class name *
						</label>
						<input
							id="label"
							type="text"
							required
							placeholder="AM Math, Period 3, PM Block..."
							value={form.label}
							onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
							className="rounded border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1">
							<label className="text-xs text-muted-foreground" htmlFor="periodTime">
								Period time
							</label>
							<input
								id="periodTime"
								type="text"
								placeholder="8:00 AM"
								value={form.periodTime}
								onChange={(e) => setForm((f) => ({ ...f, periodTime: e.target.value }))}
								className="rounded border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-xs text-muted-foreground" htmlFor="gradeLevel">
								Grade
							</label>
							<select
								id="gradeLevel"
								value={form.gradeLevel}
								onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
								className="rounded border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
						<Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={creating}>
							{creating ? "Creating..." : "Create Class"}
						</Button>
					</div>
				</form>
			)}

			{/* Class list */}
			{loading ? (
				<div className="flex flex-col gap-3">
					{[1, 2].map((i) => (
						<div
							key={i}
							className="h-24 rounded-lg border border-border bg-muted/30 animate-pulse"
						/>
					))}
				</div>
			) : classes.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border p-10 text-center">
					<BookOpenIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
					<p className="text-sm font-medium text-foreground mb-1">No classes yet</p>
					<p className="text-xs text-muted-foreground">
						Create your first class to start managing rosters and sessions
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{classes.map((cls) => (
						<button
							key={cls.id}
							type="button"
							onClick={() => router.push(`/classes/${cls.id}`)}
							className="rounded-lg border border-border bg-card p-4 text-left hover:bg-muted/30 transition-colors"
						>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-sm font-semibold text-foreground">{cls.label}</p>
									<div className="flex items-center gap-3 mt-1">
										{cls.periodTime && (
											<span className="flex items-center gap-1 text-xs text-muted-foreground">
												<ClockIcon className="h-3 w-3" />
												{cls.periodTime}
											</span>
										)}
										<span className="flex items-center gap-1 text-xs text-muted-foreground">
											<UsersIcon className="h-3 w-3" />
											{cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}
										</span>
										<span className="text-xs text-muted-foreground">Grade {cls.gradeLevel}</span>
									</div>
								</div>
								<span className="text-xs text-primary font-medium">Manage →</span>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
