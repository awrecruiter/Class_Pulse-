import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
	behaviorIncidents,
	behaviorProfiles,
	cfuEntries,
	classes,
	masteryRecords,
	parentContacts,
	parentMessages,
	rosterEntries,
} from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms";
import { isSurfaceEnabledForUser } from "@/lib/subscription/gates";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const guidanceSchema = z.object({
	rosterId: z.string().uuid(),
	classId: z.string().uuid(),
	sendSms: z.boolean().default(false),
});

export type GuidanceResult = {
	talkingPoints: string[];
	practiceGuidance: string;
	parentMessageDraft: string;
	smsSent?: boolean;
	smsError?: string;
};

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const isEnabled = await isSurfaceEnabledForUser(data.user.id, "instructional_coach");
	if (!isEnabled) {
		return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
	}

	const body = await request.json();
	const result = guidanceSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { rosterId, classId, sendSms: shouldSend } = result.data;

	// Verify teacher owns the class
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, data.user.id)));
	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	// Fetch student context (initials only — no full names in AI calls)
	const [student] = await db
		.select({ firstInitial: rosterEntries.firstInitial, lastInitial: rosterEntries.lastInitial })
		.from(rosterEntries)
		.where(eq(rosterEntries.id, rosterId));
	if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

	const initials = `${student.firstInitial}.${student.lastInitial}.`;

	const [masteryData, cfuData, behaviorProfile, recentIncidents] = await Promise.all([
		db
			.select({ standardCode: masteryRecords.standardCode, status: masteryRecords.status })
			.from(masteryRecords)
			.where(eq(masteryRecords.rosterId, rosterId))
			.orderBy(desc(masteryRecords.updatedAt))
			.limit(10),
		db
			.select({
				standardCode: cfuEntries.standardCode,
				score: cfuEntries.score,
				date: cfuEntries.date,
			})
			.from(cfuEntries)
			.where(and(eq(cfuEntries.classId, classId), eq(cfuEntries.rosterId, rosterId)))
			.orderBy(desc(cfuEntries.createdAt))
			.limit(10),
		db
			.select({
				currentStep: behaviorProfiles.currentStep,
				teacherNotes: behaviorProfiles.teacherNotes,
			})
			.from(behaviorProfiles)
			.where(and(eq(behaviorProfiles.classId, classId), eq(behaviorProfiles.rosterId, rosterId)))
			.limit(1),
		db
			.select({
				step: behaviorIncidents.step,
				label: behaviorIncidents.label,
				createdAt: behaviorIncidents.createdAt,
			})
			.from(behaviorIncidents)
			.where(and(eq(behaviorIncidents.classId, classId), eq(behaviorIncidents.rosterId, rosterId)))
			.orderBy(desc(behaviorIncidents.createdAt))
			.limit(5),
	]);

	const masteredStandards = masteryData
		.filter((m) => m.status === "mastered")
		.map((m) => m.standardCode);
	const workingStandards = masteryData
		.filter((m) => m.status === "working")
		.map((m) => m.standardCode);
	const avgCfu =
		cfuData.length > 0
			? (cfuData.reduce((s, c) => s + c.score, 0) / cfuData.length).toFixed(1)
			: "N/A";
	const behaviorStep = behaviorProfile[0]?.currentStep ?? 0;

	const context = `Student: ${initials} (anonymous ID)
Mastered standards: ${masteredStandards.join(", ") || "none yet"}
Working on standards: ${workingStandards.join(", ") || "none"}
Average CFU score: ${avgCfu}/4 (${cfuData.length} entries)
Current behavior step: ${behaviorStep}/8
Recent incidents: ${recentIncidents.map((i) => `Step ${i.step} (${i.label})`).join(", ") || "none"}`;

	const SYSTEM = `You are a child-psychology-aware academic advisor helping a 5th grade Florida math teacher prepare for a parent conference. Based on the student data provided (no full names, initials only), generate:
1. 3-5 specific, evidence-based talking points for the parent conference
2. 2-3 sentences of concrete at-home practice suggestions
3. A 3-4 sentence professional parent message draft

Return ONLY valid JSON:
{
  "talkingPoints": ["point 1", "point 2", ...],
  "practiceGuidance": "...",
  "parentMessageDraft": "..."
}

Be specific, constructive, and solution-focused. Never use the student's name — use "your child" instead. Never shame or blame the student.`;

	try {
		const message = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 800,
			system: SYSTEM,
			messages: [{ role: "user", content: context }],
		});

		const text = message.content[0]?.type === "text" ? message.content[0].text : "";
		const parsed = JSON.parse(text) as {
			talkingPoints: string[];
			practiceGuidance: string;
			parentMessageDraft: string;
		};

		const guidance: GuidanceResult = { ...parsed };

		// Optionally send SMS
		if (shouldSend) {
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

			if (contact) {
				const smsResult = await sendSms(contact.phone, parsed.parentMessageDraft);
				guidance.smsSent = smsResult.ok;
				guidance.smsError = smsResult.error;

				await db.insert(parentMessages).values({
					classId,
					rosterId,
					phone: contact.phone,
					body: parsed.parentMessageDraft,
					triggeredBy: "academic-guidance",
					status: smsResult.ok ? "sent" : "failed",
					smsSid: smsResult.sid ?? null,
				});
			} else {
				guidance.smsSent = false;
				guidance.smsError = "No parent contact on file";
			}
		}

		return NextResponse.json(guidance);
	} catch {
		return NextResponse.json({ error: "Failed to generate guidance" }, { status: 500 });
	}
}
