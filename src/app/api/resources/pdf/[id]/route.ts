export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { lessonResourceFiles } from "@/lib/db/schema";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const [row] = await db
		.select()
		.from(lessonResourceFiles)
		.where(eq(lessonResourceFiles.id, id))
		.limit(1);

	if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

	if (row.teacherId !== data.user.id)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	// row.data is a Buffer (Postgres driver). Copy bytes into a plain ArrayBuffer for BodyInit compat.
	const src = row.data as unknown as Uint8Array;
	const ab = new ArrayBuffer(src.byteLength);
	new Uint8Array(ab).set(src);
	return new Response(ab, {
		headers: {
			"Content-Type": row.mimeType,
			"Content-Disposition": `inline; filename="${encodeURIComponent(row.filename)}"`,
			"Cache-Control": "private, max-age=3600",
		},
	});
}
