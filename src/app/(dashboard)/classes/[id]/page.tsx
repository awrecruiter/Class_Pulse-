"use client";

import {
	ActivityIcon,
	CheckCircleIcon,
	CheckIcon,
	ClipboardListIcon,
	CoinsIcon,
	CopyIcon,
	HistoryIcon,
	PencilIcon,
	PhoneIcon,
	PlayIcon,
	PlusIcon,
	SquareIcon,
	Trash2Icon,
	UploadIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GroupsKanban } from "@/components/classes/groups-kanban";
import { RamBucksPanel } from "@/components/classes/ram-bucks-panel";
import { Button } from "@/components/ui/button";
import { useVoiceQueue } from "@/contexts/voice-queue";

type RosterEntry = {
	id: string;
	studentId: string;
	firstName: string | null;
	firstInitial: string;
	lastInitial: string;
	isActive: boolean;
};

function studentDisplayName(s: RosterEntry): string {
	return s.firstName ?? `${s.firstInitial}${s.lastInitial}`;
}

function studentAvatarInitials(s: RosterEntry): string {
	return s.firstName
		? `${s.firstName[0] ?? s.firstInitial}${s.lastInitial}`
		: `${s.firstInitial}${s.lastInitial}`;
}

function normalizePhone(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	if (digits.length === 10) return `+1${digits}`;
	if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
	return raw;
}

function formatPhoneDisplay(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	const ten = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
	if (ten.length === 10) return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
	return raw;
}

type ClassSession = {
	id: string;
	joinCode: string;
	date: string;
	status: string;
};

type ClassData = {
	id: string;
	label: string;
	periodTime: string;
	gradeLevel: string;
	subject: string;
};

type ParentContact = {
	id: string;
	rosterId: string;
	parentName: string;
	phone: string;
	notes: string;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
};

type TimelineEvent = {
	id: string;
	type: "behavior" | "ram-buck" | "mastery" | "cfu" | "drawing";
	title: string;
	detail: string;
	date: string;
	severity?: "positive" | "neutral" | "negative";
};

type GroupMember = {
	id: string;
	groupId: string;
	rosterId: string;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
};

