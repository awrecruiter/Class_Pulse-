"use client";
import { useEffect, useState } from "react";
import { studentBookingUrlSchema } from "@/lib/student-booking";
import styles from "./workspace.module.css";
export function BookingSettings() {
	const [url, setUrl] = useState("");
	const [loaded, setLoaded] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	useEffect(() => {
		fetch("/api/teacher-settings")
			.then(async (response) => {
				const data = await response.json();
				if (!response.ok) throw new Error(data.error || "Could not load booking settings.");
				setUrl(data.settings.studentBookingUrl ?? "");
				setLoaded(true);
			})
			.catch((err) => setMessage(err.message));
	}, []);
	async function save(event: React.FormEvent) {
		event.preventDefault();
		const result = studentBookingUrlSchema.safeParse(url);
		if (!result.success) {
			setMessage(result.error.issues[0]?.message ?? "Check your link.");
			return;
		}
		setBusy(true);
		try {
			const response = await fetch("/api/teacher-settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ studentBookingUrl: result.data }),
			});
			if (!response.ok) throw new Error("Could not save booking link.");
			setMessage("Booking link saved.");
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Please try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<form className={`${styles.card} ${styles.form}`} onSubmit={save}>
			<label>
				<span className="sr-only">Calendly booking link</span>
				<input
					type="url"
					maxLength={2048}
					placeholder="https://calendly.com/your-name"
					value={url}
					disabled={!loaded}
					onChange={(event) => setUrl(event.target.value)}
				/>
			</label>
			<p>Leave blank to hide booking. This link is shared across your teaching workspaces.</p>
			<div className={styles.actions}>
				<button type="submit" className={styles.primary} disabled={busy || !loaded}>
					{busy ? "Saving…" : "Save booking link"}
				</button>
			</div>
			{message && <output className="text-center text-sm text-[#80629e]">{message}</output>}
		</form>
	);
}
