export const dynamic = "force-dynamic";

// One-time setup endpoint: configures S3 bucket CORS to allow browser PUT uploads.
// GET /api/admin/setup-s3-cors  (authenticated, idempotent)

import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

function hmac(key: Buffer | string, data: string, encoding?: "hex"): Buffer | string {
	const h = crypto.createHmac("sha256", key).update(data);
	return encoding ? h.digest(encoding) : h.digest();
}

function sha256hex(data: string): string {
	return crypto.createHash("sha256").update(data).digest("hex");
}

function md5base64(data: string): string {
	return crypto.createHash("md5").update(data).digest("base64");
}

export async function GET(_request: NextRequest) {
	const { data } = await auth.getSession();
	if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const bucket = process.env.AWS_S3_BUCKET;
	const region = process.env.AWS_REGION ?? "us-east-1";
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

	if (!bucket || !accessKeyId || !secretAccessKey) {
		return NextResponse.json(
			{ error: "AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set" },
			{ status: 503 },
		);
	}

	// Wildcard origin is safe: presigned PUTs are already authenticated via SigV4 signature
	const corsXml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
		"  <CORSRule>",
		"    <AllowedOrigin>*</AllowedOrigin>",
		"    <AllowedMethod>PUT</AllowedMethod>",
		"    <AllowedHeader>*</AllowedHeader>",
		"    <MaxAgeSeconds>3600</MaxAgeSeconds>",
		"  </CORSRule>",
		"</CORSConfiguration>",
	].join("\n");

	const now = new Date();
	const amzDate = now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
	const dateStamp = amzDate.slice(0, 8);

	const host = `${bucket}.s3.${region}.amazonaws.com`;
	const contentType = "application/xml";
	const payloadHash = sha256hex(corsXml);
	const contentMd5 = md5base64(corsXml);

	const signedHeaders = "content-md5;content-type;host;x-amz-content-sha256;x-amz-date";

	const canonicalHeaders =
		`content-md5:${contentMd5}\n` +
		`content-type:${contentType}\n` +
		`host:${host}\n` +
		`x-amz-content-sha256:${payloadHash}\n` +
		`x-amz-date:${amzDate}\n`;

	const canonicalRequest = ["PUT", "/", "cors=", canonicalHeaders, signedHeaders, payloadHash].join(
		"\n",
	);

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

	const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

	const res = await fetch(`https://${host}/?cors`, {
		method: "PUT",
		headers: {
			"Content-Type": contentType,
			"Content-MD5": contentMd5,
			"x-amz-content-sha256": payloadHash,
			"x-amz-date": amzDate,
			Authorization: authorization,
		},
		body: corsXml,
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		return NextResponse.json(
			{ error: `S3 responded ${res.status}`, detail: text.slice(0, 500) },
			{ status: 502 },
		);
	}

	return NextResponse.json({
		ok: true,
		bucket,
		region,
		message: "S3 CORS configured — browser PUT uploads are now allowed",
	});
}
