import { z } from "zod";

export const workspaceModeSchema = z.enum(["classroom", "distance", "homeschool"]);
export type WorkspaceMode = z.infer<typeof workspaceModeSchema>;
export const WORKSPACE_LABELS: Record<WorkspaceMode, string> = {
	classroom: "Classroom",
	distance: "Distance learning",
	homeschool: "Homeschool",
};
export function tutoringMode(value: string | undefined): "distance" | "homeschool" {
	return value === "homeschool" ? "homeschool" : "distance";
}
