export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { lessonResourceFiles } from "@/lib/db/schema";
import { sessionRateLimiter } from "@/lib/rate-limit";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"image/jpeg",
	"image/png",
	"image/gif",
	"text/plain",
]);

const ALLOWED_EXTENSIONS = new Set([
	".pdf",
	".doc",
	".docx",
	".ppt",
	".pptx",
	".xls",
	".xlsx",
	".jpg",
	".jpeg",
	".png",
	".gif",
	".txt",
]);

function isAllowedFile(file: File): boolean {
	if (ALLOWED_TYPES.has(file.type)) return true;
	const parts = file.name.toLowerCase().split(".");
	const ext = parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
	return ALLOWED_EXTENSIONS.has(ext);
}

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
	if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

	if (!isAllowedFile(file))
		return NextResponse.json({ error: "File type not supported" }, { status: 400 });

	if (file.size > MAX_SIZE)
		return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });

	const buffer = Buffer.from(await file.arrayBuffer());
	const mimeType = ALLOWED_TYPES.has(file.type) ? file.type : "application/octet-stream";

	const [row] = await db
		.insert(lessonResourceFiles)
		.values({
			teacherId: data.user.id,
			filename: file.name,
			mimeType,
			data: buffer,
		})
		.returning({ id: lessonResourceFiles.id });

	return NextResponse.json({ url: `/api/resources/pdf/${row.id}` });
}
