import type { WorkspaceMode } from "./workspace-mode";
export function workspaceStorageKeys(mode: WorkspaceMode = "classroom") {
	const prefix = mode === "classroom" ? "" : `pulse:${mode}:`;
	return {
		classId: `${prefix}activeClassId`,
		sessionId: `${prefix}activeSessionId`,
		sessionDate: `${prefix}activeSessionDate`,
		boardClassId: `${prefix}board-class-id`,
	};
}
