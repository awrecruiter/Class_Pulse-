import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
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
	],
};
