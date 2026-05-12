// Files are now served directly from S3 — this route is no longer used
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
	return NextResponse.json({ error: "Files are served directly from S3" }, { status: 410 });
}
