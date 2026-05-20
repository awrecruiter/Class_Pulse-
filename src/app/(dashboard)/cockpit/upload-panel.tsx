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

type PendingUpload =
	| { kind: "url"; url: string }
	| { kind: "file"; objectUrl: string; filename: string; isPdf: boolean };

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
	const pdfBufferRef = useRef<ArrayBuffer | null>(null);

	// CSV section state
	const [showCsv, setShowCsv] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [result, setResult] = useState<UploadResult | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	// Scope prompt — set after URL paste or after S3 upload completes
	const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);

	// Page rendering state
	const [pageImages, setPageImages] = useState<{ page: number; imageUrl: string }[]>([]);
	const [renderingPages, setRenderingPages] = useState(false);
	const [renderProgress, setRenderProgress] = useState(0);
	const [totalPages, setTotalPages] = useState(0);
	const [readyForAction, setReadyForAction] = useState(false);
	const [savedObjectUrl, setSavedObjectUrl] = useState<string | null>(null);
	const [savedFilename, setSavedFilename] = useState<string>("");
	const [creatingFromPages, setCreatingFromPages] = useState(false);
	const [patchingImages, setPatchingImages] = useState(false);
	const [hasExistingQuestions, setHasExistingQuestions] = useState(false);

	const isBusy =
		uploading ||
		fileUploading ||
		extracting ||
		renderingPages ||
		creatingFromPages ||
		patchingImages;

	// ── Shared: save a resolved URL as a resource record ────────────────────────
	const saveResourceUrl = async (resolvedUrl: string, scopeClassId: string) => {
		const res = await fetch("/api/resources/upload", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ resourceType, date, url: resolvedUrl, classId: scopeClassId }),
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

	// ── URL save: stage URL then show scope prompt ───────────────────────────────
	const handleUrlSave = () => {
		if (!url.trim()) {
			toast.error("Paste a URL first");
			return;
		}
		if (!classId) {
			toast.error("No class selected");
			return;
		}
		setPendingUpload({ kind: "url", url: url.trim() });
		setUrl("");
	};

	// ── File upload: presign on server → PUT directly from browser to S3 ────────
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

		const isPdf = pickedFile.name.toLowerCase().endsWith(".pdf");
		const pdfBytes = isPdf ? await pickedFile.arrayBuffer().catch(() => null) : null;

		try {
			const presignRes = await fetch(
				`/api/resources/pdf/presign?filename=${encodeURIComponent(pickedFile.name)}`,
			);
			const presignJson = await presignRes.json().catch(() => ({}));
			if (!presignRes.ok) {
				toast.error((presignJson as { error?: string }).error ?? "Upload failed");
				return;
			}
			const { presignedUrl, objectUrl } = presignJson as {
				presignedUrl: string;
				objectUrl: string;
			};

			const putRes = await fetch(presignedUrl, {
				method: "PUT",
				body: pickedFile,
				headers: { "Content-Type": pickedFile.type || "application/octet-stream" },
			});
			if (!putRes.ok) {
				toast.error("Storage upload failed — S3 CORS may not be configured");
				return;
			}

			if (isPdf) pdfBufferRef.current = pdfBytes;
			setPendingUpload({ kind: "file", objectUrl, filename: pickedFile.name, isPdf });
			setPickedFile(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		} catch {
			toast.error("Upload failed");
		} finally {
			setFileUploading(false);
		}
	};

	// ── Render PDF pages to images ───────────────────────────────────────────────
	async function renderPagesToImages(
		pdfBuffer: ArrayBuffer,
		filename: string,
	): Promise<{ page: number; imageUrl: string }[]> {
		const pdfjsLib = await import("pdfjs-dist");
		pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

		const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
		const numPages = pdf.numPages;
		setTotalPages(numPages);

		const results: { page: number; imageUrl: string }[] = [];

		for (let pageNum = 1; pageNum <= numPages; pageNum++) {
			setRenderProgress(pageNum);
			try {
				const page = await pdf.getPage(pageNum);
				const viewport = page.getViewport({ scale: 2.0 });

				const canvas = document.createElement("canvas");
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				const ctx = canvas.getContext("2d");
				if (!ctx) continue;

				ctx.fillStyle = "#ffffff";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				await page.render({ canvasContext: ctx, viewport, canvas }).promise;

				const blob = await new Promise<Blob | null>((resolve) =>
					canvas.toBlob(resolve, "image/jpeg", 0.9),
				);
				if (!blob) continue;

				const pageFilename = `${filename.replace(/\.pdf$/i, "")}-p${pageNum}.jpg`;
				const presignRes = await fetch(
					`/api/resources/pdf/presign?filename=${encodeURIComponent(pageFilename)}`,
				);
				if (!presignRes.ok) continue;
				const { presignedUrl, objectUrl } = (await presignRes.json()) as {
					presignedUrl: string;
					objectUrl: string;
				};
				const putRes = await fetch(presignedUrl, {
					method: "PUT",
					body: blob,
					headers: { "Content-Type": "image/jpeg" },
				});
				if (!putRes.ok) continue;

				results.push({ page: pageNum, imageUrl: objectUrl });
			} catch {
				// skip page on error
			}
		}

		return results;
	}

	// ── Extract questions with AI ────────────────────────────────────────────────
	async function handleExtractWithAI() {
		if (!savedObjectUrl || !savedFilename) return;
		setExtracting(true);
		try {
			const extractRes = await fetch("/api/questions/extract", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: savedObjectUrl,
					filename: savedFilename,
					resourceType,
					startDate: date,
					pageImages,
				}),
			});
			if (extractRes.ok) {
				setReadyForAction(false);
				setSavedObjectUrl(null);
				setSavedFilename("");
				setPageImages([]);
				onQuestionsReady?.();
			} else {
				const errJson = await extractRes.json().catch(() => ({}));
				toast.error((errJson as { error?: string }).error ?? "Extraction failed");
			}
		} catch {
			toast.error("Question extraction failed");
		} finally {
			setExtracting(false);
		}
	}

	// ── Patch imageUrl onto existing questions for this filename ────────────────
	async function handlePatchImages() {
		if (pageImages.length === 0 || !savedFilename) return;
		setPatchingImages(true);
		try {
			const res = await fetch("/api/questions/patch-images", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ filename: savedFilename, pageImages }),
			});
			const json = await res.json().catch(() => ({}));
			if (res.ok) {
				const count = (json as { updated?: number }).updated ?? 0;
				toast.success(
					count > 0 ? `Images added to ${count} questions` : "No matching questions found",
				);
				setReadyForAction(false);
				setSavedObjectUrl(null);
				setSavedFilename("");
				setPageImages([]);
				setHasExistingQuestions(false);
				onQuestionsReady?.();
			} else {
				toast.error((json as { error?: string }).error ?? "Failed to patch images");
			}
		} catch {
			toast.error("Failed to patch images");
		} finally {
			setPatchingImages(false);
		}
	}

	// ── Create one question per page (no AI) ────────────────────────────────────
	async function handleCreateFromPages() {
		if (pageImages.length === 0 || !savedObjectUrl || !savedFilename) return;
		setCreatingFromPages(true);
		try {
			const res = await fetch("/api/questions/from-pages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pageImages,
					sourceUrl: savedObjectUrl,
					filename: savedFilename,
					resourceType,
					startDate: date,
					replace: hasExistingQuestions,
				}),
			});
			if (res.ok) {
				setReadyForAction(false);
				setSavedObjectUrl(null);
				setSavedFilename("");
				setPageImages([]);
				onQuestionsReady?.();
				toast.success(
					`Added ${pageImages.length} question${pageImages.length !== 1 ? "s" : ""} from pages`,
				);
			} else {
				const errJson = await res.json().catch(() => ({}));
				toast.error(
					(errJson as { error?: string }).error ?? "Failed to create questions from pages",
				);
			}
		} catch {
			toast.error("Failed to create questions from pages");
		} finally {
			setCreatingFromPages(false);
		}
	}

	// ── Scope choice: fires after teacher picks "this class" or "all classes" ───
	const handleScopeChoice = async (scopeClassId: string) => {
		const upload = pendingUpload;
		if (!upload) return;
		setPendingUpload(null);

		if (upload.kind === "url") {
			setUploading(true);
			try {
				await saveResourceUrl(upload.url, scopeClassId);
			} catch {
				toast.error("Save failed");
			} finally {
				setUploading(false);
			}
		} else if (upload.kind === "file") {
			setUploading(true);
			try {
				await saveResourceUrl(upload.objectUrl, scopeClassId);
			} catch {
				toast.error("Save failed");
			} finally {
				setUploading(false);
			}

			// For PDFs (not pacing): render pages then show action buttons
			if (upload.isPdf && resourceType !== "pacing") {
				setSavedObjectUrl(upload.objectUrl);
				setSavedFilename(upload.filename);
				setRenderingPages(true);
				setRenderProgress(0);
				setTotalPages(0);
				setReadyForAction(false);
				const buf = pdfBufferRef.current;
				pdfBufferRef.current = null;
				try {
					const images = buf ? await renderPagesToImages(buf, upload.filename) : [];
					setPageImages(images);
					if (!buf) toast.info("Page capture skipped — browser buffer unavailable");

					// Check if questions for this filename already exist in the bank
					if (images.length > 0) {
						const checkRes = await fetch(
							`/api/questions?filename=${encodeURIComponent(upload.filename)}`,
						).catch(() => null);
						if (checkRes?.ok) {
							const checkJson = await checkRes.json().catch(() => ({ questions: [] }));
							const existing = (checkJson as { questions: { id: string }[] }).questions ?? [];
							setHasExistingQuestions(existing.length > 0);
						}
					}
				} catch {
					toast.error("Page capture failed — you can still extract questions");
					setPageImages([]);
				} finally {
					setRenderingPages(false);
					setReadyForAction(true);
				}
			}
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
								disabled={isBusy || !!pendingUpload}
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
								disabled={isBusy || !pickedFile || !!pendingUpload}
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

					{/* ── Scope prompt — appears after URL paste or file S3 upload ── */}
					{pendingUpload && (
						<div className="rounded-lg border border-amber-600/40 bg-amber-900/20 px-4 py-3 space-y-2.5">
							<p className="text-xs font-medium text-amber-300">Apply this resource to:</p>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => handleScopeChoice(classId ?? "")}
									className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
								>
									This class only
								</button>
								<button
									type="button"
									onClick={() => handleScopeChoice("")}
									className="flex-1 px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
								>
									All classes
								</button>
								<button
									type="button"
									onClick={() => setPendingUpload(null)}
									className="p-2 rounded-lg border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
									aria-label="Cancel"
								>
									<XIcon className="h-3.5 w-3.5" />
								</button>
							</div>
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

					{/* Page rendering progress */}
					{renderingPages && (
						<div className="flex items-center gap-2 text-xs text-slate-400">
							<div className="h-3 w-3 rounded-full border border-slate-600 border-t-slate-300 animate-spin" />
							{totalPages > 0
								? `Capturing page ${renderProgress} of ${totalPages}…`
								: "Capturing pages…"}
						</div>
					)}

					{/* Action buttons — shown after page capture completes */}
					{readyForAction && !renderingPages && (
						<div className="rounded-lg border border-indigo-600/40 bg-indigo-900/20 px-4 py-3 space-y-2.5">
							<p className="text-xs font-medium text-indigo-300">
								{pageImages.length > 0
									? `${pageImages.length} page${pageImages.length !== 1 ? "s" : ""} captured${hasExistingQuestions ? " — existing questions detected:" : " — add questions to the bank:"}`
									: "PDF saved — add questions to the bank:"}
							</p>
							<div className="flex gap-2 flex-wrap">
								{hasExistingQuestions && pageImages.length > 0 ? (
									<>
										<button
											type="button"
											onClick={handlePatchImages}
											disabled={isBusy}
											className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
										>
											{patchingImages ? "Adding images…" : "Add images to existing"}
										</button>
										<button
											type="button"
											onClick={handleCreateFromPages}
											disabled={isBusy}
											className="flex-1 px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
										>
											{creatingFromPages ? "Replacing…" : "Replace with pages"}
										</button>
									</>
								) : (
									<>
										<button
											type="button"
											onClick={handleExtractWithAI}
											disabled={isBusy}
											className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
										>
											{extracting ? "Extracting…" : "Extract with AI"}
										</button>
										{pageImages.length > 0 && (
											<button
												type="button"
												onClick={handleCreateFromPages}
												disabled={isBusy}
												className="flex-1 px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
											>
												{creatingFromPages ? "Creating…" : "Create from pages"}
											</button>
										)}
									</>
								)}
								<button
									type="button"
									onClick={() => {
										setReadyForAction(false);
										setSavedObjectUrl(null);
										setSavedFilename("");
										setPageImages([]);
										setHasExistingQuestions(false);
									}}
									className="p-2 rounded-lg border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
									aria-label="Skip"
									title="Skip — don't add questions now"
								>
									<XIcon className="h-3.5 w-3.5" />
								</button>
							</div>
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
