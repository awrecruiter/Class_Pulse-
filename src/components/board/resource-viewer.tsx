"use client";

import { FileIcon, FolderOpenIcon, LinkIcon, UploadIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface RecentResource {
	url: string;
	label: string;
	ts: number;
}

const STORAGE_KEY = "board-recent-resources";
const MAX_RECENT = 6;

function toEmbedUrl(raw: string): string {
	const url = raw.trim();

	// Google Drive file — /view or /edit → /preview
	const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
	if (driveFile) return `https://drive.google.com/file/d/${driveFile[1]}/preview`;

	// Google Slides — /edit or /present → /embed
	const slides = url.match(/docs\.google\.com\/presentation\/d\/([^/?#]+)/);
	if (slides)
		return `https://docs.google.com/presentation/d/${slides[1]}/embed?start=false&loop=false&delayms=5000`;

	// Google Docs — /edit → /preview
	const docs = url.match(/docs\.google\.com\/document\/d\/([^/?#]+)/);
	if (docs) return `https://docs.google.com/document/d/${docs[1]}/preview`;

	// Google Sheets — /edit → /preview
	const sheets = url.match(/docs\.google\.com\/spreadsheets\/d\/([^/?#]+)/);
	if (sheets) return `https://docs.google.com/spreadsheets/d/${sheets[1]}/preview`;

	// OneDrive short link or share URL — pass through (embed usually works)
	return url;
}

function labelFromUrl(url: string): string {
	try {
		const u = new URL(url);
		const parts = u.pathname.split("/").filter(Boolean);
		return parts[parts.length - 1]?.slice(0, 32) || u.hostname;
	} catch {
		return url.slice(0, 32);
	}
}

function loadRecents(): RecentResource[] {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
	} catch {
		return [];
	}
}

function saveRecents(items: RecentResource[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
	} catch {}
}

export function ResourceViewer() {
	const [input, setInput] = useState("");
	const [activeUrl, setActiveUrl] = useState<string | null>(null);
	const [recents, setRecents] = useState<RecentResource[]>([]);
	const [loading, setLoading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const blobUrlRef = useRef<string | null>(null);

	useEffect(() => {
		setRecents(loadRecents());
		return () => {
			if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
		};
	}, []);

	const openUrl = useCallback(
		(raw: string) => {
			const embed = toEmbedUrl(raw);
			setActiveUrl(embed);
			setLoading(true);

			const label = labelFromUrl(raw);
			const updated = [
				{ url: raw, label, ts: Date.now() },
				...recents.filter((r) => r.url !== raw),
			].slice(0, MAX_RECENT);
			setRecents(updated);
			saveRecents(updated);
		},
		[recents],
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;
		openUrl(input.trim());
		setInput("");
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
		const blob = URL.createObjectURL(file);
		blobUrlRef.current = blob;
		setActiveUrl(blob);
		setLoading(true);
		const label = file.name.slice(0, 32);
		const updated = [
			{ url: file.name, label, ts: Date.now() },
			...recents.filter((r) => r.label !== file.name),
		].slice(0, MAX_RECENT);
		setRecents(updated);
		saveRecents(updated);
	};

	const handleClose = () => {
		setActiveUrl(null);
		setLoading(false);
	};

	return (
		<div className="flex flex-col h-full w-full bg-[#0d1525]">
			{/* Toolbar */}
			<div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
				<span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 text-violet-400 text-[10px] font-semibold uppercase tracking-wide shrink-0">
					<FolderOpenIcon className="h-3 w-3" />
					Resources
				</span>

				<form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
					<div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 focus-within:border-violet-500/50 transition-colors">
						<LinkIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
						<input
							type="url"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Paste Google Drive, Slides, OneDrive, or any URL…"
							className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none min-w-0"
						/>
					</div>
					<button
						type="submit"
						className="px-4 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors shrink-0"
					>
						Open
					</button>
				</form>

				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
					title="Upload a local file"
				>
					<UploadIcon className="h-3.5 w-3.5" />
					Upload
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4"
					className="hidden"
					onChange={handleFileUpload}
				/>

				{activeUrl && (
					<button
						type="button"
						onClick={handleClose}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
						title="Close resource"
					>
						<XIcon className="h-3.5 w-3.5" />
						Close
					</button>
				)}
			</div>

			{/* Main content */}
			{activeUrl ? (
				<div className="relative flex-1 min-h-0">
					{loading && (
						<div className="absolute inset-0 flex items-center justify-center bg-[#0d1525] z-10">
							<div className="flex flex-col items-center gap-3 text-slate-500">
								<div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-violet-500 animate-spin" />
								<span className="text-sm">Loading resource…</span>
							</div>
						</div>
					)}
					<iframe
						ref={iframeRef}
						src={activeUrl}
						title="Resource viewer"
						className="w-full h-full border-0"
						onLoad={() => setLoading(false)}
						allow="autoplay; fullscreen"
					/>
				</div>
			) : (
				/* Empty state + recents */
				<div className="flex-1 min-h-0 overflow-y-auto p-6">
					<div className="max-w-2xl mx-auto">
						<p className="text-slate-500 text-sm text-center mb-6">
							Paste a link above or upload a file to display it here.
							<br />
							Supports Google Drive, Slides, Docs, Sheets, OneDrive, PDFs, and images.
						</p>

						{recents.length > 0 && (
							<div>
								<h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
									Recent
								</h3>
								<div className="grid grid-cols-2 gap-2">
									{recents.map((r) => (
										<button
											key={r.ts}
											type="button"
											onClick={() => openUrl(r.url)}
											className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/30 hover:bg-slate-800 transition-colors text-left group"
										>
											<FileIcon className="h-5 w-5 text-violet-400 shrink-0" />
											<div className="min-w-0">
												<p className="text-sm text-slate-300 truncate group-hover:text-slate-100 transition-colors">
													{r.label}
												</p>
												<p className="text-[10px] text-slate-600 truncate">{r.url.slice(0, 40)}</p>
											</div>
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
