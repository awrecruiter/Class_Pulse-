export const dynamic = "force-dynamic";

// Increase body size limit to 10 MB for PDF uploads
export const maxDuration = 30;

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

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = sessionRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
	}

	const file = formData.get("file") as File | null;
	if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	if (!ALLOWED_EXTENSIONS.has(ext)) {
		return NextResponse.json({ error: "File type not supported" }, { status: 400 });
	}

	if (file.size > MAX_BYTES) {
		return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
	}

	const key = `resources/${data.user.id}/${crypto.randomUUID()}/${file.name}`;

	let presignedUrl: string;
	let objectUrl: string;
	try {
		({ presignedUrl, objectUrl } = presignPut(key, 60));
	} catch (err) {
		const msg = err instanceof Error ? err.message : "S3 not configured";
		return NextResponse.json({ error: msg }, { status: 503 });
	}

	// Upload from server → S3 (no CORS restriction)
	const bytes = await file.arrayBuffer();
	const uploadRes = await fetch(presignedUrl, {
		method: "PUT",
		body: bytes,
		headers: { "Content-Type": file.type || "application/octet-stream" },
	});

	if (!uploadRes.ok) {
		const text = await uploadRes.text().catch(() => "");
		console.error("[proxy-upload] S3 PUT failed:", uploadRes.status, text.slice(0, 200));
		return NextResponse.json({ error: "Storage upload failed" }, { status: 502 });
	}

	return NextResponse.json({ objectUrl });
}
