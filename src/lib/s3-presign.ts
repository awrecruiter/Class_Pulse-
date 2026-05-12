import crypto from "node:crypto";

// ─── Minimal SigV4 presigned PUT for S3 (no SDK) ─────────────────────────────
// Same signing approach as src/lib/sms.ts — raw HMAC-SHA256, no dependencies.

function hmac(key: Buffer | string, data: string, encoding?: "hex"): Buffer | string {
	const h = crypto.createHmac("sha256", key).update(data);
	return encoding ? h.digest(encoding) : h.digest();
}

function sha256hex(data: string): string {
	return crypto.createHash("sha256").update(data).digest("hex");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a presigned S3 PUT URL.  The file is uploaded directly from the
 * browser to S3, so it never passes through the Next.js / Vercel server —
 * no 4.5 MB payload limit applies.
 *
 * Requirements:
 *   - AWS_S3_BUCKET   — bucket name
 *   - AWS_REGION      — e.g. "us-east-1"
 *   - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY — IAM creds with s3:PutObject
 *
 * The S3 bucket must have a CORS rule allowing PUT from your app's origin.
 */
export function presignPut(
	key: string,
	expiresIn = 900,
): { presignedUrl: string; objectUrl: string } {
	const bucket = process.env.AWS_S3_BUCKET;
	const region = process.env.AWS_REGION ?? "us-east-1";
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

	if (!bucket || !accessKeyId || !secretAccessKey) {
		throw new Error(
			"AWS S3 not configured — set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
		);
	}

	const now = new Date();
	const amzDate = now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
	const dateStamp = amzDate.slice(0, 8);

	const host = `${bucket}.s3.${region}.amazonaws.com`;

	// URI-encode each path segment individually (S3 requirement)
	const encodedKey = key
		.split("/")
		.map((seg) => encodeURIComponent(seg))
		.join("/");

	const credential = `${accessKeyId}/${dateStamp}/${region}/s3/aws4_request`;

	// Auth params go in query string for presigned URLs (sorted alphabetically)
	const params: [string, string][] = [
		["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
		["X-Amz-Credential", credential],
		["X-Amz-Date", amzDate],
		["X-Amz-Expires", String(expiresIn)],
		["X-Amz-SignedHeaders", "host"],
	].sort(([a], [b]) => a.localeCompare(b)) as [string, string][];

	const queryString = params
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join("&");

	// Canonical request — payload is UNSIGNED-PAYLOAD for presigned PUT
	const canonicalRequest = [
		"PUT",
		`/${encodedKey}`,
		queryString,
		`host:${host}\n`,
		"host",
		"UNSIGNED-PAYLOAD",
	].join("\n");

	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256hex(canonicalRequest),
	].join("\n");

	const signingKey = hmac(
		hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), "s3"),
		"aws4_request",
	) as Buffer;
	const signature = hmac(signingKey, stringToSign, "hex") as string;

	const presignedUrl = `https://${host}/${encodedKey}?${queryString}&X-Amz-Signature=${signature}`;
	const objectUrl = `https://${host}/${encodedKey}`;

	return { presignedUrl, objectUrl };
}
