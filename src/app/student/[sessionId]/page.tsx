import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student";
import { db } from "@/lib/db";
import {
	classes,
	classSessions,
	comprehensionSignals,
	groupAccounts,
	groupMemberships,
	ramBuckAccounts,
	rosterEntries,
	studentGroups,
} from "@/lib/db/schema";
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
		.where(
			and(
				eq(comprehensionSignals.sessionId, sessionId),
				eq(comprehensionSignals.rosterId, payload.rosterId),
			),
		);

	// Load RAM Buck balance
	const [ramAccount] = await db
		.select({ balance: ramBuckAccounts.balance })
		.from(ramBuckAccounts)
		.where(
			and(
				eq(ramBuckAccounts.rosterId, payload.rosterId),
				eq(ramBuckAccounts.classId, session.classId),
			),
		);

	// Load group membership + group balance
	const [membershipRow] = await db
		.select({
			groupId: groupMemberships.groupId,
			groupName: studentGroups.name,
			groupEmoji: studentGroups.emoji,
		})
		.from(groupMemberships)
		.innerJoin(studentGroups, eq(groupMemberships.groupId, studentGroups.id))
		.where(
			and(
				eq(groupMemberships.rosterId, payload.rosterId),
				eq(groupMemberships.classId, session.classId),
			),
		);

	let groupBalance: number | null = null;
	if (membershipRow) {
		const [ga] = await db
			.select({ balance: groupAccounts.balance })
			.from(groupAccounts)
			.where(
				and(
					eq(groupAccounts.classId, session.classId),
					eq(groupAccounts.groupId, membershipRow.groupId),
				),
			);
		groupBalance = ga?.balance ?? null;
	}

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
			ramBalance={ramAccount?.balance ?? 0}
			groupBalance={groupBalance}
			groupName={membershipRow ? `${membershipRow.groupEmoji} ${membershipRow.groupName}` : null}
			joinCode={session.joinCode}
		/>
	);
}
