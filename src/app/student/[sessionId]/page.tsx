import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import { classes, classSessions, comprehensionSignals, rosterEntries } from "@/lib/db/schema";
import { StudentSession } from "./student-session";

export default async function StudentSessionPage({
	params,
}: {
	params: Promise<{ sessionId: string }>;
}) {
	const { sessionId } = await params;
	const cookieStore = await cookies();
	const token = cookieStore.get(STUDENT_COOKIE)?.value;

	if (!token) redirect("/student");

	const payload = verifyStudentToken(token);
	if (!payload || payload.sessionId !== sessionId) redirect("/student");

	const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId));

	if (!session) redirect("/student");

	const [cls] = await db.select().from(classes).where(eq(classes.id, session.classId));

	const [entry] = await db
		.select()
		.from(rosterEntries)
		.where(eq(rosterEntries.id, payload.rosterId));

	// Load current signal if any
	const [signalRow] = await db
		.select({ signal: comprehensionSignals.signal })
		.from(comprehensionSignals)
		.where(eq(comprehensionSignals.rosterId, payload.rosterId));

	const displayName = entry ? `${entry.firstInitial}.${entry.lastInitial}.` : "Student";
	const classLabel = cls?.label ?? "Class";
	const isActive = session.status === "active";

	return (
		<StudentSession
			sessionId={sessionId}
			displayName={displayName}
			classLabel={classLabel}
			isActive={isActive}
			studentId={entry?.studentId ?? ""}
			initialSignal={(signalRow?.signal as "got-it" | "almost" | "lost" | null) ?? null}
		/>
	);
}
