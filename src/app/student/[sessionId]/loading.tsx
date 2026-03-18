export default function Loading() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f1117]">
			<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1e2230] animate-pulse ring-1 ring-white/10">
				<span className="text-2xl">🐏</span>
			</div>
			<p className="text-sm font-semibold text-slate-400 animate-pulse">Finding your class...</p>
		</div>
	);
}
