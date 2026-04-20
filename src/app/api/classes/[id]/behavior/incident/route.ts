export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	behaviorIncidents,
	behaviorProfiles,
	classes,
	parentContacts,
	parentMessages,
	parentNotifications,
	ramBuckAccounts,
	ramBuckFeeSchedule,
	ramBuckTransactions,
	rosterEntries,
} from "@/lib/db/schema";
import { sessionRateLimiter, smsRateLimiter } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";

const DEFAULT_FEE_SCHEDULE = [
	{ step: 1, label: "Ram Buck Fine", deductionAmount: 5 },
	{ step: 2, label: "No Games", deductionAmount: 10 },
	{ step: 3, label: "No PE", deductionAmount: 15 },
	{ step: 4, label: "Silent Lunch", deductionAmount: 20 },
	{ step: 5, label: "Call Home", deductionAmount: 30 },
	{ step: 6, label: "Write Up", deductionAmount: 40 },
	{ step: 7, label: "Detention", deductionAmount: 60 },
	{ step: 8, label: "Saturday School", deductionAmount: 100 },
];

const STEP_LABELS = [
	"Ram Buck Fine",
	"No Games",
	"No PE",
	"Silent Lunch",
	"Call Home",
	"Write Up",
	"Detention",
	"Saturday School",
];

const incidentSchema = z.object({
	rosterId: z.string().uuid(),
	sessionId: z.string().uuid().optional(),
	notes: z.string().max(500).default(""),
});

async function verifyTeacherOwnsClass(classId: string, teacherId: string) {
	const [cls] = await db
		.select({ id: classes.id, teacherId: classes.teacherId })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)));
	return cls ?? null;
}

