import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classAssignments, classes } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const bodySchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	content: z.string().min(1).max(500),
});

async function getTeacherClass(classId: string, userId: string) {
	const [cls] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(and(eq(classes.id, classId), eq(classes.teacherId, userId)));
	return cls ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const cls = await getTeacherClass(classId, data.user.id);
	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

	const [row] = await db
		.select({ content: classAssignments.content, date: classAssignments.date })
		.from(classAssignments)
		.where(and(eq(classAssignments.classId, classId), eq(classAssignments.date, date)));

	return NextResponse.json({ assignment: row ?? null });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id: classId } = await params;
	const cls = await getTeacherClass(classId, data.user.id);
	if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await req.json();
	const result = bodySchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
	}

	const { date, content } = result.data;

	await db
		.insert(classAssignments)
		.values({ classId, teacherId: data.user.id, date, content })
		.onConflictDoUpdate({
			target: [classAssignments.classId, classAssignments.date],
			set: { content, updatedAt: new Date() },
		});

	return NextResponse.json({ ok: true });
}
