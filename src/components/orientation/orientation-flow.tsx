"use client";

import { useCallback, useEffect, useState } from "react";
import { StudentBooking } from "@/components/student/student-booking";
import {
	CHECK_IN_OPTIONS,
	type OrientationView,
	orientationIntakeSchema,
} from "@/lib/orientation/validation";

const steps = [
	"Who should we keep in the loop?",
	"Tell us about the learner",
	"Check-in",
	"Book time",
	"Zoom",
	"Quiz",
	"Parent progress",
];
const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white";
const buttonClass =
	"rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-50";

export function OrientationFlow({
	token,
	resumeProgress = false,
}: {
	token: string;
	resumeProgress?: boolean;
}) {
	const [view, setView] = useState<OrientationView | null>(null);
	const [step, setStep] = useState(0);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [form, setForm] = useState({
		parentName: "",
		parentEmail: "",
		phone: "",
		studentFirstName: "",
		studentLastInitial: "",
		gradeLevel: "",
		learningContent: "",
		initialSignal: "",
	});
	const refresh = useCallback(async () => {
		const response = await fetch(`/api/orientation/${token}`, { cache: "no-store" });
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || "Could not load orientation.");
		setView(data);
		return data as OrientationView;
	}, [token]);
	useEffect(() => {
		refresh()
			.then((data) => {
				setStep(data.enrolled ? (resumeProgress ? 6 : 3) : 0);
				setForm((current) => ({
					...current,
					gradeLevel: data.defaultGrade,
					learningContent: data.content,
				}));
			})
			.catch((err) => setError(err.message));
	}, [refresh, resumeProgress]);

	async function next() {
		setError("");
		const result =
			step === 0
				? orientationIntakeSchema
						.pick({ parentName: true, parentEmail: true, phone: true })
						.safeParse(form)
				: step === 1
					? orientationIntakeSchema
							.pick({
								studentFirstName: true,
								studentLastInitial: true,
								gradeLevel: true,
								learningContent: true,
							})
							.safeParse(form)
					: orientationIntakeSchema.safeParse(form);
		if (!result.success) {
			setError(result.error.issues[0]?.message ?? "Check your details.");
			return;
		}
		if (step < 2) {
			setStep(step + 1);
			return;
		}
		setBusy(true);
		try {
			const response = await fetch(`/api/orientation/${token}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not save orientation.");
			await refresh();
			setStep(3);
			// Parent details are no longer needed in the browser after enrollment.
			setForm((current) => ({
				...current,
				parentName: "",
				parentEmail: "",
				phone: "",
				studentFirstName: "",
				studentLastInitial: "",
			}));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Please try again.");
		} finally {
			setBusy(false);
		}
	}

	async function join() {
		setBusy(true);
		setError("");
		try {
			const response = await fetch(`/api/orientation/${token}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "join" }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Could not open the classroom.");
			window.location.assign(data.url);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Please try again.");
		} finally {
			setBusy(false);
		}
	}

	function field(
		name: Exclude<keyof typeof form, "initialSignal">,
		label: string,
		type = "text",
		maxLength = 100,
	) {
		return (
			<label className="flex flex-col gap-2 text-sm text-slate-300" key={name}>
				{label}
				<input
					className={inputClass}
					name={name}
					type={type}
					maxLength={maxLength}
					value={form[name]}
					onChange={(event) => setForm({ ...form, [name]: event.target.value })}
				/>
			</label>
		);
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 text-slate-100">
			<header>
				<p className="text-sm font-semibold text-indigo-300">Class Pulse · Family orientation</p>
				<h1 className="mt-2 text-3xl font-bold">Let’s get ready to learn</h1>
				<p className="mt-2 text-slate-400">{view?.classLabel ?? "Your tutor’s learning space"}</p>
			</header>
			{error && (
				<p
					role="alert"
					className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200"
				>
					{error}
				</p>
			)}
			{!view ? (
				<p>{error ? "Contact your tutor if you need a new invitation." : "Loading orientation…"}</p>
			) : (
				<>
					<section className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
						<h2 className="text-xl font-semibold">{steps[step]}</h2>
						{step === 0 && (
							<>
								<p className="text-sm text-slate-400">
									We’ll contact this number to confirm where learning updates should go. You can
									start tutoring while we confirm it.
								</p>
								{field("parentName", "Parent / guardian name")}
								{field("parentEmail", "Parent email", "email", 254)}
								{field("phone", "Parent phone (US)", "tel", 30)}
							</>
						)}
						{step === 1 && (
							<>
								{field("studentFirstName", "Student first name", "text", 50)}
								{field("studentLastInitial", "Student last initial", "text", 1)}
								{field("gradeLevel", "Grade / level (optional — K, 8, mixed, adult)", "text", 10)}
								<label className="flex flex-col gap-2 text-sm text-slate-300">
									What would you like to learn or practice?
									<textarea
										className={inputClass}
										rows={4}
										maxLength={2000}
										value={form.learningContent}
										onChange={(event) => setForm({ ...form, learningContent: event.target.value })}
									/>
								</label>
							</>
						)}
						{step === 2 && (
							<>
								<p className="text-lg">How are you doing?</p>
								<p className="text-sm text-slate-400">
									Think about the topic you chose. This is a confidence check, not a quiz score.
								</p>
								<fieldset className="space-y-3">
									<legend className="sr-only">How are you doing?</legend>
									{CHECK_IN_OPTIONS.map((option) => (
										<label
											key={option.value}
											className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${form.initialSignal === option.value ? "border-indigo-400 bg-indigo-500/15" : "border-slate-700"}`}
										>
											<input
												type="radio"
												name="initialSignal"
												value={option.value}
												checked={form.initialSignal === option.value}
												onChange={() => setForm({ ...form, initialSignal: option.value })}
											/>
											<span>
												<strong>{option.label}</strong>
												<span className="mt-1 block text-sm text-slate-400">
													{option.description}
												</span>
											</span>
										</label>
									))}
								</fieldset>
							</>
						)}
						{step === 3 && (
							<>
								<p>Your orientation is saved. Choose a time with your tutor.</p>
								{view.bookingUrl ? (
									<StudentBooking bookingUrl={view.bookingUrl} />
								) : (
									<p className="text-sm text-amber-200">
										Your tutor has not added a booking link yet. Contact them to arrange a time.
									</p>
								)}
								<p className="text-sm text-slate-400">
									Complete booking in Calendly and keep its confirmation. Opening the calendar alone
									does not book a session.
								</p>
							</>
						)}
						{step === 4 && (
							<>
								<p>At your scheduled time, join your tutor on Zoom.</p>
								{view.meetingUrl ? (
									<a
										className={buttonClass}
										href={view.meetingUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										Join Zoom session ↗
									</a>
								) : (
									<p className="text-slate-400">
										Use the Zoom link in your booking confirmation. If it is missing, ask your tutor
										for the meeting link.
									</p>
								)}
								<button
									type="button"
									className="text-left text-sm text-indigo-300 underline"
									onClick={() => refresh().catch((err) => setError(err.message))}
								>
									Refresh tutor links
								</button>
							</>
						)}
						{step === 5 && (
							<>
								<p>Use your tutor’s assigned quiz or enter the Class Pulse classroom.</p>
								{view.quizUrl && (
									<a
										href={view.quizUrl}
										target="_blank"
										rel="noopener noreferrer"
										className={buttonClass}
									>
										Open assigned quiz ↗
									</a>
								)}
								<button type="button" disabled={busy} className={buttonClass} onClick={join}>
									Enter classroom quiz
								</button>
								<p className="text-sm text-slate-400">
									The classroom opens when your tutor starts the session. External quiz results are
									reviewed by your tutor; opening a quiz does not record mastery.
								</p>
							</>
						)}
						{step === 6 && (
							<>
								<p>
									Your tutor will review the quiz and what you demonstrated during the session, then
									share a private parent report link.
								</p>
								<ul className="list-disc space-y-2 pl-5 text-slate-300">
									<li>What you can do independently</li>
									<li>What still needs practice</li>
									<li>A concrete activity to reinforce learning at home</li>
								</ul>
								<p className="text-sm text-slate-400">
									The parent link is shared separately by your tutor. Your check-in describes how
									you feel; it is not a mastery score.
								</p>
							</>
						)}
						<div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
							<button
								type="button"
								disabled={busy || step === 0 || (view.enrolled && step === 3)}
								onClick={() => {
									setStep(step - 1);
									setError("");
								}}
								className="px-3 py-2 text-slate-300 disabled:opacity-30"
							>
								Back
							</button>
							{step < 3 ? (
								<button type="button" className={buttonClass} disabled={busy} onClick={next}>
									{busy ? "Saving…" : step === 2 ? "Save & book time" : "Continue"}
								</button>
							) : step < 6 ? (
								<button
									type="button"
									className={buttonClass}
									onClick={() => {
										setStep(step + 1);
										setError("");
									}}
								>
									{step === 3 ? "Continue to session details" : "Continue"}
								</button>
							) : (
								<button type="button" className={buttonClass} onClick={() => setStep(3)}>
									Back to booking
								</button>
							)}
						</div>
					</section>
				</>
			)}
		</main>
	);
}
