"use client";

import {
	ActivityIcon,
	CheckCircleIcon,
	ClipboardListIcon,
	CopyIcon,
	PlayIcon,
	PlusIcon,
	SquareIcon,
	Trash2Icon,
	UploadIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GroupsKanban } from "@/components/classes/groups-kanban";
import { Button } from "@/components/ui/button";

type RosterEntry = {
	id: string;
	studentId: string;
	firstInitial: string;
	lastInitial: string;
	isActive: boolean;
};

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
	const [cls, setCls] = useState<ClassData | null>(null);
	const [roster, setRoster] = useState<RosterEntry[]>([]);
	const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
	const [lastEndedSessionId, setLastEndedSessionId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [sessionLoading, setSessionLoading] = useState(false);
	const [codeCopied, setCodeCopied] = useState(false);

	// Add student form
	const [showAddForm, setShowAddForm] = useState(false);
	const [addForm, setAddForm] = useState({ studentId: "", firstInitial: "", lastInitial: "" });
	const [adding, setAdding] = useState(false);

	// Groups state
	const [groups, setGroups] = useState<StudentGroup[]>([]);
	const [groupsLoading, setGroupsLoading] = useState(false);
	const [autoAssigning, setAutoAssigning] = useState(false);
	const [importingCsv, setImportingCsv] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

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

	useEffect(() => {
		fetchData();
		fetchGroups();
	}, [fetchData, fetchGroups]);

	async function startSession() {
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
	}

	async function endSession() {
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
	}

	function copyJoinCode() {
		if (!activeSession) return;
		navigator.clipboard.writeText(activeSession.joinCode).then(() => {
			setCodeCopied(true);
			setTimeout(() => setCodeCopied(false), 2000);
		});
	}

	async function handleAddStudent(e: React.FormEvent) {
		e.preventDefault();
		if (!addForm.studentId || !addForm.firstInitial || !addForm.lastInitial) return;
		setAdding(true);
		try {
			const res = await fetch(`/api/classes/${id}/roster`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(addForm),
			});
			if (!res.ok) {
				const json = await res.json();
				throw new Error(json.error ?? "Failed to add student");
			}
			toast.success("Student added");
			setAddForm({ studentId: "", firstInitial: "", lastInitial: "" });
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

	if (loading) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="h-8 w-48 rounded bg-muted/40 animate-pulse mb-6" />
				<div className="h-32 rounded-lg bg-muted/30 animate-pulse" />
			</div>
		);
	}

	if (!cls) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-8">
				<p className="text-sm text-muted-foreground">Class not found.</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
			{/* Header */}
			<div>
				<h1 className="text-xl font-bold text-foreground">{cls.label}</h1>
				<p className="text-sm text-muted-foreground mt-0.5">
					{cls.periodTime && `${cls.periodTime} · `}Grade {cls.gradeLevel} {cls.subject}
				</p>
			</div>

			{/* Session card */}
			<div
				className={`rounded-lg border p-4 flex flex-col gap-3 ${
					activeSession ? "border-green-300 bg-green-50/60" : "border-border bg-card"
				}`}
			>
				{activeSession ? (
					<>
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
								<p className="text-sm font-semibold text-foreground">Session active</p>
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
									className="text-destructive hover:text-destructive"
								>
									<SquareIcon className="h-3.5 w-3.5 mr-1" />
									End
								</Button>
							</div>
						</div>
						{/* Join code — large and prominent */}
						<div className="flex flex-col items-center gap-2 py-3">
							<p className="text-xs text-muted-foreground">
								Students go to unghettoMyLife.com/student and enter:
							</p>
							<div className="flex items-center gap-3">
								<span className="font-mono text-4xl font-bold tracking-[0.25em] text-foreground">
									{activeSession.joinCode}
								</span>
								<button
									type="button"
									onClick={copyJoinCode}
									className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
								<p className="text-sm font-medium text-foreground">No active session</p>
								<p className="text-xs text-muted-foreground mt-0.5">
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
						<UsersIcon className="h-4 w-4 text-muted-foreground" />
						<p className="text-sm font-semibold text-foreground">
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
						className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-3"
					>
						<p className="text-xs font-medium text-muted-foreground">Add student</p>
						<div className="grid grid-cols-3 gap-2">
							<div className="col-span-1 flex flex-col gap-1">
								<label className="text-xs text-muted-foreground" htmlFor="studentId">
									Student ID
								</label>
								<input
									id="studentId"
									type="text"
									required
									placeholder="10293847"
									value={addForm.studentId}
									onChange={(e) => setAddForm((f) => ({ ...f, studentId: e.target.value }))}
									className="rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-xs text-muted-foreground" htmlFor="firstInitial">
									First initial
								</label>
								<input
									id="firstInitial"
									type="text"
									required
									maxLength={1}
									placeholder="J"
									value={addForm.firstInitial}
									onChange={(e) =>
										setAddForm((f) => ({ ...f, firstInitial: e.target.value.slice(-1) }))
									}
									className="rounded border border-border bg-background px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label className="text-xs text-muted-foreground" htmlFor="lastInitial">
									Last initial
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
									className="rounded border border-border bg-background px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							</div>
						</div>
						<div className="flex gap-2 justify-end">
							<Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
								Cancel
							</Button>
							<Button type="submit" size="sm" disabled={adding}>
								{adding ? "Adding..." : "Add"}
							</Button>
						</div>
					</form>
				)}

				{/* Student list */}
				{roster.length === 0 ? (
					<div className="rounded-lg border border-dashed border-border p-6 text-center">
						<p className="text-sm text-muted-foreground">
							No students yet. Add students above or import a CSV.
						</p>
					</div>
				) : (
					<div className="rounded-lg border border-border overflow-hidden">
						{roster.map((student, i) => (
							<div
								key={student.id}
								className={`flex items-center justify-between px-3 py-2.5 ${
									i !== roster.length - 1 ? "border-b border-border" : ""
								}`}
							>
								<div className="flex items-center gap-3">
									<span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
										{student.firstInitial}
										{student.lastInitial}
									</span>
									<div>
										<p className="text-sm font-medium text-foreground">
											{student.firstInitial}.{student.lastInitial}.
										</p>
										<p className="text-xs text-muted-foreground">ID: {student.studentId}</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => removeStudent(student.id)}
									className="text-muted-foreground hover:text-destructive transition-colors p-1"
									aria-label="Remove student"
								>
									<Trash2Icon className="h-3.5 w-3.5" />
								</button>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Groups */}
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<p className="text-sm font-semibold text-foreground">Groups</p>
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
					<div className="h-32 rounded-lg bg-muted/30 animate-pulse" />
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
		</div>
	);
}
