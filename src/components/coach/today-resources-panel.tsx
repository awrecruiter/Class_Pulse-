"use client";

import { BookOpen, ExternalLink, FileText, Presentation, Video } from "lucide-react";
import { useEffect, useState } from "react";
import type { LessonResource } from "@/types";

const RESOURCE_ICON: Record<string, React.ReactNode> = {
	slides: <Presentation className="h-4 w-4" />,
	book: <BookOpen className="h-4 w-4" />,
	worksheet: <FileText className="h-4 w-4" />,
	video: <Video className="h-4 w-4" />,
	other: <ExternalLink className="h-4 w-4" />,
};

export function TodayResourcesPanel({
	topicNumber,
	lessonNumber,
}: {
	topicNumber: number;
	lessonNumber: string;
}) {
	const [resources, setResources] = useState<LessonResource[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		fetch(`/api/resources/lesson?topic=${topicNumber}&lesson=${encodeURIComponent(lessonNumber)}`)
			.then((r) => r.json())
			.then(({ resources: rows }: { resources: LessonResource[] }) => {
				setResources(rows ?? []);
			})
			.catch(() => setResources([]))
			.finally(() => setLoading(false));
	}, [topicNumber, lessonNumber]);

	if (loading) return null;

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
			<p className="mb-2 text-xs font-medium text-slate-400">Lesson {lessonNumber} Resources</p>
			{resources.length === 0 ? (
				<p className="text-xs text-slate-500">
					No resources linked for this lesson —{" "}
					<a href="/resources" className="text-indigo-400 hover:underline">
						add them in Resources
					</a>
				</p>
			) : (
				<div className="flex flex-wrap gap-2">
					{resources.map((r) => (
						<a
							key={r.id}
							href={r.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:border-indigo-500 hover:bg-slate-700"
						>
							{RESOURCE_ICON[r.resourceType] ?? RESOURCE_ICON.other}
							<span>{r.label}</span>
						</a>
					))}
				</div>
			)}
		</div>
	);
}
