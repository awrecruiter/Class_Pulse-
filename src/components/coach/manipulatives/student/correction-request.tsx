"use client";

import { useState } from "react";

type Props = {
	sessionId: string;
};

export function CorrectionRequest({ sessionId }: Props) {
	const [sent, setSent] = useState(false);
	const [context, setContext] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [loading, setLoading] = useState(false);

	async function handleSubmit() {
		setLoading(true);
		try {
			const res = await fetch(`/api/sessions/${sessionId}/correction-requests`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ context }),
			});
			if (!res.ok) throw new Error("Failed");
			setSent(true);
			setShowForm(false);
		} catch {
			// keep form open so student can retry
		} finally {
			setLoading(false);
		}
	}

	if (sent) {
		return (
			<div className="flex flex-col items-center gap-2 py-4">
				<p className="text-4xl">🙋</p>
				<p className="text-sm font-semibold text-green-700">Your teacher has been notified!</p>
				<p className="text-xs text-muted-foreground">Hang tight — help is coming.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-3 py-4">

			{!showForm ? (
				<button
					type="button"
					onClick={() => setShowForm(true)}
					className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition-transform"
				>
					🆘 I&apos;m Lost
				</button>
			) : (
				<div className="flex flex-col gap-2 w-full max-w-xs">
					<textarea
						value={context}
						onChange={(e) => setContext(e.target.value)}
						placeholder="What are you stuck on? (optional)"
						rows={2}
						className="resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setShowForm(false)}
							className="flex-1 rounded-xl border border-border py-2 text-sm text-muted-foreground"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={loading}
							className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-60"
						>
							Send
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
