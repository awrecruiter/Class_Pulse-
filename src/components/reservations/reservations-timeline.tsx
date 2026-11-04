"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Reservation } from "./reservation-sidebar";

function dayKey(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const hours = Array.from({ length: 24 }, (_, hour) => hour);
export function ReservationsTimeline({
	rows,
	onEdit,
	onRemove,
}: {
	rows: Reservation[];
	onEdit?: (row: Reservation) => void;
	onRemove?: (row: Reservation) => void;
}) {
	const [day, setDay] = useState(() => new Date());
	const scroll = useRef<HTMLDivElement>(null);
	const today = dayKey(day);
	const bookings = rows.filter((row) => {
		const start = new Date(row.startsAt),
			end = new Date(row.endsAt);
		const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate());
		const tomorrow = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
		return start < tomorrow && end > midnight;
	});
	const firstStart = bookings[0]?.startsAt;
	useEffect(() => {
		if (!scroll.current) return;
		const first = firstStart ? new Date(firstStart) : new Date();
		scroll.current.scrollTop = Math.max(0, (first.getHours() - 0.25) * 130);
	}, [firstStart]);
	function move(delta: number) {
		setDay(
			(current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta),
		);
	}
	return (
		<div>
			<div className="flex items-center justify-between px-1 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
				<button type="button" aria-label="Previous booking day" onClick={() => move(-1)}>
					<ChevronLeft size={15} />
				</button>
				<button type="button" onClick={() => setDay(new Date())}>
					{day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
				</button>
				<button type="button" aria-label="Next booking day" onClick={() => move(1)}>
					<ChevronRight size={15} />
				</button>
			</div>
			{bookings.length === 0 && (
				<p className="px-2 pb-3 text-xs text-slate-500">No reservations for this day.</p>
			)}
			<section
				ref={scroll}
				className="overflow-y-auto"
				style={{ height: 260 }}
				aria-label={`Reservations for ${today}`}
			>
				<div className="relative" style={{ height: 24 * 130 }}>
					{hours.map((hour) => (
						<div
							key={hour}
							className="absolute inset-x-0 border-t border-slate-700/50"
							style={{ top: hour * 130 }}
						>
							<span className="text-[10px] text-slate-500">
								{new Date(2026, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric" })}
							</span>
						</div>
					))}
					{bookings.map((row) => {
						const start = new Date(row.startsAt),
							end = new Date(row.endsAt);
						const from = dayKey(start) === today ? start.getHours() * 60 + start.getMinutes() : 0;
						const to = dayKey(end) === today ? end.getHours() * 60 + end.getMinutes() : 1440;
						return (
							<div
								key={row.id}
								className="absolute left-12 right-1 rounded-lg border border-violet-500/30 border-l-[3px] bg-violet-500/10 px-2 py-1 text-[11px] overflow-y-auto"
								style={{ top: (from / 60) * 130, height: Math.max(70, ((to - from) / 60) * 130) }}
							>
								<p className="font-semibold text-violet-300">
									{row.learningSpaceUrl ? (
										<Link href={row.learningSpaceUrl}>{row.learnerName}</Link>
									) : (
										row.learnerName
									)}
								</p>
								<p>
									{row.subject || "Subject not provided"} · {row.topic || "Topic not provided"}
								</p>
								<p className="text-[9px] text-slate-500">
									{start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} ·{" "}
									{row.source === "demo"
										? "Demo reservation"
										: row.source === "calendly"
											? "Calendly"
											: "Manual reservation"}
								</p>
								{row.source === "calendly" ? (
									<button
										type="button"
										className="text-[9px] underline"
										onClick={() => onEdit?.(row)}
									>
										Edit details
									</button>
								) : (
									<button
										type="button"
										className="text-[9px] underline"
										onClick={() => onRemove?.(row)}
									>
										Remove reservation
									</button>
								)}
							</div>
						);
					})}
				</div>
			</section>
			{rows.length > 0 && (
				<div className="px-1 pt-3 flex flex-wrap gap-2">
					<span className="text-[10px] text-slate-500">Upcoming:</span>
					{rows.slice(0, 7).map((row) => (
						<button
							key={row.id}
							type="button"
							className="text-[10px] text-violet-300 underline"
							onClick={() => setDay(new Date(row.startsAt))}
						>
							{new Date(row.startsAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
							})}{" "}
							· {row.learnerName}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
