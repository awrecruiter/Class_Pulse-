import { ExternalLinkIcon, FolderOpenIcon } from "lucide-react";

const RESOURCE_TYPES = [
	{ key: "bell-ringer", label: "Bell Ringer" },
	{ key: "cfu", label: "CFU Set" },
	{ key: "exit-ticket", label: "Exit Ticket" },
	{ key: "pacing", label: "Pacing Guide" },
] as const;

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Color config per resource type
const COLORS: Record<string, { bg: string; text: string; ring: string }> = {
	"bell-ringer": { bg: "bg-amber-500/15", text: "text-amber-300", ring: "ring-amber-500/40" },
	cfu: { bg: "bg-blue-500/15", text: "text-blue-300", ring: "ring-blue-500/40" },
	"exit-ticket": { bg: "bg-violet-500/15", text: "text-violet-300", ring: "ring-violet-500/40" },
	pacing: { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-500/40" },
};

type ResourceRow = {
	importDate: string;
	resourceType: string;
	url: string;
};

export function getWeekDates(today: string): string[] {
	const date = new Date(`${today}T12:00:00Z`);
	const day = date.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
	const monday = new Date(date);
	monday.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
	return Array.from({ length: 5 }, (_, i) => {
		const d = new Date(monday);
		d.setUTCDate(monday.getUTCDate() + i);
		return d.toISOString().slice(0, 10);
	});
}

export function WeeklyResourcesPanel({
	today,
	weekDates,
	resources,
}: {
	today: string;
	weekDates: string[];
	resources: ResourceRow[];
}) {
	// Build lookup: date → resourceType → { url }
	const lookup: Record<string, Record<string, { url: string }>> = {};
	for (const r of resources) {
		if (!lookup[r.importDate]) lookup[r.importDate] = {};
		lookup[r.importDate][r.resourceType] = { url: r.url };
	}

	// Count how many resource types are loaded this week
	const totalLoaded = resources.length;

	return (
		<section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
					<FolderOpenIcon className="h-4 w-4 text-slate-500" />
					This Week&apos;s Resources
				</h2>
				<span className="text-xs text-slate-500">
					{totalLoaded} of {weekDates.length * RESOURCE_TYPES.length} loaded
				</span>
			</div>

			<div className="overflow-x-auto -mx-1">
				<table className="w-full min-w-[420px] border-collapse">
					<thead>
						<tr>
							{/* Empty top-left cell */}
							<th className="pb-2 pr-3 text-left w-28" />
							{weekDates.map((d, i) => {
								const isToday = d === today;
								const mmdd = d.slice(5).replace("-", "/");
								return (
									<th key={d} className="pb-2 text-center">
										<div
											className={`inline-flex flex-col items-center rounded-lg px-2 py-1 ${
												isToday ? "bg-indigo-600/20 ring-1 ring-indigo-500/40" : ""
											}`}
										>
											<span
												className={`text-[10px] font-bold uppercase tracking-wider ${
													isToday ? "text-indigo-300" : "text-slate-500"
												}`}
											>
												{DAY_SHORT[i]}
											</span>
											<span
												className={`text-[10px] font-mono ${
													isToday ? "text-indigo-400" : "text-slate-600"
												}`}
											>
												{mmdd}
											</span>
										</div>
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-800">
						{RESOURCE_TYPES.map(({ key, label }) => {
							const colors = COLORS[key];
							return (
								<tr key={key} className="group">
									<td className="py-2 pr-3 text-xs font-medium text-slate-400 whitespace-nowrap">
										{label}
									</td>
									{weekDates.map((d) => {
										const isToday = d === today;
										const found = lookup[d]?.[key];
										return (
											<td key={d} className="py-2 text-center">
												{found ? (
													found.url ? (
														<a
															href={found.url}
															target="_blank"
															rel="noopener noreferrer"
															className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ring-1 transition-opacity hover:opacity-80 ${colors?.bg ?? ""} ${colors?.text ?? ""} ${colors?.ring ?? ""} ${isToday ? "ring-2" : ""}`}
															title={`Open ${label}`}
														>
															✓
															<ExternalLinkIcon className="h-2.5 w-2.5 opacity-70" />
														</a>
													) : (
														// CSV data loaded but no file URL
														<span
															className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold ring-1 ${colors?.bg ?? ""} ${colors?.text ?? ""} ${colors?.ring ?? ""}`}
														>
															✓
														</span>
													)
												) : (
													<span className="text-slate-700 text-sm select-none">–</span>
												)}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</section>
	);
}
