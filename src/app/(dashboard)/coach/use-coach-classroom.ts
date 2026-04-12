"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StudentOverview } from "@/app/api/classes/[id]/roster-overview/route";
import type { QueueItem } from "@/contexts/voice-queue";
import { playActivationChime } from "@/lib/chime";

export type ClassRow = { id: string; label: string; gradeLevel?: string; activeSessionId?: string };
export type GroupRow = { id: string; name: string; emoji: string; memberRosterIds: string[] };
type CoachClassResponseRow = ClassRow & { isArchived: boolean };
export type ParentCommsPreselect = {
	rosterId: string;
	text: string;
	nonce: number;
} | null;

interface UseCoachClassroomOptions {
	queue: QueueItem[];
	confirm: (id: string) => void;
	setActiveClassId: (id: string) => void;
	setRightOpen: (open: boolean) => void;
	setGroupsOpen: (open: boolean) => void;
	setParentCommsPreselect: (value: ParentCommsPreselect) => void;
}

export function useCoachClassroom({
	queue,
	confirm,
	setActiveClassId,
	setRightOpen,
	setGroupsOpen,
	setParentCommsPreselect,
}: UseCoachClassroomOptions) {
	const [classes, setClasses] = useState<ClassRow[]>([]);
	const [selectedClassId, setSelectedClassId] = useState(() => {
		try {
			return localStorage.getItem("activeClassId") ?? "";
		} catch {
			return "";
		}
	});
	const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
	const [students, setStudents] = useState<StudentOverview[]>([]);
	const [studentsLoading, setStudentsLoading] = useState(false);
	const [activeStudent, setActiveStudent] = useState<StudentOverview | null>(null);
	const [groups, setGroups] = useState<GroupRow[]>([]);
	const [_selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
	const [showGroups, setShowGroups] = useState(true);
	const selectedClassIdRef = useRef(selectedClassId);
	const activeSessionIdRef = useRef(activeSessionId);
	const activeSessionReqRef = useRef(0);
	const studentsReqRef = useRef(0);
	const groupsReqRef = useRef(0);

	useEffect(() => {
		selectedClassIdRef.current = selectedClassId;
	}, [selectedClassId]);

	useEffect(() => {
		activeSessionIdRef.current = activeSessionId;
	}, [activeSessionId]);

	useEffect(() => {
		fetch("/api/classes")
			.then((r) => r.json() as Promise<{ classes?: CoachClassResponseRow[] }>)
			.then((j) => {
				const active = (j.classes ?? []).filter((c) => !c.isArchived);
				setClasses(active);
				if (active.length === 0) {
					setSelectedClassId("");
					setActiveSessionId(undefined);
					setStudents([]);
					setGroups([]);
					setActiveStudent(null);
					setActiveClassId("");
					return;
				}
				const currentSelection = selectedClassIdRef.current;
				const stillValid = active.some((c) => c.id === currentSelection);
				if (stillValid) return;
				const savedClassId =
					typeof window !== "undefined" ? localStorage.getItem("activeClassId") : null;
				const preferred =
					active.find((c) => c.id === savedClassId) ??
					active.find((c) => c.id === currentSelection) ??
					active[0];
				if (preferred) setSelectedClassId(preferred.id);
			})
			.catch(() => {});
	}, [setActiveClassId]);

	useEffect(() => {
		if (!selectedClassId) {
			setActiveSessionId(undefined);
			return;
		}
		const reqId = ++activeSessionReqRef.current;
		fetch(`/api/classes/${selectedClassId}`)
			.then((r) => r.json())
			.then((j) => {
				if (activeSessionReqRef.current !== reqId) return;
				setActiveSessionId(j.activeSession?.id);
			})
			.catch(() => {});
	}, [selectedClassId]);

	const fetchStudents = useCallback(async (classId: string) => {
		const reqId = ++studentsReqRef.current;
		setStudentsLoading(true);
		try {
			const res = await fetch(`/api/classes/${classId}/roster-overview`);
			if (res.ok) {
				const json = await res.json();
				if (studentsReqRef.current !== reqId) return;
				setStudents(json.students ?? []);
			}
		} catch {
			/* noop */
		} finally {
			if (studentsReqRef.current === reqId) setStudentsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!selectedClassId) {
			setStudents([]);
			setStudentsLoading(false);
			setActiveStudent(null);
			return;
		}
		fetchStudents(selectedClassId);
	}, [selectedClassId, fetchStudents]);

	useEffect(() => {
		if (selectedClassId) setActiveClassId(selectedClassId);
	}, [selectedClassId, setActiveClassId]);

	useEffect(() => {
		if (selectedClassId) localStorage.setItem("board-class-id", selectedClassId);
		else localStorage.removeItem("board-class-id");
	}, [selectedClassId]);

	useEffect(() => {
		const item = queue.find((q) => q.data.type === "parent_message");
		if (!item || item.data.type !== "parent_message") return;
		const { studentName, messageText } = item.data;
		const needle = studentName.toLowerCase();
		const match = students.find(
			(s) => s.firstName?.toLowerCase() === needle || s.firstInitial.toLowerCase() === needle[0],
		);
		if (!match) return;
		confirm(item.id);
		setRightOpen(true);
		setGroupsOpen(false);
		setParentCommsPreselect({ rosterId: match.rosterId, text: messageText, nonce: Date.now() });
		playActivationChime();
		setTimeout(() => {
			const utt = new SpeechSynthesisUtterance("Go ahead");
			window.speechSynthesis.speak(utt);
		}, 500);
	}, [queue, students, confirm, setRightOpen, setGroupsOpen, setParentCommsPreselect]);

	useEffect(() => {
		const item = queue.find((q) => q.data.type === "move_to_group");
		if (!item || item.data.type !== "move_to_group") return;
		const { studentName, groupName } = item.data;
		const needle = studentName.toLowerCase();
		const student = students.find(
			(s) =>
				s.firstName?.toLowerCase() === needle || s.displayName.toLowerCase().startsWith(needle),
		);
		const group = groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
		if (!student || !group || !selectedClassId) return;
		confirm(item.id);
		fetch(`/api/classes/${selectedClassId}/groups/${group.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ rosterId: student.rosterId }),
		})
			.then((res) => {
				if (res.ok) {
					toast.success(`Moved ${student.displayName} → ${group.name}`);
					window.dispatchEvent(new Event("group-assignment-changed"));
					setGroups((prev) =>
						prev.map((g) =>
							g.id === group.id
								? {
										...g,
										memberRosterIds: [
											...g.memberRosterIds.filter((r) => r !== student.rosterId),
											student.rosterId,
										],
									}
								: {
										...g,
										memberRosterIds: g.memberRosterIds.filter((r) => r !== student.rosterId),
									},
						),
					);
				} else {
					toast.error("Couldn't move student — group may be full");
				}
			})
			.catch(() => toast.error("Move failed"));
	}, [queue, students, groups, selectedClassId, confirm]);

	useEffect(() => {
		if (!selectedClassId) {
			setSelectedGroupId(null);
			setGroups([]);
			return;
		}
		setSelectedGroupId(null);
		const reqId = ++groupsReqRef.current;
		fetch(`/api/classes/${selectedClassId}/groups`)
			.then((r) => r.json())
			.then((j) => {
				if (groupsReqRef.current !== reqId) return;
				setGroups(
					(j.groups ?? []).map(
						(g: { id: string; name: string; emoji: string; members: { rosterId: string }[] }) => ({
							id: g.id,
							name: g.name,
							emoji: g.emoji,
							memberRosterIds: g.members.map((m) => m.rosterId),
						}),
					),
				);
			})
			.catch(() => setGroups([]));
	}, [selectedClassId]);

	return {
		classes,
		selectedClassId,
		setSelectedClassId,
		activeSessionId,
		setActiveSessionId,
		activeSessionIdRef,
		selectedClassIdRef,
		students,
		studentsLoading,
		activeStudent,
		setActiveStudent,
		fetchStudents,
		groups,
		setGroups,
		showGroups,
		setShowGroups,
	};
}
