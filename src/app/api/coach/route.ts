import { type NextRequest, NextResponse } from "next/server";
import { getScaffold } from "@/lib/ai/coach";
import { auth } from "@/lib/auth/server";
import { coachRateLimiter } from "@/lib/rate-limit";

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

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { lessonTranscript, studentQuery } = body as Record<string, unknown>;

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
		const response = await getScaffold({ lessonTranscript, studentQuery });
		return NextResponse.json(response);
	} catch (err) {
		console.error("[coach] AI error:", err);
		return NextResponse.json({ error: "AI service error. Please try again." }, { status: 500 });
	}
}
