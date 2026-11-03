"use client";
import { CalendarDays, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./reservations.module.css";

type Reservation = {
	learningSpaceUrl?: string;
	id: string;
	source: string;
	sourceUri?: string;
	learnerName: string;
	subject: string;
	topic: string;
	startsAt: string;
	endsAt: string;
};
export function ReservationSidebar() {
	const [rows, setRows] = useState<Reservation[]>([]);
	const [connected, setConnected] = useState(false);
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(true);
	const [manual, setManual] = useState(false);
	const [editing, setEditing] = useState<Reservation | null>(null);
	const [busy, setBusy] = useState(false);
	const [form, setForm] = useState({
		learnerName: "",
		subject: "",
		topic: "",
		startsAt: "",
		endsAt: "",
	});
	const load = useCallback(async () => {
		try {
			const response = await fetch("/api/reservations", { cache: "no-store" });
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || "Could not load reservations.");
			setRows(body.reservations);
			setConnected(body.connected);
			setMessage(
				body.error ||
					(body.limited
						? "More reservations are available in Calendly. This view shows a limited upcoming range."
						: ""),
			);
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Could not load reservations.");
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		load();
		const timer = setInterval(() => {
			if (!document.hidden) load();
		}, 60000);
		return () => clearInterval(timer);
	}, [load]);
	async function save(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		try {
			const response = await fetch("/api/reservations", {
				method: editing ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...form,
					sourceUri: editing?.sourceUri,
					startsAt: editing ? editing.startsAt : new Date(form.startsAt).toISOString(),
					endsAt: editing ? editing.endsAt : new Date(form.endsAt).toISOString(),
				}),
			});
			const body = await response.json();
			if (!response.ok) throw new Error(body.error);
			setManual(false);
			setEditing(null);
			setForm({ learnerName: "", subject: "", topic: "", startsAt: "", endsAt: "" });
			await load();
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Could not save reservation.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<aside className={styles.panel} aria-label="Reservations schedule">
			<header className={styles.header}>
				<h2>
					<CalendarDays size={18} />
					Your schedule
				</h2>
				<button type="button" aria-label="Refresh reservations" onClick={load}>
					<RefreshCw size={15} />
				</button>
			</header>
			<p className={styles.caption}>Upcoming reservations · your local time</p>
			{!connected && (
				<p className={styles.notice}>
					<Link href="/tutoring/settings#calendly-connection">Connect Calendly</Link> to show
					confirmed bookings here. A scheduling link alone does not sync reservations.
				</p>
			)}
			{message && <output className={styles.notice}>{message}</output>}
			{loading ? (
				<p className={styles.caption}>Loading reservations…</p>
			) : rows.length === 0 ? (
				<p className={styles.empty}>No upcoming reservations to display.</p>
			) : (
				<ol className={styles.list}>
					{rows.map((row) => (
						<li key={row.id} className={styles.booking}>
							<div className={styles.time}>
								{new Date(row.startsAt).toLocaleDateString(undefined, {
									weekday: "short",
									month: "short",
									day: "numeric",
								})}{" "}
								·{" "}
								{new Date(row.startsAt).toLocaleTimeString(undefined, {
									hour: "numeric",
									minute: "2-digit",
								})}
							</div>
							<h3>
								{row.learningSpaceUrl ? (
									<Link href={row.learningSpaceUrl}>{row.learnerName}</Link>
								) : (
									row.learnerName
								)}
							</h3>
							<p>
								<strong>{row.subject || "Subject not provided"}</strong>
							</p>
							<p>{row.topic || "Topic not provided"}</p>
							<span className={styles.source}>
								{row.source === "calendly"
									? "Calendly reservation"
									: row.source === "demo"
										? "Demo reservation"
										: "Manual reservation"}
							</span>
							{row.source !== "calendly" && (
								<button
									type="button"
									className={styles.link}
									onClick={async () => {
										const response = await fetch("/api/reservations", {
											method: "DELETE",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ id: row.id }),
										});
										if (response.ok) await load();
										else setMessage("Could not remove reservation.");
									}}
								>
									Remove reservation
								</button>
							)}
							{row.source === "calendly" && (
								<button
									className={styles.link}
									type="button"
									onClick={() => {
										setEditing(row);
										setForm({
											learnerName: row.learnerName,
											subject: row.subject,
											topic: row.topic,
											startsAt: row.startsAt,
											endsAt: row.endsAt,
										});
										setManual(true);
									}}
								>
									Edit learner / subject / topic
								</button>
							)}
						</li>
					))}
				</ol>
			)}
			<button
				type="button"
				className={styles.link}
				onClick={() => {
					setManual(!manual);
					setEditing(null);
					setForm({ learnerName: "", subject: "", topic: "", startsAt: "", endsAt: "" });
				}}
			>
				Add manual reservation
			</button>
			{manual && (
				<form className={styles.form} onSubmit={save}>
					<label>
						<span className="sr-only">Learner name</span>
						<input
							required
							maxLength={100}
							placeholder="Learner name"
							value={form.learnerName}
							onChange={(e) => setForm({ ...form, learnerName: e.target.value })}
						/>
					</label>
					<label>
						<span className="sr-only">Subject</span>
						<input
							required
							maxLength={100}
							placeholder="Subject"
							value={form.subject}
							onChange={(e) => setForm({ ...form, subject: e.target.value })}
						/>
					</label>
					<label>
						<span className="sr-only">Topic</span>
						<input
							required
							maxLength={200}
							placeholder="Topic"
							value={form.topic}
							onChange={(e) => setForm({ ...form, topic: e.target.value })}
						/>
					</label>
					{!editing && (
						<>
							<label>
								Starts
								<input
									type="datetime-local"
									required
									value={form.startsAt}
									onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
								/>
							</label>
							<label>
								Ends
								<input
									type="datetime-local"
									required
									value={form.endsAt}
									onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
								/>
							</label>
						</>
					)}
					<button disabled={busy} type="submit" className={styles.primary}>
						{busy ? "Saving…" : "Save reservation"}
					</button>
				</form>
			)}
		</aside>
	);
}
