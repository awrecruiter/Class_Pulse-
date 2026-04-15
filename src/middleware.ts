import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const STUDENT_APP = process.env.STUDENT_APP === "true";

export function middleware(request: NextRequest) {
	// Student deployment: block all teacher routes
	if (STUDENT_APP) {
		return NextResponse.redirect(new URL("/student", request.url));
	}
	// Auth temporarily disabled for local dev
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
