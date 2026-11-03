"use client";
import { ArrowRight, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WORKSPACE_LABELS } from "@/lib/workspace-mode";
import styles from "./workspace.module.css";

type Space = {
	id: string;
	label: string;
	gradeLevel: string;
	subject: string;
	studentCount: number;
	isArchived: boolean;
};
export function TutoringDashboard({ mode }: { mode: "distance" | "homeschool" }) {
	const [spaces, setSpaces] = useState<Space[]>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [form, setForm] = useState({ label: "", gradeLevel: "", subject: "Math" });
	const load = useCallback(
		async (signal?: AbortSignal) => {
			const response = await fetch(`/api/classes?mode=${mode}`, { signal });
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || "Could not load learning spaces.");
			setSpaces(body.classes.filter((space: Space) => !space.isArchived));
		},
		[mode],
	);
	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError("");
		setCreating(false);
		load(controller.signal)
			.catch((err) => {
				if (!controller.signal.aborted) setError(err.message);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [load]);
	async function create(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/classes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...form, workspaceMode: mode }),
			});
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || "Could not create learning space.");
			setCreating(false);
			setForm({ label: "", gradeLevel: "", subject: "Math" });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Please try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<>
			<header className={styles.header}>
				<span className={styles.badge}>{WORKSPACE_LABELS[mode]}</span>
				<h1 className="mt-4">A little space to grow.</h1>
				<p>
					{mode === "homeschool"
						? "A home for each learner’s goals, guided practice, and progress together."
						: "Bring your learners, your favorite tools, and the next thing they want to learn."}
				</p>
				<div className={styles.modeTabs}>
					<Link
						href="/tutoring"
						className={`${styles.tab} ${mode === "distance" ? styles.activeTab : ""}`}
					>
						Distance learning
					</Link>
					<Link
						href="/tutoring?mode=homeschool"
						className={`${styles.tab} ${mode === "homeschool" ? styles.activeTab : ""}`}
					>
						Homeschool
					</Link>
				</div>
				<button type="button" className={styles.primary} onClick={() => setCreating(!creating)}>
					<Plus size={16} />
					New learning space
				</button>
			</header>
			{error && (
				<p role="alert" className={styles.error}>
					{error}
				</p>
			)}
			{creating && (
				<form className={`${styles.card} ${styles.form}`} onSubmit={create}>
					<h2 className="text-center">Who are we learning with?</h2>
					<label>
						<span className="sr-only">Learning space name</span>
						<input
							required
							maxLength={100}
							placeholder="Learner or group name"
							value={form.label}
							onChange={(e) => setForm({ ...form, label: e.target.value })}
						/>
					</label>
					<label>
						<span className="sr-only">Grade / level</span>
						<select
							value={form.gradeLevel}
							onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
						>
							<option value="">Grade or level (optional)</option>
							{[
								"Pre-K",
								"K",
								...Array.from({ length: 12 }, (_, i) => String(i + 1)),
								"mixed",
								"adult",
							].map((grade) => (
								<option key={grade} value={grade}>
									{/^\d+$/.test(grade) ? `Grade ${grade}` : grade}
								</option>
							))}
						</select>
					</label>
					<label>
						<span className="sr-only">Subject</span>
						<input
							maxLength={50}
							placeholder="Subject"
							value={form.subject}
							onChange={(e) => setForm({ ...form, subject: e.target.value })}
						/>
					</label>
					<div className={styles.actions}>
						<button type="button" className={styles.secondary} onClick={() => setCreating(false)}>
							Cancel
						</button>
						<button className={styles.primary} disabled={busy} type="submit">
							{busy ? "Creating…" : "Create learning space"}
						</button>
					</div>
				</form>
			)}
			{loading ? (
				<p className={styles.empty}>Loading your learning spaces…</p>
			) : spaces.length === 0 ? (
				<section className={`${styles.card} ${styles.empty}`}>
					<Users className="mx-auto mb-4 text-[#aa97c3]" size={32} strokeWidth={1.3} />
					<h2>Your next learner starts here.</h2>
					<p>
						Create a learning space, invite a family, and choose the quiz tools that work for them.
					</p>
				</section>
			) : (
				<div className={styles.grid}>
					{spaces.map((space) => (
						<Link key={space.id} href={`/tutoring/${space.id}`} className={styles.card}>
							<span className={styles.badge}>{space.subject || "Learning"}</span>
							<h2 className="mt-4">{space.label}</h2>
							<p>
								{space.studentCount} learner{space.studentCount === 1 ? "" : "s"}
								{space.gradeLevel ? ` · Level ${space.gradeLevel}` : " · Any grade"}
							</p>
							<span className="inline-flex items-center gap-2 text-sm text-[#80629e]">
								Open learning space <ArrowRight size={14} />
							</span>
						</Link>
					))}
				</div>
			)}
		</>
	);
}
