"use client";

import {
	ChevronDownIcon,
	ChevronRightIcon,
	HelpCircleIcon,
	PlusIcon,
	SaveIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { LessonResource, LessonResourceType } from "@/types";

function LinkHint() {
	return (
		<div className="group relative">
			<HelpCircleIcon className="h-3.5 w-3.5 cursor-help text-slate-600 hover:text-slate-400" />
			<div className="pointer-events-none absolute right-0 top-5 z-50 w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
				<p className="mb-2 font-semibold text-slate-200">How to get a shareable link</p>
				<p className="mb-1 font-medium text-slate-400">OneDrive (current MDCPS)</p>
				<p className="mb-2 text-slate-500">
					Right-click the file → <span className="text-slate-300">Share</span> → set to{" "}
					<span className="text-slate-300">"Anyone in MDCPS with the link"</span> → Copy link
				</p>
				<p className="mb-1 font-medium text-slate-400">Google Drive (after migration)</p>
				<p className="text-slate-500">
					Right-click the file → <span className="text-slate-300">Get link</span> → set to{" "}
					<span className="text-slate-300">"Anyone with the link"</span> → Copy link
				</p>
			</div>
		</div>
	);
}

const RESOURCE_TYPES: { type: LessonResourceType; label: string }[] = [
	{ type: "slides", label: "Slides" },
	{ type: "book", label: "Book Page" },
	{ type: "worksheet", label: "Worksheet" },
	{ type: "video", label: "Video" },
	{ type: "other", label: "Other" },
];

type SlotState = {
	label: string;
	url: string;
	dirty: boolean;
	saving: boolean;
};

function makeSlotState(resource: LessonResource | undefined): SlotState {
	return {
		label: resource?.label ?? "",
		url: resource?.url ?? "",
		dirty: false,
		saving: false,
	};
}

export function LessonResourceRow({
	topicNumber,
	lessonNumber,
	lessonTitle,
	resources,
	onRefresh,
}: {
	topicNumber: number;
	lessonNumber: string;
	lessonTitle: string;
	resources: LessonResource[];
	onRefresh: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [slots, setSlots] = useState<Record<LessonResourceType, SlotState>>(() => {
		const init = {} as Record<LessonResourceType, SlotState>;
		for (const { type } of RESOURCE_TYPES) {
			init[type] = makeSlotState(resources.find((r) => r.resourceType === type));
		}
		return init;
	});

	const hasAny = resources.length > 0;

	function updateSlot(type: LessonResourceType, field: "label" | "url", value: string) {
		setSlots((prev) => ({
			...prev,
			[type]: { ...prev[type], [field]: value, dirty: true },
		}));
	}

	async function saveSlot(type: LessonResourceType) {
		const slot = slots[type];
		if (!slot.url) {
			toast.error("URL is required");
			return;
		}
		setSlots((prev) => ({ ...prev, [type]: { ...prev[type], saving: true } }));
		try {
			const res = await fetch("/api/resources/lesson", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					topicNumber,
					lessonNumber,
					resourceType: type,
					label: slot.label || type,
					url: slot.url,
					isHidden: false,
				}),
			});
			if (!res.ok) throw new Error();
			toast.success("Saved");
			setSlots((prev) => ({ ...prev, [type]: { ...prev[type], dirty: false, saving: false } }));
			onRefresh();
		} catch {
			toast.error("Save failed");
			setSlots((prev) => ({ ...prev, [type]: { ...prev[type], saving: false } }));
		}
	}

	async function deleteSlot(type: LessonResourceType) {
		const match = resources.find((r) => r.resourceType === type && r.isTeacherOverride);
		if (!match) return;
		try {
			await fetch(`/api/resources/lesson?id=${match.id}`, { method: "DELETE" });
			setSlots((prev) => ({ ...prev, [type]: makeSlotState(undefined) }));
			onRefresh();
		} catch {
			toast.error("Delete failed");
		}
	}

	return (
		<div className="border-b border-slate-800 last:border-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-800/50 transition-colors"
			>
				{open ? (
					<ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-500" />
				) : (
					<ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-500" />
				)}
				<span className="text-sm font-medium text-slate-200">
					Lesson {lessonNumber}
					{lessonTitle ? ` — ${lessonTitle}` : ""}
				</span>
				{hasAny && (
					<span className="ml-auto rounded-full bg-indigo-900/60 px-2 py-0.5 text-xs text-indigo-300">
						{resources.length} resource{resources.length === 1 ? "" : "s"}
					</span>
				)}
			</button>

			{open && (
				<div className="px-4 pb-4 pt-1 space-y-3">
					{RESOURCE_TYPES.map(({ type, label }) => {
						const slot = slots[type];
						const existing = resources.find((r) => r.resourceType === type);
						return (
							<div key={type} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
								<div className="mb-2 flex items-center justify-between">
									<span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
										{label}
									</span>
									<div className="flex items-center gap-2">
										<LinkHint />
										{existing?.isTeacherOverride && (
											<button
												type="button"
												onClick={() => deleteSlot(type)}
												className="text-slate-500 hover:text-red-400 transition-colors"
												title="Remove override"
											>
												<Trash2Icon className="h-3.5 w-3.5" />
											</button>
										)}
									</div>
								</div>
								<div className="flex gap-2">
									<input
										type="text"
										placeholder="Label (e.g. Topic 3 Slides)"
										value={slot.label}
										onChange={(e) => updateSlot(type, "label", e.target.value)}
										className="w-36 shrink-0 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
									/>
									<input
										type="url"
										placeholder="https://..."
										value={slot.url}
										onChange={(e) => updateSlot(type, "url", e.target.value)}
										className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
									/>
									{slot.dirty && (
										<button
											type="button"
											disabled={slot.saving}
											onClick={() => saveSlot(type)}
											className="flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
										>
											<SaveIcon className="h-3 w-3" />
											{slot.saving ? "…" : "Save"}
										</button>
									)}
									{!slot.dirty && !slot.url && (
										<button
											type="button"
											onClick={() => updateSlot(type, "url", "https://")}
											className="flex items-center gap-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
										>
											<PlusIcon className="h-3 w-3" />
											Add
										</button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
