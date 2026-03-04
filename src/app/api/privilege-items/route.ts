import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { privilegeItems } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const DEFAULT_PRIVILEGE_ITEMS = [
	{ name: "Brain Break", cost: 15, durationMinutes: 10, sortOrder: 0 },
	{ name: "Library Time", cost: 30, durationMinutes: 20, sortOrder: 1 },
	{ name: "Outdoor Recess", cost: 25, durationMinutes: 15, sortOrder: 2 },
	{ name: "Computer Time", cost: 20, durationMinutes: 20, sortOrder: 3 },
	{ name: "Phone Time", cost: 40, durationMinutes: 10, sortOrder: 4 },
	{ name: "Class Game", cost: 20, durationMinutes: 15, sortOrder: 5 },
];

const createItemSchema = z.object({
	name: z.string().min(1).max(100),
	cost: z.number().int().min(0).max(10000),
	durationMinutes: z.number().int().min(1).max(300).optional(),
});

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const items = await db
		.select()
		.from(privilegeItems)
		.where(and(eq(privilegeItems.teacherId, data.user.id), eq(privilegeItems.isActive, true)))
		.orderBy(privilegeItems.sortOrder);

	// Seed defaults on first use
	if (items.length === 0) {
		const seeded = await db
			.insert(privilegeItems)
			.values(DEFAULT_PRIVILEGE_ITEMS.map((item) => ({ ...item, teacherId: data.user.id })))
			.returning();
		return NextResponse.json({ items: seeded.sort((a, b) => a.sortOrder - b.sortOrder) });
	}

	return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = createItemSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	// Get current max sort order
	const existing = await db
		.select({ sortOrder: privilegeItems.sortOrder })
		.from(privilegeItems)
		.where(eq(privilegeItems.teacherId, data.user.id))
		.orderBy(privilegeItems.sortOrder);

	const maxSortOrder = existing.length > 0 ? Math.max(...existing.map((e) => e.sortOrder)) + 1 : 0;

	const [item] = await db
		.insert(privilegeItems)
		.values({
			teacherId: data.user.id,
			name: result.data.name,
			cost: result.data.cost,
			durationMinutes: result.data.durationMinutes ?? null,
			sortOrder: maxSortOrder,
		})
		.returning();

	return NextResponse.json({ item }, { status: 201 });
}
