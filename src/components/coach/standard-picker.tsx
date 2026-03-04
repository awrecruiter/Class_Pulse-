"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { FL_BEST_STANDARDS } from "@/data/fl-best-standards";

const GRADES = [3, 4, 5] as const;

const STRANDS = [
	{ code: "NSO", label: "Numbers" },
	{ code: "FR", label: "Fractions" },
	{ code: "AR", label: "Algebra" },
	{ code: "M", label: "Measure" },
	{ code: "GR", label: "Geometry" },
	{ code: "DP", label: "Data" },
] as const;

type StandardPickerProps = {
	value: string[];
	onChange: (codes: string[]) => void;
};

export function StandardPicker({ value, onChange }: StandardPickerProps) {
	const [open, setOpen] = useState(false);
	const [gradeFilter, setGradeFilter] = useState<number | null>(null);
	const [strandFilter, setStrandFilter] = useState<string | null>(null);

	const filtered = FL_BEST_STANDARDS.filter((b) => {
		if (gradeFilter !== null && b.grade !== gradeFilter) return false;
		if (strandFilter !== null && b.strand !== strandFilter) return false;
		return true;
	});

	function toggle(code: string) {
		if (value.includes(code)) {
			onChange(value.filter((c) => c !== code));
		} else {
			onChange([...value, code]);
		}
	}

	function removeOne(code: string, e: React.MouseEvent) {
		e.stopPropagation();
		onChange(value.filter((c) => c !== code));
	}

	function clearAll(e: React.MouseEvent) {
		e.stopPropagation();
		onChange([]);
	}

	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-sm font-medium text-foreground">Today&apos;s standard(s)</span>

			{/* Trigger */}
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
					open ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/50"
				}`}
			>
				{value.length > 0 ? (
					<span className="flex flex-wrap gap-1 min-w-0">
						{value.map((code) => (
							<span
								key={code}
								className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary"
							>
								{code}
								{/* biome-ignore lint/a11y/useSemanticElements: nested inside <button>; cannot nest <button> */}
								<span
									onClick={(e) => removeOne(code, e)}
									onKeyDown={(e) =>
										e.key === "Enter" && removeOne(code, e as unknown as React.MouseEvent)
									}
									role="button"
									tabIndex={0}
									className="hover:text-destructive"
								>
									<XIcon className="h-3 w-3" />
								</span>
							</span>
						))}
					</span>
				) : (
					<span className="text-muted-foreground">Pick standard(s) being taught…</span>
				)}
				<span className="flex items-center gap-1 shrink-0 pt-0.5">
					{value.length > 0 && (
						// biome-ignore lint/a11y/useSemanticElements: nested inside <button>; cannot nest <button>
						<span
							onClick={clearAll}
							onKeyDown={(e) => e.key === "Enter" && clearAll(e as unknown as React.MouseEvent)}
							role="button"
							tabIndex={0}
							className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
						>
							<XIcon className="h-3.5 w-3.5" />
						</span>
					)}
					<ChevronDownIcon
						className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
					/>
				</span>
			</button>

			{/* Picker panel */}
			{open && (
				<div className="rounded-lg border border-border bg-card shadow-md overflow-hidden">
					{/* Grade filter */}
					<div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
						<span className="text-xs font-medium text-muted-foreground w-10 shrink-0">Grade</span>
						<div className="flex gap-1">
							{GRADES.map((g) => (
								<button
									key={g}
									type="button"
									onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
									className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
										gradeFilter === g
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
									}`}
								>
									{g}
								</button>
							))}
						</div>
					</div>

					{/* Strand filter */}
					<div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
						<span className="text-xs font-medium text-muted-foreground w-10 shrink-0">Topic</span>
						<div className="flex flex-wrap gap-1">
							{STRANDS.map((s) => (
								<button
									key={s.code}
									type="button"
									onClick={() => setStrandFilter(strandFilter === s.code ? null : s.code)}
									className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
										strandFilter === s.code
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
									}`}
								>
									{s.label}
								</button>
							))}
						</div>
					</div>

					{/* Results list */}
					<ul className="max-h-56 overflow-y-auto divide-y divide-border">
						{filtered.length === 0 ? (
							<li className="px-3 py-4 text-sm text-center text-muted-foreground">
								No standards match
							</li>
						) : (
							filtered.map((b) => {
								const checked = value.includes(b.code);
								return (
									<li key={b.code}>
										<button
											type="button"
											onClick={() => toggle(b.code)}
											className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors ${
												checked ? "bg-primary/8 hover:bg-primary/12" : "hover:bg-muted/60"
											}`}
										>
											{/* Checkbox */}
											<span
												className={`mt-0.5 shrink-0 flex h-4 w-4 items-center justify-center rounded border transition-colors ${
													checked
														? "border-primary bg-primary text-primary-foreground"
														: "border-border bg-background"
												}`}
											>
												{checked && (
													<svg
														viewBox="0 0 10 8"
														className="h-2.5 w-2.5 fill-current"
														aria-hidden="true"
													>
														<path
															d="M1 4l3 3 5-6"
															stroke="currentColor"
															strokeWidth="1.5"
															fill="none"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
													</svg>
												)}
											</span>
											<span className="min-w-0">
												<span className="flex items-baseline gap-2">
													<span className="font-mono text-xs font-bold text-primary">{b.code}</span>
													<span className="text-xs text-muted-foreground">Gr {b.grade}</span>
												</span>
												<p className="text-sm text-foreground leading-snug mt-0.5 line-clamp-2">
													{b.description}
												</p>
											</span>
										</button>
									</li>
								);
							})
						)}
					</ul>

					{/* Footer */}
					<div className="border-t border-border px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
						<span>
							{filtered.length} standard{filtered.length !== 1 ? "s" : ""}
							{(gradeFilter !== null || strandFilter !== null) && " shown"}
						</span>
						{value.length > 0 && (
							<span className="font-medium text-primary">{value.length} selected</span>
						)}
					</div>
				</div>
			)}

			{/* Selected descriptions */}
			{value.length > 0 && !open && (
				<div className="flex flex-col gap-1">
					{value.map((code) => {
						const b = FL_BEST_STANDARDS.find((s) => s.code === code);
						return b ? (
							<p key={code} className="text-xs text-muted-foreground leading-relaxed px-0.5">
								<span className="font-mono font-semibold text-primary">{b.code}</span>{" "}
								{b.description}
							</p>
						) : null;
					})}
				</div>
			)}
		</div>
	);
}
