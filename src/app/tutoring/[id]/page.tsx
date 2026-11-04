import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { TutoringDesk } from "@/components/tutoring/tutoring-desk";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes } from "@/lib/db/schema";

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
	return <TutoringDesk key={id} workspaceMode={space.workspaceMode} initialClassId={id} />;
}
