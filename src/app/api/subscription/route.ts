export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { sessionRateLimiter } from "@/lib/rate-limit";
import { getEnabledSurfacesForUser } from "@/lib/subscription";

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	if (!sessionRateLimiter.check(ip).success)
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const enabledSurfaces = await getEnabledSurfacesForUser(data.user.id);
	return NextResponse.json({ enabledSurfaces });
}
