"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
	title,
	icon,
	children,
	defaultOpen = false,
}: {
	title: React.ReactNode;
	icon?: React.ReactNode;
	children: React.ReactNode;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<section className="rounded-xl border border-slate-700 bg-slate-800/60">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between px-5 py-4 text-left"
			>
				<h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
					{icon}
					{title}
				</h2>
				<ChevronDownIcon
					className={cn(
						"h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && <div className="px-5 pb-5">{children}</div>}
		</section>
	);
}
