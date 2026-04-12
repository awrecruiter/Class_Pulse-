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
	step: z.number().int().min(1).max(8).optional(),
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

	// Get or create behavior profile
	let [profile] = await db
		.insert(behaviorProfiles)
		.values({ classId, rosterId })
		.onConflictDoUpdate({
			target: [behaviorProfiles.classId, behaviorProfiles.rosterId],
			set: { updatedAt: new Date() },
		})
		.returning();

	if (!profile)
		return NextResponse.json({ error: "Failed to get behavior profile" }, { status: 500 });

	// Determine step
	const newStep = result.data.step ?? Math.min(profile.currentStep + 1, 8);
	const stepLabel = STEP_LABELS[newStep - 1] ?? `Step ${newStep}`;

	// Get teacher\'s fee schedule (or defaults)
	const feeRows = await db
		.select()
		.from(ramBuckFeeSchedule)
		.where(eq(ramBuckFeeSchedule.teacherId, data.user.id));

	const feeMap = new Map(feeRows.map((r) => [r.step, r.deductionAmount]));
	const defaultFee = DEFAULT_FEE_SCHEDULE.find((d) => d.step === newStep);
	const deductionAmount = feeMap.get(newStep) ?? defaultFee?.deductionAmount ?? 0;

	// Insert incident
	const [incident] = await db
		.insert(behaviorIncidents)
		.values({
			classId,
			rosterId,
			sessionId: sessionId ?? null,
			step: newStep,
			label: stepLabel,
			notes,
			ramBuckDeduction: deductionAmount,
		})
		.returning();

	if (!incident) return NextResponse.json({ error: "Failed to insert incident" }, { status: 500 });

	// Update behavior profile
	const [updatedProfile] = await db
		.update(behaviorProfiles)
		.set({
			currentStep: newStep,
			lastIncidentAt: new Date(),
			updatedAt: new Date(),
		})
		.where(and(eq(behaviorProfiles.classId, classId), eq(behaviorProfiles.rosterId, rosterId)))
		.returning();

	// Deduct RAM bucks if applicable
	if (deductionAmount > 0) {
		// Upsert account first
		const [account] = await db
			.insert(ramBuckAccounts)
			.values({ classId, rosterId })
			.onConflictDoUpdate({
				target: [ramBuckAccounts.classId, ramBuckAccounts.rosterId],
				set: { updatedAt: new Date() },
			})
			.returning();

		if (account) {
			const newBalance = Math.max(0, account.balance - deductionAmount);
			await db
				.update(ramBuckAccounts)
				.set({ balance: newBalance, updatedAt: new Date() })
				.where(and(eq(ramBuckAccounts.classId, classId), eq(ramBuckAccounts.rosterId, rosterId)));

			await db.insert(ramBuckTransactions).values({
				classId,
				rosterId,
				sessionId: sessionId ?? null,
				type: "behavior-fine",
				amount: -deductionAmount,
				reason: `Behavior consequence: ${stepLabel} (Step ${newStep})`,
			});
		}
	}

	// Generate parent notification for step >= 5
	let parentMessage: { message: string; notificationId: string } | null = null;
	let smsAutoResult: { sent: boolean; reason: string | null } = { sent: false, reason: null };

	if (newStep >= 5) {
		// Get student initials
		const [student] = await db
			.select({ firstInitial: rosterEntries.firstInitial, lastInitial: rosterEntries.lastInitial })
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

		// Get class label from already-verified class query
		const [classData] = await db
			.select({ label: classes.label })
			.from(classes)
			.where(eq(classes.id, classId));

		const classLabel = classData?.label ?? "class";
		const message = generateParentMessage(newStep, stepLabel, studentInitials, classLabel, date);

		const [notification] = await db
			.insert(parentNotifications)
			.values({
				classId,
				rosterId,
				incidentId: incident.id,
				message,
				step: newStep,
			})
			.returning();

		if (notification) {
			parentMessage = { message: notification.message, notificationId: notification.id };

			// Auto-send SMS if parent contact on file wrapped so SMS never crashes the behavior ladder
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
						body: message,
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
						// No contact on file log for audit trail
						await db.insert(parentMessages).values({
							classId,
							rosterId,
							incidentId: incident.id,
							phone: "",
							body: message,
							triggeredBy: "incident",
							status: "no_number",
							smsSid: null,
						});
						smsAutoResult = { sent: false, reason: "no_number" };
					} else {
						const smsResult = await sendSms(contact.phone, message);
						if (!smsResult.ok) {
							console.error(
								"[incident] SMS send failed for incident",
								incident.id,
								smsResult.error,
							);
						}
						await db.insert(parentMessages).values({
							classId,
							rosterId,
							incidentId: incident.id,
							phone: contact.phone,
							body: message,
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
	}

	profile = updatedProfile ?? profile;

	return NextResponse.json({
		incident,
		profile: updatedProfile,
		parentMessage,
		smsAutoResult,
	});
}
