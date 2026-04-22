"use client";

import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const SAMPLE_CSV = `topicNumber,lessonNumber,resourceType,label,url
1,1.1,slides,Topic 1 Lesson 1 Slides,https://docs.google.com/presentation/d/EXAMPLE
1,1.1,book,Book Page 12,https://example.com/book/page/12
1,1.2,worksheet,Lesson 1.2 Practice,https://example.com/worksheets/1-2`;

export function ResourceImportButton({ onImported }: { onImported: () => void }) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	async function handleFile(file: File) {
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append("file", file);
			const res = await fetch("/api/resources/lesson/import", { method: "POST", body: fd });
			const { imported, skipped, errors } = (await res.json()) as {
				imported: number;
				skipped: number;
				errors: string[];
			};
			if (errors.length > 0) {
				toast.warning(`Imported ${imported}, skipped ${skipped}. ${errors.length} error(s).`);
			} else {
				toast.success(`Imported ${imported} resource${imported === 1 ? "" : "s"}`);
			}
			onImported();
		} catch {
			toast.error("Import failed");
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	function downloadTemplate() {
		const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "resources-template.csv";
		a.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="flex items-center gap-2">
			<input
				ref={fileRef}
				type="file"
				accept=".csv,.xlsx,.xls"
				className="hidden"
				onChange={(e) => {
					const f = e.target.files?.[0];
					if (f) handleFile(f);
				}}
			/>
			<button
				type="button"
				disabled={uploading}
				onClick={() => fileRef.current?.click()}
				className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
			>
				<UploadIcon className="h-4 w-4" />
				{uploading ? "Importing…" : "Import CSV / XLSX"}
			</button>
			<button
				type="button"
				onClick={downloadTemplate}
				className="text-xs text-indigo-400 hover:underline"
			>
				Download template
			</button>
		</div>
	);
}
