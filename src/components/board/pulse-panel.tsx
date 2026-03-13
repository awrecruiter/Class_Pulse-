"use client";

import { ActivityIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

export function PulsePanel() {
	return (
		<div className="flex flex-col items-center justify-center h-full w-full bg-[#0d1525] gap-6">
			<div className="flex flex-col items-center gap-4 text-center max-w-sm">
				<div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
					<ActivityIcon className="h-8 w-8 text-amber-400" />
				</div>
				<div>
					<h2 className="text-lg font-semibold text-slate-200 mb-1">Class Pulse</h2>
					<p className="text-sm text-slate-500 leading-relaxed">
						Live comprehension signals are shown in the Coach cockpit during an active session.
					</p>
				</div>
				<Link
					href="/coach"
					className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/15 text-amber-300 text-sm font-medium hover:bg-amber-500/25 transition-colors"
				>
					<ExternalLinkIcon className="h-4 w-4" />
					Open Coach Cockpit
				</Link>
			</div>
		</div>
	);
}
