"use client";
import { useEffect, useRef } from "react";
import { useVoiceQueue } from "@/contexts/voice-queue";
import { ReservationSidebar } from "./reservation-sidebar";

export function ReservationOverlay() {
	const { scheduleOverlayOpen, setScheduleOverlayOpen } = useVoiceQueue();
	const dialog = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		if (scheduleOverlayOpen) dialog.current?.showModal();
		else dialog.current?.close();
	}, [scheduleOverlayOpen]);
	return (
		<dialog
			ref={dialog}
			aria-label="Calendly schedule"
			onCancel={() => setScheduleOverlayOpen(false)}
			className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-80 max-w-full border-r border-slate-700 bg-slate-900 p-3 text-slate-100 backdrop:bg-black/40"
		>
			<button
				type="button"
				className="mb-3 text-xs underline"
				onClick={() => setScheduleOverlayOpen(false)}
			>
				Close schedule
			</button>
			{scheduleOverlayOpen && <ReservationSidebar variant="classroom" />}
		</dialog>
	);
}
