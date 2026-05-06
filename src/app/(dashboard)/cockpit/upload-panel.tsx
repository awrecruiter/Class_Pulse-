"use client";

import { ChevronDownIcon, ChevronUpIcon, DownloadIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type ResourceType = "bell-ringer" | "cfu" | "exit-ticket" | "pacing";

const RESOURCE_OPTIONS: { value: ResourceType; label: string }[] = [
	{ value: "bell-ringer", label: "Bell Ringers" },
	{ value: "cfu", label: "CFU Set" },
	{ value: "exit-ticket", label: "Exit Tickets" },
	{ value: "pacing", label: "Pacing Guide" },
];

interface UploadResult {
	status: "success" | "partial_success" | "error";
	resourceType: string;
	totalRows: number;
	importedRows: number;
	errors: Array<{
		row: number;
		field: string;
		value: string;
		message: string;
		critical: boolean;
	}>;
}

export function UploadPanel({ classId }: { classId: string | null }) {
	const [open, setOpen] = useState(false);
	const [resourceType, setResourceType] = useState<ResourceType>("bell-ringer");
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [uploading, setUploading] = useState(false);
	const [result, setResult] = useState<UploadResult | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const handleUpload = async () => {
		const file = fileRef.current?.files?.[0];
		if (!file) {
			toast.error("Select a CSV file first");
			return;
		}
		if (!classId) {
			toast.error("No class selected");
			return;
		}

		setUploading(true);
		setResult(null);
		try {
			const form = new FormData();
			form.append("file", file);
			form.append("resourceType", resourceType);
			form.append("classId", classId);
			form.append("date", date);

			const res = await fetch("/api/resources/upload", { method: "POST", body: form });
			const json: UploadResult = await res.json();
			setResult(json);

			if (json.status === "success") {
				toast.success(`Imported ${json.importedRows} rows`);
			} else if (json.status === "partial_success") {
				toast.warning(`Imported ${json.importedRows}/${json.totalRows} rows — check errors below`);
			} else {
				toast.error("Import failed — no rows could be imported");
			}
			// Reset file input
			if (fileRef.current) fileRef.current.value = "";
		} catch {
			toast.error("Upload failed");
		} finally {
			setUploading(false);
		}
	};

	return (
		<div
			id="upload-panel"
			className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden"
		>
			{/* Header — always visible toggle */}
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
			>
				<div className="flex items-center gap-2.5">
					<UploadIcon className="h-4 w-4 text-indigo-400" />
					<span className="font-semibold text-slate-200 text-sm">Upload Resources</span>
					<span className="text-xs text-slate-500">
						Bell Ringers · CFU Sets · Exit Tickets · Pacing Guide
					</span>
				</div>
				{open ? (
					<ChevronUpIcon className="h-4 w-4 text-slate-500" />
				) : (
					<ChevronDownIcon className="h-4 w-4 text-slate-500" />
				)}
			</button>

			{/* Collapsible body */}
			{open && (
				<div className="border-t border-slate-700 px-5 py-4 space-y-4">
					{/* Controls row */}
					<div className="flex flex-wrap gap-3 items-end">
						{/* Resource type */}
						<div className="flex flex-col gap-1">
							<label className="text-xs text-slate-400 font-medium" htmlFor="resource-type-select">
								Resource Type
							</label>
							<select
								id="resource-type-select"
								value={resourceType}
								onChange={(e) => setResourceType(e.target.value as ResourceType)}
								className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
							>
								{RESOURCE_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</div>

						{/* Date */}
						<div className="flex flex-col gap-1">
							<label className="text-xs text-slate-400 font-medium" htmlFor="import-date">
								Date
							</label>
							<input
								id="import-date"
								type="date"
								value={date}
								onChange={(e) => setDate(e.target.value)}
								className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
							/>
						</div>

						{/* File picker */}
						<div className="flex flex-col gap-1">
							<label className="text-xs text-slate-400 font-medium" htmlFor="csv-file">
								CSV File
							</label>
							<input
								id="csv-file"
								ref={fileRef}
								type="file"
								accept=".csv,text/csv"
								className="text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-500/20 file:text-indigo-300 hover:file:bg-indigo-500/30 file:cursor-pointer"
							/>
						</div>

						<button
							type="button"
							onClick={handleUpload}
							disabled={uploading}
							className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
						>
							<UploadIcon className="h-3.5 w-3.5" />
							{uploading ? "Uploading…" : "Import"}
						</button>
					</div>

					{/* Template downloads */}
					<div className="flex flex-wrap gap-2">
						<span className="text-xs text-slate-500 self-center">Download template:</span>
						{RESOURCE_OPTIONS.map((o) => (
							<a
								key={o.value}
								href={`/api/resources/templates/${o.value}`}
								download
								className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-600 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
							>
								<DownloadIcon className="h-3 w-3" />
								{o.label}
							</a>
						))}
					</div>

					{/* Results */}
					{result && (
						<div
							className={`rounded-lg border px-4 py-3 text-sm space-y-2 ${
								result.status === "success"
									? "border-emerald-700 bg-emerald-900/20"
									: result.status === "partial_success"
										? "border-yellow-700 bg-yellow-900/20"
										: "border-red-700 bg-red-900/20"
							}`}
						>
							<p className="font-medium text-slate-200">
								{result.status === "success"
									? `All ${result.importedRows} rows imported successfully`
									: result.status === "partial_success"
										? `${result.importedRows} of ${result.totalRows} rows imported`
										: `Import failed — ${result.totalRows} rows, 0 imported`}
							</p>
							{result.errors.length > 0 && (
								<ul className="space-y-1 text-xs text-slate-400">
									{result.errors.map((err, i) => (
										<li key={`${err.row}-${err.field}-${i}`} className="flex items-start gap-1.5">
											<span
												className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${err.critical ? "bg-red-400" : "bg-yellow-400"}`}
											/>
											<span>
												Row {err.row} · <span className="text-slate-300">{err.field}</span>
												{err.value ? ` "${err.value}"` : ""} — {err.message}
											</span>
										</li>
									))}
								</ul>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
