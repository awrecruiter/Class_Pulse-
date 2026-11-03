"use client";

import { CalendarDaysIcon } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { studentBookingUrlSchema } from "@/lib/student-booking";

export function StudentBooking({ bookingUrl }: { bookingUrl: string }) {
	const result = studentBookingUrlSchema.safeParse(bookingUrl);
	if (!result.success || !result.data) return null;
	const url = result.data;

	return (
		<Dialog>
			<DialogTrigger asChild>
				<button
					type="button"
					className="flex mx-auto w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-3 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/25 focus-visible:outline-2 focus-visible:outline-indigo-400"
				>
					<CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />
					Book time with your tutor
				</button>
			</DialogTrigger>
			<DialogContent className="flex max-h-[95dvh] flex-col gap-3 p-4 sm:max-w-3xl">
				<DialogHeader className="px-6 text-center sm:text-center">
					<DialogTitle>Book time with your tutor</DialogTitle>
					<DialogDescription>
						Choose an available time. Finish your booking in Calendly below.
					</DialogDescription>
				</DialogHeader>
				<iframe
					title="Tutor booking calendar"
					src={url}
					referrerPolicy="no-referrer"
					className="h-[70dvh] min-h-0 w-full rounded-lg border-0 bg-white"
				/>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					className="text-center text-sm text-indigo-400 underline underline-offset-2"
				>
					Open Calendly in a new tab
				</a>
			</DialogContent>
		</Dialog>
	);
}
