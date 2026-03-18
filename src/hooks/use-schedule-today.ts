"use client";

import { useEffect, useState } from "react";

export type ScheduleDocLink = {
	id: string;
	label: string;
	url: string;
	linkType: string;
};

export type ScheduleBlock = {
	id: string;
	title: string;
	color: string;
	startTime: string;
	endTime: string;
	dayOfWeek: number | null;
	specificDate: string | null;
	sortOrder: number;
	docs: ScheduleDocLink[];
};

function getCurrentHHMM(): string {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function useScheduleToday() {
	const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
	const [loading, setLoading] = useState(true);

	const today = new Date();
	const day = today.getDay();
	const date = today.toISOString().slice(0, 10);

	useEffect(() => {
		fetch(`/api/schedule?day=${day}&date=${date}`)
			.then((r) => (r.ok ? r.json() : { blocks: [] }))
			.then((j) => setBlocks(j.blocks ?? []))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [day, date]);

	const [now, setNow] = useState(() => getCurrentHHMM());
	useEffect(() => {
		const t = setInterval(() => setNow(getCurrentHHMM()), 60_000);
		return () => clearInterval(t);
	}, []);

	const activeBlockId = blocks.find((b) => b.startTime <= now && now < b.endTime)?.id ?? null;

	return { blocks, loading, activeBlockId };
}
