export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { sessionRateLimiter } from "@/lib/rate-limit";
import { presignPut } from "@/lib/s3-presign";

const ALLOWED_EXTENSIONS = new Set([
	"pdf",
	"doc",
	"docx",
	"ppt",
	"pptx",
	"xls",
	"xlsx",
	"jpg",
	"jpeg",
	"png",
	"gif",
	"txt",
]);

export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const filename = searchParams.get("filename")?.trim() ?? "";
	if (!filename) return NextResponse.json({ error: "filename is required" }, { status: 400 });

	const ext = filename.split(".").pop()?.toLowerCase() ?? "";
	if (!ALLOWED_EXTENSIONS.has(ext))
		return NextResponse.json({ error: "File type not supported" }, { status: 400 });

	// Scoped under teacher's ID so files are never cross-accessible
	const key = `resources/${data.user.id}/${crypto.randomUUID()}/${filename}`;

	try {
		const { presignedUrl, objectUrl } = presignPut(key, 900);
		return NextResponse.json({ presignedUrl, objectUrl });
	} catch (err) {
		const message = err instanceof Error ? err.message : "S3 not configured";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}