type StudentGroup = {
	id: string;
	name: string;
	emoji: string;
	color: string;
	sortOrder: number;
	members: GroupMember[];
};

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const { setActiveClassId } = useVoiceQueue();
	const [cls, setCls] = useState<ClassData | null>(null);
	const [roster, setRoster] = useState<RosterEntry[]>([]);
	const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
	const [lastEndedSessionId, setLastEndedSessionId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [sessionLoading, setSessionLoading] = useState(false);
	const [codeCopied, setCodeCopied] = useState(false);
	const [editingLabel, setEditingLabel] = useState(false);
	const [labelInput, setLabelInput] = useState("");
	const [savingLabel, setSavingLabel] = useState(false);

	// Add student form
	const [showAddForm, setShowAddForm] = useState(false);
	const [addForm, setAddForm] = useState({
		studentId: "",
		firstName: "",
		firstInitial: "",
		lastInitial: "",
	});
	const [adding, setAdding] = useState(false);

	// Edit student state
	const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
	const [editStudentForm, setEditStudentForm] = useState({ firstName: "", lastInitial: "" });
	const [savingStudent, setSavingStudent] = useState(false);

	// Groups state
	const [groups, setGroups] = useState<StudentGroup[]>([]);
	const [groupsLoading, setGroupsLoading] = useState(false);
	const [autoAssigning, setAutoAssigning] = useState(false);
	const [importingCsv, setImportingCsv] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Group milestones (activities unlocked by coins)
	type GroupMilestone = { id: string; name: string; coinsRequired: number };
	const [milestones, setMilestones] = useState<GroupMilestone[]>([]);
	const [milestoneForm, setMilestoneForm] = useState({ name: "", coins: "" });
	const [addingMilestone, setAddingMilestone] = useState(false);
	const [importingParentCsv, setImportingParentCsv] = useState(false);
	const parentCsvRef = useRef<HTMLInputElement>(null);

	// Tab state
	const [activeTab, setActiveTab] = useState<"roster" | "di-history">("roster");

	// DI History state
	type DiSessionHistory = {
		id: string;
		label: string;
		status: string;
		rewardAmount: number;
		createdAt: string;
		endedAt: string | null;
		groups: Array<{
			id: string;
			name: string;
			color: string;
			points: number;
			members: Array<{ rosterId: string }>;
		}>;
	};
	const [diSessions, setDiSessions] = useState<DiSessionHistory[]>([]);
	const [diSessionsLoaded, setDiSessionsLoaded] = useState(false);
	const [diSessionsLoading, setDiSessionsLoading] = useState(false);

	// Parent contacts state
	const [contacts, setContacts] = useState<ParentContact[]>([]);
	const [contactForms, setContactForms] = useState<
		Record<string, { parentName: string; phone: string; notes: string }>
	>({});
	const [savingContact, setSavingContact] = useState<string | null>(null);
	const [expandedContact, setExpandedContact] = useState<string | null>(null);

	// Timeline state
	const [selectedStudent, setSelectedStudent] = useState<RosterEntry | null>(null);
	const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
	const [timelineLoading, setTimelineLoading] = useState(false);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch(`/api/classes/${id}`);
			if (!res.ok) throw new Error("Not found");
			const json = await res.json();
			setCls(json.class);
			setRoster(json.roster ?? []);
			setActiveSession(json.activeSession ?? null);
		} catch {
			toast.error("Failed to load class");
		} finally {
			setLoading(false);
		}
	}, [id]);

	const fetchGroups = useCallback(async () => {
		setGroupsLoading(true);
		try {
			const res = await fetch(`/api/classes/${id}/groups`);
			if (!res.ok) throw new Error("Failed to load groups");
			const json = await res.json();
			setGroups(json.groups ?? []);
		} catch {
			// Groups may not exist yet — that's fine
		} finally {
			setGroupsLoading(false);
		}
	}, [id]);

	const fetchMilestones = useCallback(async () => {
		try {
			const res = await fetch(`/api/classes/${id}/group-milestones`);
			if (res.ok) {
				const json = await res.json();
				setMilestones(json.milestones ?? []);
			}
		} catch {
			// non-critical
		}
	}, [id]);

	const fetchContacts = useCallback(async () => {
		try {
			const res = await fetch(`/api/classes/${id}/parent-contacts`);
			if (res.ok) {
				const json = await res.json();
				setContacts(json.contacts ?? []);
			}
		} catch {
			// non-critical
		}
	}, [id]);

	const fetchTimeline = useCallback(
		async (rosterId: string) => {
			setTimelineLoading(true);
			try {
				const res = await fetch(`/api/classes/${id}/timeline?rosterId=${rosterId}`);
				if (res.ok) {
					const json = await res.json();
					setTimelineEvents(json.events ?? []);
				}
			} catch {
				setTimelineEvents([]);
			} finally {
				setTimelineLoading(false);
			}
		},
		[id],
	);

	useEffect(() => {
		setActiveClassId(id);
	}, [id, setActiveClassId]);

	useEffect(() => {
		fetchData();
		fetchGroups();
		fetchMilestones();
		fetchContacts();
	}, [fetchData, fetchGroups, fetchMilestones, fetchContacts]);

	const fetchDiSessions = useCallback(async () => {
		if (diSessionsLoaded) return;
		setDiSessionsLoading(true);
		try {
			const res = await fetch(`/api/classes/${id}/di-sessions`);
			if (res.ok) {
				const json = await res.json();
				setDiSessions(
					(json.sessions ?? []).filter((s: { status: string }) => s.status === "ended"),
				);
				setDiSessionsLoaded(true);
			}
		} catch {
			// non-critical
		} finally {
			setDiSessionsLoading(false);
		}
	}, [id, diSessionsLoaded]);

	const startSession = useCallback(async () => {
		setSessionLoading(true);
		try {
			const res = await fetch("/api/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ classId: id }),
			});
			if (!res.ok) throw new Error("Failed to start session");
			toast.success("Session started");
			fetchData();
		} catch {
			toast.error("Failed to start session");
		} finally {
			setSessionLoading(false);
		}
	}, [fetchData, id]);

	const endSession = useCallback(async () => {
		if (!activeSession) return;
		const endedId = activeSession.id;
		setSessionLoading(true);
		try {
			await fetch(`/api/sessions/${endedId}/end`, { method: "PUT" });
			toast.success("Session ended");
			setActiveSession(null);
			setLastEndedSessionId(endedId);
		} catch {
			toast.error("Failed to end session");
		} finally {
			setSessionLoading(false);
		}
	}, [activeSession]);

	useEffect(() => {
		function handleVoiceStartSession() {
			if (!activeSession && !sessionLoading) void startSession();
		}

		function handleVoiceEndSession() {
			if (activeSession && !sessionLoading) void endSession();
		}

		window.addEventListener("voice-start_session", handleVoiceStartSession);
		window.addEventListener("voice-end_session", handleVoiceEndSession);
		return () => {
			window.removeEventListener("voice-start_session", handleVoiceStartSession);
			window.removeEventListener("voice-end_session", handleVoiceEndSession);
		};
	}, [activeSession, endSession, sessionLoading, startSession]);

	function copyJoinCode() {
		if (!activeSession) return;
		navigator.clipboard.writeText(activeSession.joinCode).then(() => {
			setCodeCopied(true);
			setTimeout(() => setCodeCopied(false), 2000);
		});
	}

	async function handleAddStudent(e: React.FormEvent) {
		e.preventDefault();
		const firstName = addForm.firstName.trim();
		const firstInitial = firstName ? (firstName[0] ?? addForm.firstInitial) : addForm.firstInitial;
		if (!addForm.studentId || !firstInitial || !addForm.lastInitial) return;
		setAdding(true);
		try {
			const res = await fetch(`/api/classes/${id}/roster`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					studentId: addForm.studentId,
					firstName: firstName || undefined,
					firstInitial,
					lastInitial: addForm.lastInitial,
				}),
			});
			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Failed to add student");
			}
			toast.success("Student added");
			setAddForm({ studentId: "", firstName: "", firstInitial: "", lastInitial: "" });
			setShowAddForm(false);
			fetchData();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to add student");
		} finally {
			setAdding(false);
		}
	}

	async function removeStudent(rosterId: string) {
		try {
			await fetch(`/api/classes/${id}/roster/${rosterId}`, { method: "DELETE" });
			setRoster((r) => r.filter((s) => s.id !== rosterId));
			toast.success("Student removed");
		} catch {
			toast.error("Failed to remove student");
		}
	}

	async function saveEditStudent() {
		if (!editingStudentId) return;
		const firstName = editStudentForm.firstName.trim();
		const lastInitial = editStudentForm.lastInitial.trim();
		if (!firstName || !lastInitial) return;
		setSavingStudent(true);
		try {
			const res = await fetch(`/api/classes/${id}/roster/${editingStudentId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ firstName, lastInitial }),
			});
			if (!res.ok) throw new Error("Failed");
			setRoster((prev) =>
				prev.map((s) =>
					s.id === editingStudentId
						? {
								...s,
								firstName,
								firstInitial: firstName[0]?.toUpperCase() ?? s.firstInitial,
								lastInitial: lastInitial.toUpperCase(),
							}
						: s,
				),
			);
			setEditingStudentId(null);
			toast.success("Student updated");
		} catch {
			toast.error("Failed to update student");
		} finally {
			setSavingStudent(false);
		}
	}

	async function handleAutoAssign() {
		setAutoAssigning(true);
		try {
			const res = await fetch(`/api/classes/${id}/groups`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "auto-assign" }),
			});
			if (!res.ok) throw new Error("Failed to auto-assign");
			const json = await res.json();
			setGroups(json.groups ?? []);
			toast.success("Students auto-assigned to groups");
		} catch {
			toast.error("Failed to auto-assign students");
		} finally {
			setAutoAssigning(false);
		}
	}

	async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setImportingCsv(true);
		try {
			const isXlsx = file.name.endsWith(".xlsx");
			let body: string | ArrayBuffer;
			let contentType: string;
			if (isXlsx) {
				body = await file.arrayBuffer();
				contentType = "application/octet-stream";
			} else {
				body = await file.text();
				contentType = "text/plain";
			}
			const res = await fetch(`/api/classes/${id}/roster/import`, {
				method: "POST",
				headers: { "Content-Type": contentType },
				body,
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? "Import failed");
			toast.success(`Imported: ${json.added} added, ${json.skipped} skipped`);
			if (json.errors?.length > 0) {
				toast.error(`${json.errors.length} row(s) had errors`);
			}
			fetchData();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Import failed");
		} finally {
			setImportingCsv(false);
			// Reset file input
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	}

	async function handleParentContactsCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setImportingParentCsv(true);
		try {
			const isXlsx = file.name.match(/\.xlsx?$/i);
			const isPdf = file.name.match(/\.pdf$/i);
			let body: string | ArrayBuffer;
			let contentType: string;
			if (isXlsx) {
				body = await file.arrayBuffer();
				contentType = "application/octet-stream";
			} else if (isPdf) {
				body = await file.arrayBuffer();
				contentType = "application/pdf";
			} else {
				body = await file.text();
				contentType = "text/plain";
			}
			const res = await fetch(`/api/classes/${id}/parent-contacts/import`, {
				method: "POST",
				headers: { "Content-Type": contentType },
				body,
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? "Import failed");
			toast.success(`Imported ${json.imported} contact(s)`);
			if (json.errors?.length > 0) toast.error(`${json.errors.length} row(s) had errors`);
			fetchContacts();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Import failed");
		} finally {
			setImportingParentCsv(false);
			if (parentCsvRef.current) parentCsvRef.current.value = "";
		}
	}

	if (loading) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="h-8 w-48 rounded bg-slate-800/40 animate-pulse mb-6" />
				<div className="h-32 rounded-lg bg-slate-800/30 animate-pulse" />
			</div>
		);
	}

	if (!cls) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-8">
				<p className="text-sm text-slate-400">Class not found.</p>
			</div>
		);
	}

	async function saveLabel() {
		const trimmed = labelInput.trim();
		if (!trimmed || trimmed === cls?.label) {
			setEditingLabel(false);
			return;
		}
		setSavingLabel(true);
		try {
			const res = await fetch(`/api/classes/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label: trimmed }),
			});
			if (!res.ok) throw new Error("Failed");
			setCls((prev) => (prev ? { ...prev, label: trimmed } : prev));
			setEditingLabel(false);
		} catch {
			toast.error("Failed to rename class");
		} finally {
			setSavingLabel(false);
		}
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
			{/* Header */}
			<div>
				{editingLabel ? (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							saveLabel();
						}}
						className="flex items-center gap-2"
					>
						<input
							value={labelInput}
							onChange={(e) => setLabelInput(e.target.value)}
							maxLength={100}
							className="text-xl font-bold bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64"
						/>
						<button
							type="submit"
							disabled={savingLabel}
							className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
						>
							<CheckIcon className="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							onClick={() => setEditingLabel(false)}
							className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
						>
							Cancel
						</button>
					</form>
				) : (
					<div className="flex items-center gap-2">
						<h1 className="text-xl font-bold text-slate-200">{cls.label}</h1>
						<button
							type="button"
							onClick={() => {
								setLabelInput(cls.label);
								setEditingLabel(true);
							}}
							className="text-slate-600 hover:text-slate-400 transition-colors"
						>
							<PencilIcon className="h-3.5 w-3.5" />
						</button>
					</div>
				)}
				<p className="text-sm text-slate-400 mt-0.5">
					{cls.periodTime && `${cls.periodTime} · `}Grade {cls.gradeLevel} {cls.subject}
				</p>
			</div>

			{/* Tab strip */}
			<div className="flex rounded-lg overflow-hidden border border-slate-800 text-xs font-semibold self-start">
				<button
					type="button"
					onClick={() => setActiveTab("roster")}
					className={`px-4 py-2 transition-colors ${activeTab === "roster" ? "bg-indigo-500/20 text-indigo-400" : "bg-[#0d1525] text-slate-400 hover:text-slate-200"}`}
				>
					Roster &amp; Groups
				</button>
				<button
					type="button"
					onClick={() => {
						setActiveTab("di-history");
						fetchDiSessions();
					}}
					className={`px-4 py-2 transition-colors ${activeTab === "di-history" ? "bg-indigo-500/20 text-indigo-400" : "bg-[#0d1525] text-slate-400 hover:text-slate-200"}`}
				>
					🏆 DI History
				</button>
			</div>

			{activeTab === "roster" && (
				<>
					{/* Session card */}
					<div
						className={`rounded-lg border p-4 flex flex-col gap-3 ${
							activeSession ? "border-green-300 bg-green-50/60" : "border-slate-800 bg-slate-900"
						}`}
					>
						{activeSession ? (
							<>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
										<p className="text-sm font-semibold text-slate-200">Session active</p>
									</div>
									<div className="flex items-center gap-1">
										<Button size="sm" variant="outline" asChild>
											<Link href={`/classes/${id}/session`}>
												<ActivityIcon className="h-3.5 w-3.5 mr-1" />
												Go Live
											</Link>
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={endSession}
											disabled={sessionLoading}
											className="text-red-400 hover:text-red-400"
										>
											<SquareIcon className="h-3.5 w-3.5 mr-1" />
											End
										</Button>
									</div>
								</div>
								{/* Join code — large and prominent */}
								<div className="flex flex-col items-center gap-2 py-3">
									<p className="text-xs text-slate-400">
										Students go to unghettoMyLife.com/student and enter:
									</p>
									<div className="flex items-center gap-3">
										<span className="font-mono text-4xl font-bold tracking-[0.25em] text-slate-200">
											{activeSession.joinCode}
										</span>
										<button
											type="button"
											onClick={copyJoinCode}
											className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
										>
											{codeCopied ? (
												<CheckCircleIcon className="h-4 w-4 text-green-600" />
											) : (
												<CopyIcon className="h-4 w-4" />
											)}
											{codeCopied ? "Copied" : "Copy"}
										</button>
									</div>
								</div>
							</>
						) : (
							<div className="flex flex-col gap-3">
								<div className="flex items-center justify-between gap-2">
									<div>
										<p className="text-sm font-medium text-slate-200">No active session</p>
										<p className="text-xs text-slate-400 mt-0.5">
											Start a session to generate a join code for students
										</p>
									</div>
									<Button size="sm" onClick={startSession} disabled={sessionLoading}>
										<PlayIcon className="h-3.5 w-3.5 mr-1.5" />
										{sessionLoading ? "Starting..." : "Start Session"}
									</Button>
								</div>
								{lastEndedSessionId && (
									<Button size="sm" variant="outline" asChild className="self-start">
										<Link href={`/classes/${id}/report?session=${lastEndedSessionId}`}>
											<ClipboardListIcon className="h-3.5 w-3.5 mr-1.5" />
											View Last Report
										</Link>
									</Button>
								)}
							</div>
						)}
					</div>

					{/* Roster */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<UsersIcon className="h-4 w-4 text-slate-400" />
								<p className="text-sm font-semibold text-slate-200">
									Roster ({roster.length} students)
								</p>
							</div>
							<div className="flex items-center gap-2">
								<input
									ref={fileInputRef}
									type="file"
									accept=".csv,.xlsx,.txt"
									className="hidden"
									onChange={handleCsvImport}
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={() => fileInputRef.current?.click()}
									disabled={importingCsv}
								>
									<UploadIcon className="h-3.5 w-3.5 mr-1" />
									{importingCsv ? "Importing..." : "Import CSV/Excel"}
								</Button>
								<Button size="sm" variant="outline" onClick={() => setShowAddForm((v) => !v)}>
									<PlusIcon className="h-3.5 w-3.5 mr-1" />
									Add Student
								</Button>
							</div>
						</div>

						{/* Add student form */}
						{showAddForm && (
							<form
								onSubmit={handleAddStudent}
								className="rounded-lg border border-slate-800 bg-slate-800/20 p-3 flex flex-col gap-3"
							>
								<p className="text-xs font-medium text-slate-400">Add student</p>
								<div className="grid grid-cols-2 gap-2">
									<div className="flex flex-col gap-1">
										<label className="text-xs text-slate-400" htmlFor="studentId">
											Student ID *
										</label>
										<input
											id="studentId"
											type="text"
											required
											placeholder="10293847"
											value={addForm.studentId}
											onChange={(e) => setAddForm((f) => ({ ...f, studentId: e.target.value }))}
											className="rounded border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
									<div className="flex flex-col gap-1">
										<label className="text-xs text-slate-400" htmlFor="firstName">
											First name *
										</label>
										<input
											id="firstName"
											type="text"
											required
											placeholder="Jordan"
											value={addForm.firstName}
											onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
											className="rounded border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
										/>
									</div>
								</div>
								<div className="flex flex-col gap-1">
									<label className="text-xs text-slate-400" htmlFor="lastInitial">
										Last initial *
									</label>
									<input
										id="lastInitial"
										type="text"
										required
										maxLength={1}
										placeholder="M"
										value={addForm.lastInitial}
										onChange={(e) =>
											setAddForm((f) => ({ ...f, lastInitial: e.target.value.slice(-1) }))
										}
										className="rounded border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-ring w-20"
									/>
								</div>
								<div className="flex gap-2 justify-end">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setShowAddForm(false)}
									>
										Cancel
									</Button>
									<Button type="submit" size="sm" disabled={adding}>
										{adding ? "Adding..." : "Add"}
									</Button>
								</div>
							</form>
						)}

						{/* Student avatar grid */}
						{roster.length === 0 ? (
							<div className="rounded-lg border border-dashed border-slate-800 p-6 text-center">
								<p className="text-sm text-slate-400">
									No students yet. Add students above or import a CSV.
								</p>
							</div>
						) : (
							<div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
								{roster.map((student) => (
									<div
										key={student.id}
										className="group relative flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2 py-3 text-center hover:bg-slate-800/30 transition-colors"
									>
										{editingStudentId === student.id ? (
											<div className="flex flex-col gap-1.5 w-full px-0.5">
												<input
													// biome-ignore lint/a11y/noAutofocus: intentional — auto-focus inline edit field
													autoFocus
													type="text"
													placeholder="First name"
													value={editStudentForm.firstName}
													onChange={(e) =>
														setEditStudentForm((f) => ({ ...f, firstName: e.target.value }))
													}
													className="rounded border border-slate-700 bg-slate-800 px-1.5 py-1 text-xs text-slate-200 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
												/>
												<input
													type="text"
													placeholder="Last init"
													maxLength={1}
													value={editStudentForm.lastInitial}
													onChange={(e) =>
														setEditStudentForm((f) => ({
															...f,
															lastInitial: e.target.value.slice(-1),
														}))
													}
													className="rounded border border-slate-700 bg-slate-800 px-1.5 py-1 text-xs text-slate-200 w-full uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
												/>
												<div className="flex gap-1 justify-center">
													<button
														type="button"
														onClick={saveEditStudent}
														disabled={savingStudent}
														className="rounded bg-indigo-600 hover:bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white disabled:opacity-40"
													>
														<CheckIcon className="h-3 w-3" />
													</button>
													<button
														type="button"
														onClick={() => setEditingStudentId(null)}
														className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
													>
														<XIcon className="h-3 w-3" />
													</button>
												</div>
											</div>
										) : (
											<>
												{/* Avatar circle */}
												<div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-400">
													{studentAvatarInitials(student).toUpperCase()}
												</div>
												{/* Name */}
												<p className="text-xs font-medium text-slate-200 leading-tight">
													{studentDisplayName(student)}
												</p>
												<p className="text-[10px] text-slate-400">#{student.studentId}</p>
												{/* Edit button */}
												<button
													type="button"
													onClick={() => {
														setEditStudentForm({
															firstName: student.firstName ?? "",
															lastInitial: student.lastInitial,
														});
														setEditingStudentId(student.id);
													}}
													className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-400 transition-all p-0.5"
													aria-label="Edit student"
												>
													<PencilIcon className="h-3 w-3" />
												</button>
												{/* Remove button */}
												<button
													type="button"
													onClick={() => removeStudent(student.id)}
													className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all p-0.5"
													aria-label="Remove student"
												>
													<Trash2Icon className="h-3 w-3" />
												</button>
											</>
										)}
									</div>
								))}
							</div>
						)}
					</div>

					{/* Groups */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<p className="text-sm font-semibold text-slate-200">Groups</p>
							<Button
								size="sm"
								variant="outline"
								onClick={handleAutoAssign}
								disabled={autoAssigning || roster.length === 0}
							>
								{autoAssigning ? "Assigning..." : "Auto-assign"}
							</Button>
						</div>

						{/* Performance data tip — shown before groups are created */}
						{roster.length > 0 && groups.length === 0 && !groupsLoading && (
							<div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
								<strong>Tip:</strong> For performance-based grouping, include a 4th column in your
								CSV/Excel with each student&apos;s prior-year score (e.g. iReady scale score).
								Auto-assign will use it to balance groups.
							</div>
						)}

						{groupsLoading ? (
							<div className="h-32 rounded-lg bg-slate-800/30 animate-pulse" />
						) : (
							<GroupsKanban
								classId={id}
								groups={groups}
								allRoster={roster}
								onGroupsChange={setGroups}
								onRenameGroup={async (groupId, name, emoji) => {
									await fetch(`/api/classes/${id}/groups/${groupId}`, {
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ name, emoji }),
									});
									fetchGroups();
								}}
							/>
						)}
					</div>

					{/* Group Coin Activities */}
					<div className="flex flex-col gap-3">
						<div>
							<p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
								<CoinsIcon className="h-4 w-4 text-amber-400" />
								Coin Activities
							</p>
							<p className="text-xs text-slate-400 mt-0.5">
								Groups earn coins to unlock these daily activities
							</p>
						</div>
						{milestones.length > 0 && (
							<div className="flex flex-col gap-1.5">
								{milestones
									.slice()
									.sort((a, b) => a.coinsRequired - b.coinsRequired)
									.map((m) => (
										<div
											key={m.id}
											className="flex items-center justify-between rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2"
										>
											<div className="flex items-center gap-2 min-w-0">
												<CoinsIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
												<span className="text-sm text-slate-200 truncate">{m.name}</span>
											</div>
											<div className="flex items-center gap-2 shrink-0">
												<span className="text-xs font-bold text-amber-400">
													{m.coinsRequired.toLocaleString()} coins
												</span>
												<button
													type="button"
													onClick={async () => {
														await fetch(`/api/classes/${id}/group-milestones?milestoneId=${m.id}`, {
															method: "DELETE",
														});
														fetchMilestones();
													}}
													className="p-1 text-slate-500 hover:text-red-400 transition-colors"
													aria-label="Delete activity"
												>
													<Trash2Icon className="h-3.5 w-3.5" />
												</button>
											</div>
										</div>
									))}
							</div>
						)}
						<div className="flex gap-2">
							<input
								type="text"
								value={milestoneForm.name}
								onChange={(e) => setMilestoneForm((f) => ({ ...f, name: e.target.value }))}
								placeholder="Activity (e.g. PE, Gym)"
								className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
							/>
							<input
								type="number"
								min={1}
								value={milestoneForm.coins}
								onChange={(e) => setMilestoneForm((f) => ({ ...f, coins: e.target.value }))}
								placeholder="Coins"
								className="w-20 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 text-center focus:outline-none focus:ring-1 focus:ring-amber-500/50"
							/>
							<button
								type="button"
								disabled={addingMilestone || !milestoneForm.name.trim() || !milestoneForm.coins}
								onClick={async () => {
									const coins = Number(milestoneForm.coins);
									if (!milestoneForm.name.trim() || !coins) return;
									setAddingMilestone(true);
									try {
										const res = await fetch(`/api/classes/${id}/group-milestones`, {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({
												name: milestoneForm.name.trim(),
												coinsRequired: coins,
											}),
										});
										if (res.ok) {
											setMilestoneForm({ name: "", coins: "" });
											fetchMilestones();
										}
									} finally {
										setAddingMilestone(false);
									}
								}}
								className="flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
							>
								<PlusIcon className="h-3.5 w-3.5" />
								Add
							</button>
						</div>
					</div>

					{/* RAM Buck Economy */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<p className="text-sm font-semibold text-slate-200">🐏 RAM Bucks</p>
						</div>
						<RamBucksPanel classId={id} />
					</div>

					{/* Parent Contacts */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<PhoneIcon className="h-4 w-4 text-slate-400" />
								<p className="text-sm font-semibold text-slate-200">Parent Contacts</p>
							</div>
							<div className="flex items-center gap-2">
								<input
									ref={parentCsvRef}
									type="file"
									accept=".csv,.xlsx,.xls,.pdf,.txt"
									className="hidden"
									onChange={handleParentContactsCsvImport}
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={() => parentCsvRef.current?.click()}
									disabled={importingParentCsv}
								>
									<UploadIcon className="h-3.5 w-3.5 mr-1" />
									{importingParentCsv ? "Importing..." : "Import CSV"}
								</Button>
							</div>
						</div>
						<p className="text-xs text-slate-400">
							CSV columns: studentId, parentName, phone, notes
						</p>
						{roster.length === 0 ? (
							<p className="text-xs text-slate-400">Add students to the roster first.</p>
						) : (
							<div className="rounded-lg border border-slate-800 overflow-hidden">
								{roster.map((student, i) => {
									const contact = contacts.find((c) => c.rosterId === student.id);
									const isExpanded = expandedContact === student.id;
									const form = contactForms[student.id] ?? {
										parentName: contact?.parentName ?? "",
										phone: contact?.phone ?? "",
										notes: contact?.notes ?? "",
									};
									return (
										<div
											key={student.id}
											className={`flex flex-col px-3 py-2.5 ${i !== roster.length - 1 ? "border-b border-slate-800" : ""}`}
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<span className="text-sm font-medium">{studentDisplayName(student)}</span>
													{contact ? (
														<span className="text-xs rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5">
															{formatPhoneDisplay(contact.phone)}
														</span>
													) : (
														<span className="text-xs text-slate-400">No contact</span>
													)}
												</div>
												<button
													type="button"
													onClick={() => {
														setExpandedContact(isExpanded ? null : student.id);
														if (!isExpanded && !contactForms[student.id]) {
															setContactForms((f) => ({
																...f,
																[student.id]: {
																	parentName: contact?.parentName ?? "",
																	phone: contact?.phone ?? "",
																	notes: contact?.notes ?? "",
																},
															}));
														}
													}}
													className="text-xs text-indigo-400 underline"
												>
													{isExpanded ? "Cancel" : contact ? "Edit" : "Add"}
												</button>
											</div>
											{isExpanded && (
												<div className="mt-2 flex flex-col gap-2">
													<input
														type="text"
														placeholder="Parent name"
														value={form.parentName}
														onChange={(e) =>
															setContactForms((f) => ({
																...f,
																[student.id]: { ...form, parentName: e.target.value },
															}))
														}
														className="rounded border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
													/>
													<input
														type="tel"
														placeholder="555-867-5309"
														value={form.phone}
														onChange={(e) =>
															setContactForms((f) => ({
																...f,
																[student.id]: { ...form, phone: e.target.value },
															}))
														}
														className="rounded border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
													/>
													<input
														type="text"
														placeholder="Notes (optional)"
														value={form.notes}
														onChange={(e) =>
															setContactForms((f) => ({
																...f,
																[student.id]: { ...form, notes: e.target.value },
															}))
														}
														className="rounded border border-slate-800 bg-[#0d1525] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
													/>
													<div className="flex gap-2 justify-end">
														{contact && (
															<Button
																size="sm"
																variant="ghost"
																className="text-red-400 hover:text-red-400"
																disabled={savingContact === student.id}
																onClick={async () => {
																	try {
																		await fetch(
																			`/api/classes/${id}/parent-contacts/${contact.id}`,
																			{
																				method: "DELETE",
																			},
																		);
																		await fetchContacts();
																		setExpandedContact(null);
																	} catch {
																		toast.error("Failed to delete contact");
																	}
																}}
															>
																Delete
															</Button>
														)}
														<Button
															size="sm"
															disabled={savingContact === student.id}
															onClick={async () => {
																setSavingContact(student.id);
																try {
																	const res = await fetch(`/api/classes/${id}/parent-contacts`, {
																		method: "POST",
																		headers: { "Content-Type": "application/json" },
																		body: JSON.stringify({
																			rosterId: student.id,
																			...form,
																			phone: normalizePhone(form.phone),
																		}),
																	});
																	if (!res.ok) {
																		const j = await res.json();
																		throw new Error((j as { error?: string }).error ?? "Failed");
																	}
																	setExpandedContact(null);
																	toast.success("Contact saved");
																	void fetchContacts();
																} catch (err) {
																	toast.error(
																		err instanceof Error ? err.message : "Failed to save contact",
																	);
																} finally {
																	setSavingContact(null);
																}
															}}
														>
															{savingContact === student.id ? "Saving..." : "Save"}
														</Button>
													</div>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Student Timeline (Black Box) */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<HistoryIcon className="h-4 w-4 text-slate-400" />
							<p className="text-sm font-semibold text-slate-200">Student Timeline</p>
						</div>
						{roster.length === 0 ? (
							<p className="text-xs text-slate-400">Add students to view their timeline.</p>
						) : (
							<div className="rounded-lg border border-slate-800 overflow-hidden">
								{roster.map((student, i) => (
									<div
										key={student.id}
										className={`flex items-center justify-between px-3 py-2.5 ${i !== roster.length - 1 ? "border-b border-slate-800" : ""}`}
									>
										<span className="text-sm font-medium">
											{studentDisplayName(student)}
											<span className="ml-2 text-xs text-slate-400">{student.studentId}</span>
										</span>
										<button
											type="button"
											onClick={() => {
												setSelectedStudent(student);
												fetchTimeline(student.id);
											}}
											className="text-xs text-indigo-400 underline"
										>
											View
										</button>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Timeline Modal */}
					{selectedStudent && (
						<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
							<div className="bg-[#0d1525] rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
								<div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
									<p className="text-sm font-semibold">
										{studentDisplayName(selectedStudent)} — Full History
									</p>
									<button
										type="button"
										onClick={() => {
											setSelectedStudent(null);
											setTimelineEvents([]);
										}}
									>
										<XIcon className="h-4 w-4 text-slate-400" />
									</button>
								</div>
								<div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-2">
									{timelineLoading ? (
										<div className="flex flex-col gap-2">
											{[1, 2, 3].map((k) => (
												<div key={k} className="h-12 rounded-lg bg-slate-800 animate-pulse" />
											))}
										</div>
									) : timelineEvents.length === 0 ? (
										<p className="text-sm text-slate-400 text-center py-8">
											No events recorded yet.
										</p>
									) : (
										timelineEvents.map((event) => {
											const borderColor =
												event.severity === "positive"
													? "border-l-green-500"
													: event.severity === "negative"
														? "border-l-red-500"
														: "border-l-gray-300";
											const icon =
												event.type === "mastery"
													? "⭐"
													: event.type === "ram-buck"
														? "🐏"
														: event.type === "behavior"
															? "📋"
															: event.type === "cfu"
																? "✍️"
																: "🎨";
											return (
												<div
													key={event.id}
													className={`border-l-4 ${borderColor} rounded-r-lg bg-slate-800/30 px-3 py-2 flex flex-col gap-0.5`}
												>
													<div className="flex items-center gap-1.5">
														<span className="text-sm">{icon}</span>
														<p className="text-sm font-medium">{event.title}</p>
													</div>
													<p className="text-xs text-slate-400">{event.detail}</p>
													<p className="text-xs text-slate-400/60">
														{new Date(event.date).toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
															year: "numeric",
														})}
													</p>
												</div>
											);
										})
									)}
								</div>
							</div>
						</div>
					)}
				</>
			)}

			{/* DI History tab */}
			{activeTab === "di-history" && (
				<div className="flex flex-col gap-3">
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
						DI Session History
					</p>
					{diSessionsLoading ? (
						<div className="h-32 rounded-lg bg-slate-800/30 animate-pulse" />
					) : diSessions.length === 0 ? (
						<div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
							<p className="text-sm text-slate-400">No completed DI sessions yet.</p>
							<p className="text-xs text-slate-400 mt-1">
								Start a DI session from the Coach page to see results here.
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-4">
							{diSessions
								.slice()
								.reverse()
								.map((session) => {
									const maxPoints = Math.max(...session.groups.map((g) => g.points));
									return (
										<div
											key={session.id}
											className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3"
										>
											<div className="flex items-center justify-between">
												<div>
													<p className="text-sm font-bold text-slate-200">{session.label}</p>
													<p className="text-xs text-slate-400 mt-0.5">
														{new Date(session.createdAt).toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
															year: "numeric",
														})}
													</p>
												</div>
												<span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-medium">
													+{session.rewardAmount} RAM to winners
												</span>
											</div>
											<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
												{session.groups.map((group) => {
													const isWinner = group.points === maxPoints && maxPoints > 0;
													return (
														<div
															key={group.id}
															className={`rounded-lg border p-2 flex flex-col gap-1 ${isWinner ? "border-amber-400 bg-amber-50/50" : "border-slate-800 bg-slate-800/20"}`}
														>
															<div className="flex items-center justify-between">
																<span className="text-xs font-semibold text-slate-200">
																	{group.name}
																</span>
																{isWinner && <span className="text-xs">🏆</span>}
															</div>
															<span
																className={`text-lg font-black tabular-nums ${isWinner ? "text-amber-600" : "text-slate-200"}`}
															>
																{group.points}
															</span>
															<span className="text-[10px] text-slate-400">
																{group.members.length} students
															</span>
														</div>
													);
												})}
											</div>
										</div>
									);
								})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
