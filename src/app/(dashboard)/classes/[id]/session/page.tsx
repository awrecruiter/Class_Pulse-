"use client";

import { AlertTriangleIcon, ArrowLeftIcon, SendIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type PulseData = {
	gotIt: number;
	almost: number;
	lost: number;
	stuckFor60s: number;
	total: number;
	ts: number;
};

function pct(count: number, total: number) {
	if (total === 0) return 0;
	return Math.round((count / total) * 100);
}

function GaugeBar({
	count,
	total,
	color,
	label,
	emoji,
}: {
	count: number;
	total: number;
	color: string;
	label: string;
	emoji: string;
}) {
	const p = pct(count, total);
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between text-sm">
				<span className="flex items-center gap-1.5 font-medium text-foreground">
					<span>{emoji}</span>
					{label}
				</span>
				<span className="font-bold text-foreground tabular-nums">
					{count}
					<span className="text-muted-foreground font-normal ml-1">({p}%)</span>
				</span>
			</div>
			<div className="h-3 w-full rounded-full bg-muted overflow-hidden">
				<div
					className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
					style={{ width: `${p}%` }}
				/>
			</div>
		</div>
	);
}

export default function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const [pulse, setPulse] = useState<PulseData | null>(null);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState("");
	const esRef = useRef<EventSource | null>(null);

	// Fetch active session id from class detail API to get sessionId
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [classLabel, setClassLabel] = useState("");
	const [loadingSession, setLoadingSession] = useState(true);
	const [pushing, setPushing] = useState(false);
	const [mastery, setMastery] = useState<{
		mastered: number;
		working: number;
		total: number;
	} | null>(null);

	useEffect(() => {
		async function fetchSession() {
			try {
				const res = await fetch(`/api/classes/${id}`);
				if (!res.ok) throw new Error("Not found");
				const json = await res.json();
				if (json.activeSession) {
					setSessionId(json.activeSession.id);
					setClassLabel(json.class?.label ?? "");
				} else {
					setError("No active session. Start a session from the class page first.");
				}
			} catch {
				setError("Failed to load session.");
			} finally {
				setLoadingSession(false);
			}
		}
		fetchSession();
	}, [id]);

	// Poll mastery count
	useEffect(() => {
		if (!sessionId) return;
		async function fetchMastery() {
			const res = await fetch(`/api/sessions/${sessionId}/mastery`);
			if (res.ok) {
				const data = await res.json();
				setMastery(data);
			}
		}
		fetchMastery();
		const interval = setInterval(fetchMastery, 15000);
		return () => clearInterval(interval);
	}, [sessionId]);

	// Connect SSE once we have a sessionId
	useEffect(() => {
		if (!sessionId) return;

		const es = new EventSource(`/api/sessions/${sessionId}/pulse`);
		esRef.current = es;

		es.onopen = () => setConnected(true);

		es.onmessage = (e) => {
			try {
				const data = JSON.parse(e.data) as PulseData;
				setPulse(data);
			} catch {
				// ignore parse error
			}
		};

		es.onerror = () => {
			setConnected(false);
		};

		return () => {
			es.close();
		};
	}, [sessionId]);

	if (loadingSession) {
		return (
			<div className="mx-auto max-w-lg px-4 py-8">
				<div className="h-8 w-48 rounded bg-muted/40 animate-pulse mb-4" />
				<div className="h-48 rounded-lg bg-muted/30 animate-pulse" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="mx-auto max-w-lg px-4 py-8">
				<Link
					href={`/classes/${id}`}
					className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
				>
					<ArrowLeftIcon className="h-3.5 w-3.5" />
					Back to class
				</Link>
				<p className="text-sm text-muted-foreground">{error}</p>
			</div>
		);
	}

	async function pushManipulative(spec: object, standardCode?: string) {
		if (!sessionId || pushing) return;
		setPushing(true);
		try {
			const res = await fetch(`/api/sessions/${sessionId}/push`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ spec, triggeredBy: "teacher", standardCode }),
			});
			if (!res.ok) throw new Error("Failed");
			toast.success("Sent to all students!");
		} catch {
			toast.error("Failed to send");
		} finally {
			setPushing(false);
		}
	}

	const PRESETS = [
		{
			label: "Fraction Bar",
			emoji: "📊",
			standardCode: "MA.5.FR.1.1",
			spec: {
				type: "fraction-bar",
				bars: [
					{ parts: 4, filled: 1, label: "1/4" },
					{ parts: 4, filled: 3, label: "3/4" },
				],
				caption: "Tap the parts to shade them — compare the two fractions.",
			},
		},
		{
			label: "Area Model",
			emoji: "🟦",
			standardCode: "MA.5.AR.1.1",
			spec: {
				type: "area-model",
				rows: 3,
				cols: 4,
				shadedRows: 2,
				shadedCols: 3,
				caption: "Tap cells to fill the area model — how many in each group?",
			},
		},
		{
			label: "Number Line",
			emoji: "📏",
			standardCode: "MA.5.FR.2.1",
			spec: {
				type: "number-line",
				min: 0,
				max: 1,
				markers: [
					{ value: 0, label: "0" },
					{ value: 0.25, label: "1/4" },
					{ value: 0.5, label: "1/2" },
					{ value: 0.75, label: "3/4" },
					{ value: 1, label: "1" },
				],
				highlightIndex: 2,
				caption: "Tap the point that shows your answer on the number line.",
			},
		},
	] as const;

	const total = pulse?.total ?? 0;
	const lostPct = pct(pulse?.lost ?? 0, total);
	const showAlert = lostPct >= 40;
	const stuckCount = pulse?.stuckFor60s ?? 0;

	return (
		<div className="mx-auto max-w-lg px-4 py-8 flex flex-col gap-5">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Link
					href={`/classes/${id}`}
					className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="h-3.5 w-3.5" />
					Back
				</Link>
				<div className="flex-1">
					<h1 className="text-lg font-bold text-foreground">{classLabel} — Live</h1>
				</div>
				<div className="flex items-center gap-1.5">
					<span
						className={`h-2 w-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`}
					/>
					<span className="text-xs text-muted-foreground">
						{connected ? "Live" : "Connecting..."}
					</span>
				</div>
			</div>

			{/* Alert banner */}
			{showAlert && (
				<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 flex items-start gap-2">
					<AlertTriangleIcon className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
					<div>
						<p className="text-sm font-semibold text-red-700">{lostPct}% of students are lost</p>
						<p className="text-xs text-red-500 mt-0.5">
							Consider pausing and reteaching or checking in with the class.
						</p>
					</div>
				</div>
			)}

			{/* Stuck alert */}
			{stuckCount > 0 && (
				<div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 flex items-start gap-2">
					<AlertTriangleIcon className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
					<p className="text-sm text-orange-700">
						<span className="font-semibold">
							{stuckCount} student{stuckCount !== 1 ? "s" : ""}
						</span>{" "}
						{stuckCount === 1 ? "has" : "have"} been stuck for 60+ seconds. Interactive help coming
						in Phase 3.
					</p>
				</div>
			)}

			{/* Comprehension gauge */}
			<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<p className="text-sm font-semibold text-foreground">Comprehension Pulse</p>
					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<UsersIcon className="h-3 w-3" />
						{total} responded
					</div>
				</div>

				{total === 0 ? (
					<div className="py-6 text-center">
						<p className="text-sm text-muted-foreground">Waiting for students to signal...</p>
						<p className="text-xs text-muted-foreground mt-1">
							Students tap how they&apos;re doing on their device.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						<GaugeBar
							count={pulse?.gotIt ?? 0}
							total={total}
							color="bg-green-500"
							label="Got it"
							emoji="✅"
						/>
						<GaugeBar
							count={pulse?.almost ?? 0}
							total={total}
							color="bg-yellow-400"
							label="Almost"
							emoji="🤔"
						/>
						<GaugeBar
							count={pulse?.lost ?? 0}
							total={total}
							color="bg-red-500"
							label="Lost"
							emoji="😕"
						/>
					</div>
				)}
			</div>

			{/* Summary donut-ish display */}
			{total > 0 && (
				<div className="grid grid-cols-3 gap-3">
					{[
						{
							label: "Got it",
							count: pulse?.gotIt ?? 0,
							color: "text-green-600",
							bg: "bg-green-50 border-green-200",
						},
						{
							label: "Almost",
							count: pulse?.almost ?? 0,
							color: "text-yellow-600",
							bg: "bg-yellow-50 border-yellow-200",
						},
						{
							label: "Lost",
							count: pulse?.lost ?? 0,
							color: "text-red-600",
							bg: "bg-red-50 border-red-200",
						},
					].map((item) => (
						<div
							key={item.label}
							className={`rounded-lg border ${item.bg} p-3 flex flex-col items-center gap-0.5`}
						>
							<p className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.count}</p>
							<p className="text-xs text-muted-foreground">{item.label}</p>
						</div>
					))}
				</div>
			)}

			{/* Push manipulative to all students */}
			<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<SendIcon className="h-4 w-4 text-muted-foreground" />
					<p className="text-sm font-semibold text-foreground">Push Help to Students</p>
				</div>
				<p className="text-xs text-muted-foreground">
					Tap a preset to send an interactive manipulative to all students' screens.
				</p>
				<div className="grid grid-cols-3 gap-2">
					{PRESETS.map((preset) => (
						<button
							key={preset.label}
							type="button"
							onClick={() => pushManipulative(preset.spec, preset.standardCode)}
							disabled={pushing || !sessionId}
							className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-3 text-center hover:bg-muted/60 transition-colors disabled:opacity-50 active:scale-95"
						>
							<span className="text-2xl">{preset.emoji}</span>
							<span className="text-xs font-medium text-foreground leading-tight">
								{preset.label}
							</span>
						</button>
					))}
				</div>
				{pushing && (
					<p className="text-xs text-muted-foreground text-center animate-pulse">Sending...</p>
				)}
			</div>

			{/* Mastery tracking */}
			{mastery && mastery.total > 0 && (
				<div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
					<p className="text-sm font-semibold text-foreground">🎯 Mastery Progress</p>
					<div className="grid grid-cols-2 gap-3">
						<div className="rounded-lg border border-green-200 bg-green-50 p-3 flex flex-col items-center gap-0.5">
							<p className="text-2xl font-bold tabular-nums text-green-600">{mastery.mastered}</p>
							<p className="text-xs text-muted-foreground">Mastered</p>
						</div>
						<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex flex-col items-center gap-0.5">
							<p className="text-2xl font-bold tabular-nums text-blue-600">{mastery.working}</p>
							<p className="text-xs text-muted-foreground">In progress</p>
						</div>
					</div>
					<p className="text-xs text-muted-foreground text-center">
						{mastery.total} quiz attempt{mastery.total !== 1 ? "s" : ""} total
					</p>
				</div>
			)}

			{/* Note about privacy */}
			<p className="text-xs text-muted-foreground text-center">
				Aggregate only — no individual names shown during class.
			</p>

			{/* Coach shortcut */}
			<Button variant="outline" asChild>
				<Link href="/coach">Open AI Coach</Link>
			</Button>
		</div>
	);
}
