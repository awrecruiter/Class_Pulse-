"use client";

import { ChevronDownIcon, ChevronRightIcon, DownloadIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { YAAG_TOPICS } from "@/data/yaag-2025-2026";
import type { LessonResource } from "@/types";
import { LessonResourceRow } from "./lesson-resource-row";
import { ResourceImportButton } from "./resource-import-button";

type OverridesByLesson = Record<string, LessonResource[]>; // key: "topicNum:lessonNum"

function lessonKey(topicNumber: number, lessonNumber: string) {
	return `${topicNumber}:${lessonNumber}`;
}

export function ResourceCatalog() {
	const [overrides, setOverrides] = useState<OverridesByLesson>({});
	const [openTopics, setOpenTopics] = useState<Set<number>>(new Set());
	const [loading, setLoading] = useState(true);

	const loadOverrides = useCallback(async () => {
		try {
			const res = await fetch("/api/resources/lesson");
			const { resources } = (await res.json()) as { resources: LessonResource[] };
			const byLesson: OverridesByLesson = {};
			for (const r of resources) {
				const key = lessonKey(r.topicNumber, r.lessonNumber);
				if (!byLesson[key]) byLesson[key] = [];
				byLesson[key].push(r);
			}
			setOverrides(byLesson);
		} catch {
			// silent
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadOverrides();
	}, [loadOverrides]);

	function toggleTopic(num: number) {
		setOpenTopics((prev) => {
			const next = new Set(prev);
			if (next.has(num)) next.delete(num);
			else next.add(num);
			return next;
		});
	}

	return (
		<div className="min-h-screen bg-slate-950 p-6">
			<div className="mx-auto max-w-4xl">
				{/* Header */}
				<div className="mb-6 flex items-start justify-between">
					<div>
						<h1 className="text-2xl font-bold text-slate-100">Lesson Resources</h1>
						<p className="mt-1 text-sm text-slate-400">
							Link slides, book pages, worksheets, and videos to each YAAG lesson. Say "open slides"
							during class to open them instantly.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<a
							href="/api/resources/lesson/export"
							download
							className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-700"
						>
							<DownloadIcon className="h-4 w-4" />
							Export CSV
						</a>
						<ResourceImportButton onImported={loadOverrides} />
					</div>
				</div>

				{loading ? (
					<div className="py-12 text-center text-slate-500">Loading…</div>
				) : (
					<div className="space-y-3">
						{YAAG_TOPICS.map((topic) => {
							const isOpen = openTopics.has(topic.number);
							const topicResourceCount = topic.lessons.reduce((sum, lesson) => {
								const key = lessonKey(topic.number, lesson.number);
								return sum + (overrides[key]?.length ?? 0);
							}, 0);

							return (
								<div
									key={topic.number}
									className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
								>
									{/* Topic header */}
									<button
										type="button"
										onClick={() => toggleTopic(topic.number)}
										className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
									>
										{isOpen ? (
											<ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-400" />
										) : (
											<ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-400" />
										)}
										<span className="font-mono text-xs text-slate-500">Topic {topic.roman}</span>
										<span className="font-semibold text-slate-100">{topic.title}</span>
										<span className="text-xs text-slate-500">
											{topic.lessons.length} lesson{topic.lessons.length === 1 ? "" : "s"}
										</span>
										{topicResourceCount > 0 && (
											<span className="ml-auto rounded-full bg-indigo-900/60 px-2 py-0.5 text-xs text-indigo-300">
												{topicResourceCount} resource
												{topicResourceCount === 1 ? "" : "s"}
											</span>
										)}
									</button>

									{/* Lesson rows */}
									{isOpen && (
										<div className="border-t border-slate-800">
											{topic.lessons.map((lesson) => {
												const key = lessonKey(topic.number, lesson.number);
												return (
													<LessonResourceRow
														key={lesson.number}
														topicNumber={topic.number}
														lessonNumber={lesson.number}
														lessonTitle={lesson.title}
														resources={overrides[key] ?? []}
														onRefresh={loadOverrides}
													/>
												);
											})}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
