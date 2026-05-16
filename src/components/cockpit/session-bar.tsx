"use client";

import { ExternalLinkIcon, PlayIcon, RadioIcon, XCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Session = { id: string; joinCode: string };

type Props = {
	classId: string;
	initialSession: Session | null;
};

export function SessionBar({ classId, initialSession }: Props) {
	const [session, setSession] = useState<Session | null>(initialSession);
	const [starting, setStarting] = useState(false);
	const [ending, setEnding] = useState(false);

	// Poll for active session every 10 seconds
	useEffect(() => {
		let cancelled = false;

		const poll = async () => {
			try {
				const res = await fetch(`/api/classes/${classId}/session/active`);
				if (!res.ok || cancelled) return;
				const json = (await res.json()) as { id: string | null; joinCode: string | null };
				if (cancelled) return;
				if (json.id && json.joinCode) {
					setSession({ id: json.id, joinCode: json.joinCode });
				} else {
					setSession(null);
				}
			} catch {
				// non-fatal
			}
		};

		poll();
		const interval = setInterval(poll, 10_000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [classId]);

	async function handleGoLive() {
		setStarting(true);
		try {
			const res = await fetch("/api/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ classId }),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				toast.error(err.error ?? "Failed to start session");
				return;
			}
			const json = (await res.json()) as { session: { id: string; joinCode: string } };
			setSession({ id: json.session.id, joinCode: json.session.joinCode });
			toast.success("Session started — you are live!");
		} catch {
			toast.error("Failed to start session");
		} finally {
			setStarting(false);
		}
	}

	async function handleEndSession() {
		if (!session) return;
		setEnding(true);
		try {
			const res = await fetch(`/api/sessions/${session.id}/end`, { method: "POST" });
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				toast.error(err.error ?? "Failed to end session");
				return;
			}
			setSession(null);
			toast.success("Session ended");
		} catch {
			toast.error("Failed to end session");
		} finally {
			setEnding(false);
		}
	}

	function handleCopyCode() {
		if (!session) return;
		navigator.clipboard.writeText(session.joinCode).then(() => {
			toast.success("Join code copied!");
		});
	}

	async function handleOpenStudentTab() {
		if (!session) return;
		try {
			// preview-join sets the student cookie then returns the redirect URL,
			// so the teacher can view the student screen without a real roster entry.
			const res = await fetch(`/api/sessions/${session.id}/preview-join`, { method: "POST" });
			if (!res.ok) {
				toast.error("Could not open student preview");
				return;
			}
			const { redirectUrl } = (await res.json()) as { redirectUrl: string };
			window.open(redirectUrl, "_blank");
		} catch {
			toast.error("Could not open student preview");
		}
	}

	if (session) {
		return (
			<div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-5 py-3 flex items-center gap-3 flex-wrap">
				{/* Live indicator */}
				<div className="flex items-center gap-1.5 shrink-0">
					<RadioIcon className="h-4 w-4 text-emerald-400 animate-pulse" />
					<span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live</span>
				</div>

				{/* Join code — click to copy */}
				<button
					type="button"
					onClick={handleCopyCode}
					title="Click to copy join code"
					className="font-mono text-base font-bold text-amber-400 tracking-widest bg-amber-950/30 border border-amber-700/40 rounded-lg px-3 py-1 hover:bg-amber-950/50 transition-colors shrink-0"
				>
					{session.joinCode}
				</button>

				<span className="text-xs text-slate-500 hidden sm:block">click code to copy</span>

				<div className="ml-auto flex items-center gap-2">
					{/* Open student tab */}
					<button
						type="button"
						onClick={handleOpenStudentTab}
						className="flex items-center gap-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
					>
						<ExternalLinkIcon className="h-3.5 w-3.5" />
						Open Student Tab
					</button>

					{/* End session */}
					<button
						type="button"
						onClick={handleEndSession}
						disabled={ending}
						className="flex items-center gap-1.5 rounded-lg border border-red-700/50 bg-red-950/30 hover:bg-red-950/60 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors disabled:opacity-50"
					>
						<XCircleIcon className="h-3.5 w-3.5" />
						{ending ? "Ending…" : "End Session"}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-3 flex items-center gap-3">
			<button
				type="button"
				onClick={handleGoLive}
				disabled={starting}
				className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50 shrink-0"
			>
				<PlayIcon className="h-4 w-4" />
				{starting ? "Starting…" : "Go Live"}
			</button>
			<span className="text-sm text-slate-500">No active session</span>
		</div>
	);
}
