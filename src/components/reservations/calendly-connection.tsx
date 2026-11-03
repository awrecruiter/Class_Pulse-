"use client";
import { useEffect, useState } from "react";
import styles from "@/components/tutoring/workspace.module.css";
export function CalendlyConnection() {
	const [connected, setConnected] = useState(false);
	const [name, setName] = useState("");
	const [token, setToken] = useState("");
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		fetch("/api/calendly/connection")
			.then((r) => r.json())
			.then((data) => {
				setConnected(data.connected);
				setName(data.accountName ?? "");
			})
			.catch(() => setMessage("Could not load Calendly connection."));
	}, []);
	async function save(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		try {
			const response = await fetch("/api/calendly/connection", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error);
			setConnected(true);
			setName(data.accountName);
			setToken("");
			setMessage("Calendly connected. Refresh your schedule to see reservations.");
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Could not connect.");
		} finally {
			setBusy(false);
		}
	}
	async function disconnect() {
		const response = await fetch("/api/calendly/connection", { method: "DELETE" });
		if (response.ok) {
			setConnected(false);
			setName("");
			setMessage("Calendly disconnected.");
		} else setMessage("Could not disconnect. Please retry.");
	}
	return (
		<section id="calendly-connection" className={`${styles.card} ${styles.form}`}>
			<h2 className="text-center">Your reservations, together.</h2>
			<p>
				{connected
					? `Connected as ${name}.`
					: "Connect Calendly to see confirmed bookings in your schedule sidebar."}
			</p>
			<p className="text-sm">
				Create a personal access token in Calendly’s API & webhooks settings with user, event, and
				invitee read access. Enter it here, never in a message.
			</p>
			<form className="space-y-4" onSubmit={save}>
				<label>
					<span className="sr-only">Calendly personal access token</span>
					<input
						type="password"
						autoComplete="new-password"
						value={token}
						required
						minLength={20}
						maxLength={4000}
						placeholder="Calendly personal access token"
						onChange={(event) => setToken(event.target.value)}
					/>
				</label>
				<div className={styles.actions}>
					<button disabled={busy} className={styles.primary} type="submit">
						{busy ? "Connecting…" : connected ? "Reconnect Calendly" : "Connect Calendly"}
					</button>
					{connected && (
						<button className={styles.secondary} type="button" onClick={disconnect}>
							Disconnect
						</button>
					)}
				</div>
			</form>
			<p className="text-xs">
				Tokens are encrypted. Add Student name, Subject and Topic questions to your booking event so
				those details can appear in your schedule.
			</p>
			{message && <output className="text-sm text-center">{message}</output>}
		</section>
	);
}
