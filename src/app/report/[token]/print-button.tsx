"use client";

export function PrintButton() {
	return (
		<button
			type="button"
			onClick={() => window.print()}
			className="w-full py-3 rounded-2xl bg-white border border-black/5 shadow-sm text-[#86868B] text-sm font-medium hover:bg-[#E8E8ED] hover:text-[#1D1D1F] transition-colors"
		>
			Save as PDF · Print
		</button>
	);
}
