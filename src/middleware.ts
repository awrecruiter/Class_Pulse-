import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const STUDENT_APP = process.env.STUDENT_APP === "true";
const DEV_BYPASS = process.env.ALLOW_DEV_AUTH_BYPASS === "true";

export function middleware(request: NextRequest) {
	// Student deployment: block all teacher routes
	if (STUDENT_APP) {
		return NextResponse.redirect(new URL("/student", request.url));
	}

	// Dev bypass — local development without a real Neon Auth session
	if (DEV_BYPASS) {
		return NextResponse.next();
	}

	// Require a Neon Auth session cookie (covers both __Secure-neon-auth.* in prod
	// and plain neon-auth.* in non-HTTPS dev environments)
	const hasSession = request.cookies.getAll().some((c) => c.name.includes("neon-auth"));
	if (!hasSession) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("next", request.nextUrl.pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	// Only protect page routes — all API routes handle their own auth internally.
	// Putting API routes here causes the middleware to redirect API callers to the
	// HTML login page instead of returning 401, which breaks student routes that
	// use student-cookie auth instead of Neon Auth.
	matcher: [
		"/coach",
		"/coach/:path*",
		"/classes",
		"/classes/:path*",
		"/editor",
		"/editor/:path*",
		"/gradebook",
		"/gradebook/:path*",
		"/pacing",
		"/pacing/:path*",
		"/resources",
		"/resources/:path*",
		"/settings",
		"/board",
		"/parent-comms",
		"/parent-comms/:path*",
	],
};
