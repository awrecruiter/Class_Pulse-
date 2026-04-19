export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { type CoachRequest, getScaffold } from "@/lib/ai/coach";
import { auth } from "@/lib/auth/server";
import { coachRateLimiter } from "@/lib/rate-limit";
import { isSurfaceEnabledForUser } from "@/lib/subscription/gates";

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = coachRateLimiter.check(ip);
	if (!success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const { data } = await auth.getSession();
	if (!data?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const isEnabled = await isSurfaceEnabledForUser(data.user.id, "instructional_coach");
	if (!isEnabled) {
		return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { lessonTranscript, studentQuery, pinnedStandards, priorAttempts, scaffoldGrade } =
		body as Record<string, unknown>;

	if (typeof studentQuery !== "string" || studentQuery.trim().length === 0) {
		return NextResponse.json({ error: "studentQuery is required" }, { status: 400 });
	}

	if (typeof lessonTranscript !== "string") {
		return NextResponse.json({ error: "lessonTranscript must be a string" }, { status: 400 });
	}

	if (studentQuery.length > 2000) {
		return NextResponse.json({ error: "studentQuery too long (max 2000 chars)" }, { status: 400 });
	}

	if (lessonTranscript.length > 20000) {
		return NextResponse.json(
			{ error: "lessonTranscript too long (max 20000 chars)" },
			{ status: 400 },
		);
	}

	try {
		const response = await getScaffold({
			lessonTranscript: lessonTranscript as string,
			studentQuery: studentQuery as string,
			pinnedStandards: Array.isArray(pinnedStandards) ? (pinnedStandards as string[]) : [],
			priorAttempts: Array.isArray(priorAttempts)
				? (priorAttempts as CoachRequest["priorAttempts"])
				: undefined,
			scaffoldGrade:
				typeof scaffoldGrade === "number" &&
				Number.isInteger(scaffoldGrade) &&
				scaffoldGrade >= 0 &&
				scaffoldGrade <= 5
					? scaffoldGrade
					: undefined,
		});
		return NextResponse.json(response);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "AI service error";
		console.error("[coach] AI error:", msg);
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
