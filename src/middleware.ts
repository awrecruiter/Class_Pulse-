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
	matcher: [
		"/coach",
		"/coach/:path*",
		"/classes",
		"/classes/:path*",
		"/editor",
		"/editor/:path*",
		"/gradebook",
		"/gradebook/:path*",
		"/api/classes/:path*",
		"/api/sessions/:path*",
		"/api/teacher-settings/:path*",
		"/api/privilege-items/:path*",
		"/settings",
		"/api/coach/:path*",
		"/board",
		"/parent-comms",
		"/parent-comms/:path*",
	],
};
