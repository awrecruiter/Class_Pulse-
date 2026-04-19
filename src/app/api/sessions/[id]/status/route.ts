export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classSessions } from "@/lib/db/schema";

// Lightweight public endpoint — students poll this to detect when a session goes live.
// No auth required: only exposes { active: boolean }, no sensitive data.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const [session] = await db
		.select({ status: classSessions.status })
		.from(classSessions)
		.where(eq(classSessions.id, id));

	if (!session) return NextResponse.json({ active: false }, { status: 404 });

	return NextResponse.json({ active: session.status === "active" });
}
