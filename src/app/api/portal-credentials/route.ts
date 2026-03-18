import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { portalCredentials } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/encryption";
import { credentialsRateLimiter } from "@/lib/rate-limit";

function getEncryptionSecret(): string {
	const secret =
		process.env.PORTAL_CREDENTIALS_ENCRYPTION_SECRET ?? process.env.NEON_AUTH_COOKIE_SECRET;
	if (!secret) throw new Error("No encryption secret configured for portal credentials");
	return secret;
}

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/portal-credentials          → list { portalKey, username }[] (no passwords)
// GET /api/portal-credentials?portalKey=iready → { credential: { portalKey, username, password } }
export async function GET(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = credentialsRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const portalKey = request.nextUrl.searchParams.get("portalKey");

	if (portalKey) {
		// Single credential fetch — includes decrypted password
		const [row] = await db
			.select()
			.from(portalCredentials)
			.where(
				and(
					eq(portalCredentials.teacherId, data.user.id),
					eq(portalCredentials.portalKey, portalKey),
				),
			);

		if (!row) {
			return NextResponse.json({ credential: null }, { headers: NO_STORE });
		}

		try {
			const secret = getEncryptionSecret();
			const password = decrypt(row.encryptedPassword, secret);
			return NextResponse.json(
				{ credential: { portalKey: row.portalKey, username: row.username, password } },
				{ headers: NO_STORE },
			);
		} catch {
			// Decrypt failure — likely secret rotation; return null so voice falls back to normal open
			return NextResponse.json(
				{ credential: null, error: "Credential decryption failed — please re-save" },
				{ headers: NO_STORE },
			);
		}
	}

	// List all credentials for this teacher (no passwords)
	const rows = await db
		.select({
			portalKey: portalCredentials.portalKey,
			username: portalCredentials.username,
		})
		.from(portalCredentials)
		.where(eq(portalCredentials.teacherId, data.user.id));

	return NextResponse.json({ credentials: rows }, { headers: NO_STORE });
}

const upsertSchema = z.object({
	portalKey: z.string().min(1).max(50),
	username: z.string().min(1).max(200),
	password: z.string().max(500).optional(),
});

// POST /api/portal-credentials — upsert credentials
// If password is blank and a row already exists, preserve the existing encrypted password
export async function POST(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = credentialsRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json();
	const result = upsertSchema.safeParse(body);
	if (!result.success)
		return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

	const { portalKey, username, password } = result.data;

	let encryptedPassword: string;

	if (password) {
		// Encrypt the new password
		let secret: string;
		try {
			secret = getEncryptionSecret();
		} catch {
			return NextResponse.json({ error: "Encryption not configured" }, { status: 500 });
		}
		encryptedPassword = encrypt(password, secret);
	} else {
		// No new password — preserve existing (username-only update)
		const [existing] = await db
			.select({ encryptedPassword: portalCredentials.encryptedPassword })
			.from(portalCredentials)
			.where(
				and(
					eq(portalCredentials.teacherId, data.user.id),
					eq(portalCredentials.portalKey, portalKey),
				),
			);

		if (!existing) {
			return NextResponse.json({ error: "Password required for new credential" }, { status: 400 });
		}
		encryptedPassword = existing.encryptedPassword;
	}

	const now = new Date();
	await db
		.insert(portalCredentials)
		.values({
			teacherId: data.user.id,
			portalKey,
			username,
			encryptedPassword,
		})
		.onConflictDoUpdate({
			target: [portalCredentials.teacherId, portalCredentials.portalKey],
			set: { username, encryptedPassword, updatedAt: now },
		});

	return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

// DELETE /api/portal-credentials?portalKey=iready
export async function DELETE(request: NextRequest) {
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = credentialsRateLimiter.check(ip);
	if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const portalKey = request.nextUrl.searchParams.get("portalKey");
	if (!portalKey) return NextResponse.json({ error: "portalKey required" }, { status: 400 });

	await db
		.delete(portalCredentials)
		.where(
			and(
				eq(portalCredentials.teacherId, data.user.id),
				eq(portalCredentials.portalKey, portalKey),
			),
		);

	return NextResponse.json({ ok: true });
}