function generateParentMessage(
	step: number,
	stepLabel: string,
	studentInitials: string,
	classLabel: string,
	date: string,
): string {
	const stepMessages: Record<number, string> = {
		5: `Hello, this is a courtesy call regarding your child (${studentInitials}) in ${classLabel}. Today (${date}), your child received a "${stepLabel}" consequence for behavior concerns. Please discuss classroom expectations at home. Thank you for your continued support.`,
		6: `Dear parent/guardian of ${studentInitials}, I am reaching out regarding a formal write-up issued today (${date}) in ${classLabel}. The consequence level reached: "${stepLabel}". Please review the details with your child and feel free to contact me with questions.`,
		7: `Dear parent/guardian of ${studentInitials}, your child has been assigned detention as a result of today's (${date}) behavior in ${classLabel} (Step ${step}: "${stepLabel}"). Please ensure your child attends detention as scheduled. Thank you.`,
		8: `Dear parent/guardian of ${studentInitials}, this is a serious notification: your child (${studentInitials}) has been assigned Saturday School following today's (${date}) behavior in ${classLabel} (Step ${step}: "${stepLabel}"). Please contact the school office for details. Thank you.`,
	};

	return (
		stepMessages[step] ??
		`Regarding student ${studentInitials} in ${classLabel}: a consequence of "${stepLabel}" (Step ${step}) was issued on ${date}. Please contact the teacher for more information.`
	);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const cls = await verifyTeacherOwnsClass(classId, data.user.id);
	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await request.json();
	const result = incidentSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { rosterId, sessionId, notes } = result.data;

	// Verify rosterId belongs to this class
	const [rosterEntry] = await db
		.select({ id: rosterEntries.id })
		.from(rosterEntries)
		.where(and(eq(rosterEntries.id, rosterId), eq(rosterEntries.classId, classId)));
	if (!rosterEntry)
		return NextResponse.json({ error: "Student not found in class" }, { status: 404 });

	// Get teacher's fee schedule (or defaults) — read outside transaction
	const feeRows = await db
		.select()
		.from(ramBuckFeeSchedule)
		.where(eq(ramBuckFeeSchedule.teacherId, data.user.id));

	const feeMap = new Map(feeRows.map((r) => [r.step, r.deductionAmount]));

	// Variables populated inside transaction, used after for SMS
	let incident: typeof behaviorIncidents.$inferSelect;
	let updatedProfile: typeof behaviorProfiles.$inferSelect | undefined;
	let parentNotificationMessage: string | null = null;
	let parentNotificationId: string | null = null;
	let _newStep: number;
	let _deductionAmount: number;

	try {
		const txResult = await db.transaction(async (tx) => {
			// Get or create behavior profile
			const [profile] = await tx
				.insert(behaviorProfiles)
				.values({ classId, rosterId })
				.onConflictDoUpdate({
					target: [behaviorProfiles.classId, behaviorProfiles.rosterId],
					set: { updatedAt: new Date() },
				})
				.returning();

			if (!profile) throw new Error("Failed to get behavior profile");

			// C12: Compute step server-side — always increment by 1, max 8
			const computedStep = Math.min(profile.currentStep + 1, 8);
			const stepLabel = STEP_LABELS[computedStep - 1] ?? `Step ${computedStep}`;

			const defaultFee = DEFAULT_FEE_SCHEDULE.find((d) => d.step === computedStep);
			const fee = feeMap.get(computedStep) ?? defaultFee?.deductionAmount ?? 0;

			// Insert incident
			const [newIncident] = await tx
				.insert(behaviorIncidents)
				.values({
					classId,
					rosterId,
					sessionId: sessionId ?? null,
					step: computedStep,
					label: stepLabel,
					notes,
					ramBuckDeduction: fee,
				})
				.returning();

			if (!newIncident) throw new Error("Failed to insert incident");

			// Update behavior profile
			const [updProfile] = await tx
				.update(behaviorProfiles)
				.set({
					currentStep: computedStep,
					lastIncidentAt: new Date(),
					updatedAt: new Date(),
				})
				.where(and(eq(behaviorProfiles.classId, classId), eq(behaviorProfiles.rosterId, rosterId)))
				.returning();

			// Deduct RAM bucks if applicable
			if (fee > 0) {
				const [account] = await tx
					.insert(ramBuckAccounts)
					.values({ classId, rosterId })
					.onConflictDoUpdate({
						target: [ramBuckAccounts.classId, ramBuckAccounts.rosterId],
						set: { updatedAt: new Date() },
					})
					.returning();

				if (account) {
					const newBalance = Math.max(0, account.balance - fee);
					await tx
						.update(ramBuckAccounts)
						.set({ balance: newBalance, updatedAt: new Date() })
						.where(
							and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)),
						);

					await tx.insert(ramBuckTransactions).values({
						classId,
						rosterId,
						sessionId: sessionId ?? null,
						type: "behavior-fine",
						amount: -fee,
						reason: `Behavior consequence: ${stepLabel} (Step ${computedStep})`,
					});
				}
			}

			// Generate parent notification for step >= 5
			let notification: typeof parentNotifications.$inferSelect | undefined;

			if (computedStep >= 5) {
				const [student] = await tx
					.select({
						firstInitial: rosterEntries.firstInitial,
						lastInitial: rosterEntries.lastInitial,
					})
					.from(rosterEntries)
					.where(eq(rosterEntries.id, rosterId));

				const studentInitials = student
					? `${student.firstInitial}.${student.lastInitial}.`
					: "your child";
				const date = new Date().toLocaleDateString("en-US", {
					month: "long",
					day: "numeric",
					year: "numeric",
				});

				const [classData] = await tx
					.select({ label: classes.label })
					.from(classes)
					.where(eq(classes.id, classId));

				const classLabel = classData?.label ?? "class";
				const message = generateParentMessage(
					computedStep,
					stepLabel,
					studentInitials,
					classLabel,
					date,
				);

				const [notif] = await tx
					.insert(parentNotifications)
					.values({
						classId,
						rosterId,
						incidentId: newIncident.id,
						message,
						step: computedStep,
					})
					.returning();

				notification = notif;
			}

			return {
				incident: newIncident,
				updatedProfile: updProfile,
				notification,
				computedStep,
				fee,
				stepLabel,
			};
		});

		incident = txResult.incident;
		updatedProfile = txResult.updatedProfile;
		_newStep = txResult.computedStep;
		_deductionAmount = txResult.fee;

		if (txResult.notification) {
			parentNotificationMessage = txResult.notification.message;
			parentNotificationId = txResult.notification.id;
		}
	} catch (err) {
		console.error("[incident] transaction failed:", err);
		return NextResponse.json({ error: "Failed to record incident" }, { status: 500 });
	}

	// SMS send OUTSIDE transaction — network call, cannot roll back
	let smsAutoResult: { sent: boolean; reason: string | null } = { sent: false, reason: null };
	let parentMessage: { message: string; notificationId: string } | null = null;

	if (parentNotificationMessage && parentNotificationId) {
		parentMessage = { message: parentNotificationMessage, notificationId: parentNotificationId };

		try {
			const smsAllowed = smsRateLimiter.check(ip).success;
			if (!smsAllowed) {
				console.warn(
					"[incident] smsRateLimiter exceeded skipping auto SMS for incident",
					incident.id,
				);
				await db.insert(parentMessages).values({
					classId,
					rosterId,
					incidentId: incident.id,
					phone: "",
					body: parentNotificationMessage,
					triggeredBy: "incident",
					status: "failed",
					smsSid: null,
				});
				smsAutoResult = { sent: false, reason: "rate_limited" };
			} else {
				const [contact] = await db
					.select({ phone: parentContacts.phone })
					.from(parentContacts)
					.where(
						and(
							eq(parentContacts.classId, classId),
							eq(parentContacts.rosterId, rosterId),
							eq(parentContacts.isActive, true),
						),
					);

				if (!contact) {
					await db.insert(parentMessages).values({
						classId,
						rosterId,
						incidentId: incident.id,
						phone: "",
						body: parentNotificationMessage,
						triggeredBy: "incident",
						status: "no_number",
						smsSid: null,
					});
					smsAutoResult = { sent: false, reason: "no_number" };
				} else {
					const smsResult = await sendSms(contact.phone, parentNotificationMessage);
					if (!smsResult.ok) {
						console.error("[incident] SMS send failed for incident", incident.id, smsResult.error);
					}
					await db.insert(parentMessages).values({
						classId,
						rosterId,
						incidentId: incident.id,
						phone: contact.phone,
						body: parentNotificationMessage,
						triggeredBy: "incident",
						status: smsResult.ok ? "sent" : "failed",
						smsSid: smsResult.sid ?? null,
					});
					smsAutoResult = { sent: smsResult.ok, reason: smsResult.error ?? null };
				}
			}
		} catch (smsErr) {
			// SMS block must NEVER crash the behavior ladder
			console.error("[incident] SMS/parentMessages block threw continuing:", smsErr);
			smsAutoResult = { sent: false, reason: "internal_error" };
		}
	}

	return NextResponse.json({
		incident,
		profile: updatedProfile,
		parentMessage,
		smsAutoResult,
	});
}
