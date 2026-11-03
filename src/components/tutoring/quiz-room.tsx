"use client";
import { useState } from "react";
import styles from "./workspace.module.css";

type Session = { id: string; joinCode: string };
export function QuizRoom({
	classId,
	initialSession,
}: {
	classId: string;
	initialSession: Session | null;
}) {
	const [session, setSession] = useState(initialSession);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	async function toggle() {
		setBusy(true);
		setError("");
		try {
			const response = await fetch(session ? `/api/sessions/${session.id}/end` : "/api/sessions", {
				method: session ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ classId }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not update the quiz room.");
			setSession(session ? null : data.session);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Please try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<section className={`${styles.card} text-center`}>
			<h2>{session ? "Your quiz room is open." : "Ready when you are."}</h2>
			<p>
				Families book through Calendly and meet through your Zoom link. Open the quiz room when you
				want learners to use Class Pulse activities and check-ins.
			</p>
			{session && (
				<p>
					Student join code:{" "}
					<strong className="tracking-widest text-[#6d50a3]">{session.joinCode}</strong>
				</p>
			)}
			<div className={styles.actions}>
				<button type="button" className={styles.primary} onClick={toggle} disabled={busy}>
					{busy ? "Updating…" : session ? "Close quiz room" : "Open quiz room"}
				</button>
				{session && (
					<a
						className={styles.secondary}
						href={`/student?code=${session.joinCode}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						Open student portal ↗
					</a>
				)}
				<a className={styles.secondary} href="#family-orientation">
					Family invitations ↓
				</a>
			</div>
			{error && (
				<p role="alert" className={styles.error}>
					{error}
				</p>
			)}
		</section>
	);
}
