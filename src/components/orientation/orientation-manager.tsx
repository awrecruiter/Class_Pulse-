"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CHECK_IN_OPTIONS } from "@/lib/orientation/validation";

type Invite = {
	parentPhone: string | null;
	confirmedPhone: string | null;
	phoneConfirmedAt: string | null;
	id: string;
	token: string;
	rosterId: string | null;
	studentName: string | null;
	schoolName: string;
	schoolOptions?: string[];
	parentEmail: string;
	gradeLevel: string;
	learningContent: string;
	initialSignal: string | null;
	content: string;
	quizUrl: string;
	meetingUrl: string;
	progressNote: string;
	homePractice: string;
	reviewedAt: string | null;
	enrolledAt: string | null;
	expiresAt: string;
};
type Setup = { schoolOptions?: string[]; content: string; quizUrl: string; meetingUrl: string };
const empty: Setup = { schoolOptions: [], content: "", quizUrl: "", meetingUrl: "" };
const inputClass =
	"w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100";
const buttonClass =
	"rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40";

function SetupFields({
	value,
	onChange,
	prefix,
}: {
	value: Setup;
	onChange: (value: Setup) => void;
	prefix: string;
}) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<label className="flex flex-col gap-2 text-sm sm:col-span-2">
				School choices (one per line)
				<textarea
					className={inputClass}
					rows={3}
					value={(value.schoolOptions ?? []).join("\n")}
					onChange={(event) =>
						onChange({ ...value, schoolOptions: event.target.value.split("\n") })
					}
				/>
				<span className="text-xs text-slate-400">
					Families can select one of these schools or enter another school.
				</span>
			</label>
			<label className="flex flex-col gap-2 text-sm sm:col-span-2" htmlFor={`${prefix}-content`}>
				Learning content / topic
				<textarea
					id={`${prefix}-content`}
					className={inputClass}
					rows={2}
					maxLength={2000}
					value={value.content}
					onChange={(event) => onChange({ ...value, content: event.target.value })}
				/>
			</label>
			<label className="flex flex-col gap-2 text-sm" htmlFor={`${prefix}-quiz`}>
				Assigned quiz link (optional)
				<input
					id={`${prefix}-quiz`}
					className={inputClass}
					type="url"
					maxLength={2048}
					placeholder="https://…"
					value={value.quizUrl}
					onChange={(event) => onChange({ ...value, quizUrl: event.target.value })}
				/>
			</label>
			<label className="flex flex-col gap-2 text-sm" htmlFor={`${prefix}-zoom`}>
				Zoom link (optional)
				<input
					id={`${prefix}-zoom`}
					className={inputClass}
					type="url"
					maxLength={2048}
					placeholder="https://…zoom.us/j/…"
					value={value.meetingUrl}
					onChange={(event) => onChange({ ...value, meetingUrl: event.target.value })}
				/>
			</label>
		</div>
	);
}

