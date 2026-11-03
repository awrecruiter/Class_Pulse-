import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { OrientationManager } from "@/components/orientation/orientation-manager";
import { QuizRoom } from "@/components/tutoring/quiz-room";
import styles from "@/components/tutoring/workspace.module.css";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes, classSessions, rosterEntries } from "@/lib/db/schema";
import { WORKSPACE_LABELS } from "@/lib/workspace-mode";

export default async function LearningSpacePage({ params }: { params: Promise<{ id: string }> }) {
	const { data } = await auth.getSession();
	if (!data?.user) redirect("/login?next=/tutoring");
	const { id } = await params;
	if (!z.uuid().safeParse(id).success) notFound();
	const [space] = await db
		.select()
		.from(classes)
		.where(
			and(eq(classes.id, id), eq(classes.teacherId, data.user.id), eq(classes.isArchived, false)),
		);
	if (!space || (space.workspaceMode !== "distance" && space.workspaceMode !== "homeschool"))
		notFound();
	const [session] = await db
		.select({ id: classSessions.id, joinCode: classSessions.joinCode })
		.from(classSessions)
		.where(and(eq(classSessions.classId, id), eq(classSessions.status, "active")));
	const learners = await db
		.select({ id: rosterEntries.id })
		.from(rosterEntries)
		.where(and(eq(rosterEntries.classId, id), eq(rosterEntries.isActive, true)));
	return (
		<>
			<Link className={styles.secondary} href={`/tutoring?mode=${space.workspaceMode}`}>
				← Your learning spaces
			</Link>
			<header className={styles.header}>
				<span className={styles.badge}>{WORKSPACE_LABELS[space.workspaceMode]}</span>
				<h1 className="mt-4">{space.label}</h1>
				<p>
					{learners.length} learner{learners.length === 1 ? "" : "s"} ·{" "}
					{space.subject || "Learning"}
					{space.gradeLevel ? ` · Level ${space.gradeLevel}` : " · Any grade"}
				</p>
			</header>
			<QuizRoom classId={id} initialSession={session ?? null} />
			<section id="family-orientation" className={styles.manager}>
				<OrientationManager classId={id} previewLinks bookingSettingsHref="/tutoring/settings" />
			</section>
		</>
	);
}
