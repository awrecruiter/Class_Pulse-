// File uploads now use the presigned S3 flow — see /api/resources/pdf/presign
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function POST() {
	return NextResponse.json(
		{ error: "Use GET /api/resources/pdf/presign to get an upload URL" },
		{ status: 410 },
	);
}
