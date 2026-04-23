"use client";

export function PrintButton() {
	return (
		<button
			type="button"
			onClick={() => window.print()}
			className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm font-medium hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
		>
			Save as PDF · Print
		</button>
	);
}
