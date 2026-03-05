import crypto from "node:crypto";

export type SmsResult = {
	ok: boolean;
	sid?: string;
	error?: string;
};

// ─── Minimal AWS Signature Version 4 for SNS ──────────────────────────────────

function hmac(key: Buffer | string, data: string, encoding?: "hex"): Buffer | string {
	const h = crypto.createHmac("sha256", key).update(data);
	return encoding ? h.digest(encoding) : h.digest();
}

function sha256hex(data: string): string {
	return crypto.createHash("sha256").update(data).digest("hex");
}

function sigV4Headers(
	method: string,
	region: string,
	service: string,
	host: string,
	path: string,
	body: string,
	accessKeyId: string,
	secretAccessKey: string,
): Record<string, string> {
	const now = new Date();
	const amzDate = now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
	const dateStamp = amzDate.slice(0, 8);

	const contentType = "application/x-www-form-urlencoded";
	const payloadHash = sha256hex(body);

	const canonicalHeaders =
		`content-type:${contentType}\n` + `host:${host}\n` + `x-amz-date:${amzDate}\n`;
	const signedHeaders = "content-type;host;x-amz-date";

	const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join(
		"\n",
	);

	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256hex(canonicalRequest),
	].join("\n");

	const signingKey = hmac(
		hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service),
		"aws4_request",
	) as Buffer;
	const signature = hmac(signingKey, stringToSign, "hex") as string;

	const authorization =
		`AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
		`SignedHeaders=${signedHeaders}, Signature=${signature}`;

	return {
		"Content-Type": contentType,
		"x-amz-date": amzDate,
		Authorization: authorization,
	};
}

// ─── Send SMS via AWS SNS ──────────────────────────────────────────────────────

/**
 * Send an SMS via AWS SNS using raw HTTP + SigV4 (no SDK package needed).
 * Free tier: 100 SMS/month, then $0.0025/msg USA.
 * Silently returns { ok: false } if AWS env vars are not configured.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
	const region = process.env.AWS_REGION ?? "us-east-1";

	if (!accessKeyId || !secretAccessKey) {
		return { ok: false, error: "AWS SNS not configured" };
	}

	const host = `sns.${region}.amazonaws.com`;
	const params = new URLSearchParams({
		Action: "Publish",
		PhoneNumber: to,
		Message: body,
		"MessageAttributes.entry.1.Name": "AWS.SNS.SMS.SMSType",
		"MessageAttributes.entry.1.Value.DataType": "String",
		"MessageAttributes.entry.1.Value.StringValue": "Transactional",
		Version: "2010-03-31",
	});
	const bodyStr = params.toString();

	try {
		const headers = sigV4Headers(
			"POST",
			region,
			"sns",
			host,
			"/",
			bodyStr,
			accessKeyId,
			secretAccessKey,
		);
		const res = await fetch(`https://${host}/`, { method: "POST", headers, body: bodyStr });
		const text = await res.text();

		if (!res.ok) {
			const match = text.match(/<Message>(.+?)<\/Message>/);
			return { ok: false, error: match?.[1] ?? `HTTP ${res.status}` };
		}

		const idMatch = text.match(/<MessageId>(.+?)<\/MessageId>/);
		return { ok: true, sid: idMatch?.[1] };
	} catch (err) {
		const error = err instanceof Error ? err.message : "Unknown error";
		return { ok: false, error };
	}
}