function InviteCard({
	invite,
	classId,
	reload,
}: {
	invite: Invite;
	classId: string;
	reload: () => Promise<void>;
}) {
	const [fields, setFields] = useState<Setup>(invite);
	const [progressNote, setProgressNote] = useState(invite.progressNote);
	const [homePractice, setHomePractice] = useState(invite.homePractice);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [reportUrl, setReportUrl] = useState("");
	const dirty =
		JSON.stringify((fields.schoolOptions ?? []).map((school) => school.trim()).filter(Boolean)) !==
			JSON.stringify(invite.schoolOptions ?? []) ||
		fields.content !== invite.content ||
		fields.quizUrl !== invite.quizUrl ||
		fields.meetingUrl !== invite.meetingUrl ||
		progressNote !== invite.progressNote ||
		homePractice !== invite.homePractice;
	const parentConfirmed = !!invite.phoneConfirmedAt && invite.parentPhone === invite.confirmedPhone;
	const expired = new Date(invite.expiresAt) < new Date();

	async function save(reviewed: boolean) {
		setBusy(true);
		setMessage("");
		try {
			const response = await fetch(`/api/classes/${classId}/orientations/${invite.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...fields,
					schoolOptions: (fields.schoolOptions ?? []).map((s) => s.trim()).filter(Boolean),
					progressNote,
					homePractice,
					reviewed,
				}),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not save.");
			await reload();
			setMessage(
				reviewed
					? "Progress reviewed. You can create the parent report link."
					: "Draft saved. Review progress before sharing with the parent.",
			);
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Could not save.");
		} finally {
			setBusy(false);
		}
	}
	async function confirmParent() {
		setBusy(true);
		setMessage("");
		setReportUrl("");
		try {
			const response = await fetch(`/api/classes/${classId}/orientations/${invite.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "confirm-parent", phone: invite.parentPhone }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error);
			await reload();
			setMessage("Parent number confirmed. Reviewed reports can now be shared.");
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Could not confirm number.");
		} finally {
			setBusy(false);
		}
	}
	async function share() {
		setBusy(true);
		setMessage("");
		try {
			const response = await fetch("/api/report/token", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ classId, rosterId: invite.rosterId }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not create report.");
			setReportUrl(data.url);
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Could not create report.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<article className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
			<header>
				<h3 className="font-semibold">{invite.studentName || "New family invitation"}</h3>
				<p className="text-xs text-slate-400">
					{invite.rosterId ? "Orientation received" : "Awaiting orientation"} ·{" "}
					{expired
						? "Invitation expired"
						: `Invitation expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
				</p>
			</header>
			{!expired && (
				<button
					type="button"
					className="text-sm text-indigo-300 underline"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(
								`${window.location.origin}/student/orientation/${invite.token}`,
							);
							setMessage("Private invitation link copied. Share it with this family only.");
						} catch {
							setMessage(
								"Clipboard unavailable. Open the family orientation and copy its address.",
							);
						}
					}}
				>
					Copy private orientation link
				</button>
			)}
			{!expired && (
				<a
					className="ml-4 text-sm text-indigo-300 underline"
					href={`/student/orientation/${invite.token}`}
					target="_blank"
					rel="noopener noreferrer"
				>
					Open family orientation ↗
				</a>
			)}
			{invite.rosterId && (
				<div className="space-y-2 rounded-lg bg-slate-950 p-4 text-sm">
					<p>Parent email: {invite.parentEmail}</p>
					<p>School: {invite.schoolName || "Not specified"}</p>
					<p>Parent number: {invite.parentPhone || "No number on file"}</p>
					<p>
						{parentConfirmed
							? "Parent number confirmed"
							: "Parent number awaiting confirmation. Tutoring can continue."}
					</p>
					{!parentConfirmed && (
						<>
							<p className="text-xs text-slate-400">
								Contact this number and confirm it belongs to the parent before enabling report
								sharing.
							</p>
							<button
								type="button"
								className={buttonClass}
								disabled={busy || !invite.parentPhone}
								onClick={confirmParent}
							>
								I contacted and confirmed this parent number
							</button>
						</>
					)}
					<p>Grade / level: {invite.gradeLevel || "Not specified"}</p>
					<p className="whitespace-pre-wrap">Learning goals: {invite.learningContent}</p>
					<p>
						Initial self-check:{" "}
						{CHECK_IN_OPTIONS.find((option) => option.value === invite.initialSignal)?.label ??
							"Not provided"}
					</p>
					<p className="text-xs text-slate-400">
						The initial check-in is self-reported confidence, not a mastery assessment. Parent phone
						details are in Parent communications.
					</p>
				</div>
			)}
			<SetupFields prefix={invite.id} value={fields} onChange={setFields} />
			{invite.rosterId && (
				<>
					<label className="flex flex-col gap-2 text-sm">
						Reviewed learning evidence
						<textarea
							className={inputClass}
							maxLength={4000}
							rows={4}
							placeholder="Date, quiz/source, what the learner did independently, assistance needed, and what to check next."
							value={progressNote}
							onChange={(event) => setProgressNote(event.target.value)}
						/>
					</label>
					<label className="flex flex-col gap-2 text-sm">
						At-home reinforcement
						<textarea
							className={inputClass}
							maxLength={2000}
							rows={3}
							placeholder="One specific activity and what the parent should look for."
							value={homePractice}
							onChange={(event) => setHomePractice(event.target.value)}
						/>
					</label>
				</>
			)}
			<div className="flex flex-wrap gap-3">
				<button type="button" className={buttonClass} disabled={busy} onClick={() => save(false)}>
					Save draft / links
				</button>
				{invite.rosterId && (
					<>
						<button
							type="button"
							className={buttonClass}
							disabled={busy || !progressNote.trim() || !homePractice.trim()}
							onClick={() => save(true)}
						>
							Save reviewed progress
						</button>
						<button
							type="button"
							className={buttonClass}
							disabled={busy || dirty || !invite.reviewedAt || !parentConfirmed}
							onClick={share}
						>
							Create parent report link
						</button>
					</>
				)}
			</div>
			{message && <output className="block text-sm text-amber-200">{message}</output>}
			{reportUrl && parentConfirmed && (
				<div className="space-y-2 rounded-lg bg-indigo-500/10 p-4">
					<p className="text-sm">
						Preview this private report, then copy the link to share with the parent.
					</p>
					<a
						href={reportUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="block break-all text-sm text-indigo-300 underline"
					>
						{reportUrl}
					</a>
					<button
						type="button"
						className={buttonClass}
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(reportUrl);
								setMessage("Parent report link copied.");
							} catch {
								setMessage("Copy the report address above.");
							}
						}}
					>
						Copy parent report link
					</button>
				</div>
			)}
		</article>
	);
}

export function OrientationManager({ classId }: { classId: string }) {
	const [invites, setInvites] = useState<Invite[]>([]);
	const [setup, setSetup] = useState(empty);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const reload = useCallback(async () => {
		const response = await fetch(`/api/classes/${classId}/orientations`, { cache: "no-store" });
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || "Could not load orientations.");
		setInvites(data.orientations);
	}, [classId]);
	useEffect(() => {
		reload()
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [reload]);
	async function create() {
		setBusy(true);
		setError("");
		try {
			const response = await fetch(`/api/classes/${classId}/orientations`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...setup,
					schoolOptions: (setup.schoolOptions ?? []).map((s) => s.trim()).filter(Boolean),
				}),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not create invitation.");
			await reload();
			setSetup(empty);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not create invitation.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="space-y-6">
			<p className="text-sm text-slate-400">
				Create one private link per learner. Families complete intake and the existing understanding
				check, then continue to booking, Zoom, and quizzes. Review evidence before sharing the
				parent report.
			</p>
			<p className="text-sm">
				<Link href="/settings#booking" className="text-indigo-300 underline">
					Configure your Calendly link
				</Link>
				. Connect Zoom in Calendly for meeting details in confirmations. You can also add an
				individual Zoom link below.
			</p>
			{error && (
				<p role="alert" className="text-red-300">
					{error}
				</p>
			)}
			<section className="space-y-4 rounded-xl border border-slate-700 p-5">
				<h2 className="font-semibold">New family invitation</h2>
				<SetupFields prefix="new" value={setup} onChange={setSetup} />
				<p className="text-xs text-slate-400">
					Quiz links can come from Blooket, Wayground, Khan Academy, or another tutor-selected
					platform. Results are reviewed manually.
				</p>
				<button type="button" className={buttonClass} disabled={busy} onClick={create}>
					{busy ? "Creating…" : "Create orientation link"}
				</button>
			</section>
			<div className="flex items-center justify-between">
				<h2 className="font-semibold">Family orientations</h2>
				<button
					type="button"
					className="text-sm text-indigo-300 underline"
					onClick={() => reload().catch((err) => setError(err.message))}
				>
					Refresh
				</button>
			</div>
			{loading ? (
				<p>Loading…</p>
			) : invites.length === 0 ? (
				<p className="text-sm text-slate-400">No invitations yet.</p>
			) : (
				invites.map((invite) => (
					<InviteCard key={invite.id} invite={invite} classId={classId} reload={reload} />
				))
			)}
		</div>
	);
}
