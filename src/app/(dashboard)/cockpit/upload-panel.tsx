"use client";

import {
	ChevronDownIcon,
	ChevronUpIcon,
	DownloadIcon,
	FileTextIcon,
	LinkIcon,
	UploadIcon,
	XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type ResourceType = "bell-ringer" | "cfu" | "exit-ticket" | "pacing";
type InputMode = "link" | "file";

const RESOURCE_OPTIONS: { value: ResourceType; label: string }[] = [
	{ value: "bell-ringer", label: "Bell Ringer" },
	{ value: "cfu", label: "CFU Set" },
	{ value: "exit-ticket", label: "Exit Ticket" },
	{ value: "pacing", label: "Pacing Guide" },
];

const ACCEPTED_FILE_TYPES = [
	".pdf",
	".doc",
	".docx",
	".ppt",
	".pptx",
	".xls",
	".xlsx",
	".jpg",
	".jpeg",
	".png",
	".gif",
	".txt",
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"image/jpeg",
	"image/png",
	"image/gif",
	"text/plain",
].join(",");

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

export function UploadPanel({
	classId,
	inline = false,
	onQuestionsReady,
}: {
	classId: string | null;
	inline?: boolean;
	onQuestionsReady?: () => void;
}) {
	const [open, setOpen] = useState(inline);
	const [resourceType, setResourceType] = useState<ResourceType>("bell-ringer");
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

	// Input mode toggle: link paste vs file upload
	const [inputMode, setInputMode] = useState<InputMode>("link");

	// URL-paste state
	const [url, setUrl] = useState("");
	const [savedUrl, setSavedUrl] = useState<string | null>(null);
	const [savedLabel, setSavedLabel] = useState<string>("");
	const [urlSaved, setUrlSaved] = useState(false);

	// File upload state
	const [pickedFile, setPickedFile] = useState<File | null>(null);
	const [fileUploading, setFileUploading] = useState(false);
	const [extracting, setExtracting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// CSV section state
	const [showCsv, setShowCsv] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [result, setResult] = useState<UploadResult | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	// ── Shared: save a resolved URL as a resource record ────────────────────────
	const saveResourceUrl = async (resolvedUrl: string) => {
		const res = await fetch("/api/resources/upload", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ resourceType, date, url: resolvedUrl, classId }),
		});
		const json = await res.json();
		if (!res.ok) {
			toast.error((json as { error?: string }).error ?? "Save failed");
			return;
		}
		toast.success("Resource saved");
		const label = RESOURCE_OPTIONS.find((o) => o.value === resourceType)?.label ?? resourceType;
		setSavedUrl(resolvedUrl);
		setSavedLabel(`${label} — ${date}`);
		setUrlSaved(true);
		setTimeout(() => setUrlSaved(false), 2000);
	};

	// ── URL save ────────────────────────────────────────────────────────────────
	const handleUrlSave = async () => {
		if (!url.trim()) {
			toast.error("Paste a URL first");
			return;
		}
		if (!classId) {
			toast.error("No class selected");
			return;
		}
		setUploading(true);
		try {
			await saveResourceUrl(url.trim());
			setUrl("");
		} catch {
			toast.error("Save failed");
		} finally {
			setUploading(false);
		}
	};

	// ── File upload (presigned S3 PUT — bypasses Vercel payload limit) ──────────
	const handleFileUpload = async () => {
		if (!pickedFile) {
			toast.error("Select a file first");
			return;
		}
		if (!classId) {
			toast.error("No class selected");
			return;
		}
		setFileUploading(true);
		try {
			// 1. Get a short-lived presigned PUT URL from our API
			const params = new URLSearchParams({ filename: pickedFile.name });
			const presignRes = await fetch(`/api/resources/pdf/presign?${params}`);
			const presignJson = await presignRes.json();
			if (!presignRes.ok) {
				toast.error((presignJson as { error?: string }).error ?? "Could not get upload URL");
				return;
			}
			const { presignedUrl, objectUrl } = presignJson as {
				presignedUrl: string;
				objectUrl: string;
			};

			// 2. PUT file directly to S3 — never touches the Next.js server
			const uploadRes = await fetch(presignedUrl, {
				method: "PUT",
				body: pickedFile,
				headers: { "Content-Type": pickedFile.type || "application/octet-stream" },
			});
			if (!uploadRes.ok) {
				toast.error("Storage upload failed — check S3 CORS settings");
				return;
			}

			// 3. Save the public S3 URL as a lesson resource record
			await saveResourceUrl(objectUrl);

			setPickedFile(null);
			if (fileInputRef.current) fileInputRef.current.value = "";

			// 4. Await question extraction (only for PDFs, skip pacing guides)
			const isPdf = pickedFile.name.toLowerCase().endsWith(".pdf");
			if (isPdf && resourceType !== "pacing") {
				setFileUploading(false);
				setExtracting(true);
				try {
					const extractRes = await fetch("/api/questions/extract", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							url: objectUrl,
							filename: pickedFile.name,
							resourceType,
							startDate: date,
						}),
					});
					if (extractRes.ok) {
						onQuestionsReady?.();
					} else {
						const errJson = await extractRes.json().catch(() => ({}));
						toast.error((errJson as { error?: string }).error ?? "Extraction failed");
					}
				} catch {
					toast.error("Question extraction failed — check console");
				} finally {
					setExtracting(false);
				}
				return;
			}
		} catch {
			toast.error("Upload failed");
		} finally {
			setFileUploading(false);
		}
	};

	// ── CSV upload ───────────────────────────────────────────────────────────────
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
			if (fileRef.current) fileRef.current.value = "";
		} catch {
			toast.error("Upload failed");
		} finally {
			setUploading(false);
		}
	};

	const isBusy = uploading || fileUploading || extracting;

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
				<div className="border-t border-slate-700 px-5 py-4 space-y-3">
					{/* ── Resource Type + Date row ── */}
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
					</div>

					{/* ── Link / File mode toggle ── */}
					<div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg w-fit border border-slate-700">
						<button
							type="button"
							onClick={() => setInputMode("link")}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
								inputMode === "link"
									? "bg-indigo-600 text-white"
									: "text-slate-400 hover:text-slate-200"
							}`}
						>
							<LinkIcon className="h-3 w-3" />
							Link
						</button>
						<button
							type="button"
							onClick={() => setInputMode("file")}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
								inputMode === "file"
									? "bg-indigo-600 text-white"
									: "text-slate-400 hover:text-slate-200"
							}`}
						>
							<FileTextIcon className="h-3 w-3" />
							File
						</button>
					</div>

					{/* ── Link mode: URL paste + Save ── */}
					{inputMode === "link" && (
						<div className="flex flex-wrap gap-3 items-end">
							<div className="flex flex-col gap-1 flex-1 min-w-48">
								<label className="text-xs text-slate-400 font-medium" htmlFor="resource-url">
									Link
								</label>
								<input
									id="resource-url"
									type="url"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleUrlSave();
									}}
									placeholder="Paste Google Slides, OneDrive, or PDF link..."
									className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
								/>
							</div>

							<button
								type="button"
								onClick={handleUrlSave}
								disabled={isBusy}
								className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
									urlSaved
										? "bg-emerald-600 text-white"
										: "bg-indigo-600 hover:bg-indigo-500 text-white"
								}`}
							>
								<LinkIcon className="h-3.5 w-3.5" />
								{urlSaved ? "Saved!" : uploading ? "Saving…" : "Save"}
							</button>
						</div>
					)}

					{/* ── File mode: file picker + Upload button ── */}
					{inputMode === "file" && (
						<div className="flex flex-wrap gap-3 items-end">
							<div className="flex flex-col gap-1 flex-1 min-w-48">
								<label className="text-xs text-slate-400 font-medium" htmlFor="resource-file">
									File
									<span className="ml-1.5 text-slate-600 font-normal">
										PDF, Word, PowerPoint, Excel, image — max 10 MB
									</span>
								</label>
								<input
									id="resource-file"
									ref={fileInputRef}
									type="file"
									accept={ACCEPTED_FILE_TYPES}
									onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
									className="text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-500/20 file:text-indigo-300 hover:file:bg-indigo-500/30 file:cursor-pointer"
								/>
							</div>

							<button
								type="button"
								onClick={handleFileUpload}
								disabled={isBusy || !pickedFile}
								className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
									urlSaved
										? "bg-emerald-600 text-white"
										: "bg-indigo-600 hover:bg-indigo-500 text-white"
								}`}
							>
								<FileTextIcon className="h-3.5 w-3.5" />
								{urlSaved
									? "Saved!"
									: extracting
										? "Extracting…"
										: fileUploading
											? "Uploading…"
											: inline
												? "Save"
												: "Upload File"}
							</button>
						</div>
					)}

					{/* Saved URL chip — shown for both link and file modes */}
					{savedUrl && (
						<div className="flex items-center gap-2">
							<a
								href={savedUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-600/50 bg-indigo-500/10 text-xs text-indigo-300 hover:text-indigo-200 hover:border-indigo-500 transition-colors truncate max-w-sm"
							>
								<LinkIcon className="h-3 w-3 shrink-0" />
								{savedLabel}
							</a>
							<button
								type="button"
								onClick={() => {
									setSavedUrl(null);
									setSavedLabel("");
								}}
								className="p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
								aria-label="Clear saved link"
							>
								<XIcon className="h-3.5 w-3.5" />
							</button>
						</div>
					)}

					{/* ── CSV section toggle ── */}
					<button
						type="button"
						onClick={() => setShowCsv((v) => !v)}
						className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 self-start transition-colors"
					>
						{showCsv ? "Hide CSV import" : "Show CSV import"}
					</button>

					{/* ── CSV controls (collapsed by default) ── */}
					{showCsv && (
						<div className="space-y-3 pt-1 border-t border-slate-700/60">
							{/* Controls row */}
							<div className="flex flex-wrap gap-3 items-end pt-3">
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
									disabled={isBusy}
									className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
								>
									<UploadIcon className="h-3.5 w-3.5" />
									{uploading ? "Uploading…" : "Import CSV"}
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
												<li
													key={`${err.row}-${err.field}-${i}`}
													className="flex items-start gap-1.5"
												>
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
			)}
		</div>
	);
}
