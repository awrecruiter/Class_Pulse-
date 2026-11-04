import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";

function key() {
	const secret = process.env.NEON_AUTH_COOKIE_SECRET;
	if (!secret)
		throw new Error("NEON_AUTH_COOKIE_SECRET is required to protect Calendly credentials.");
	return createHash("sha256").update(`class-pulse:calendly:${secret}`).digest();
}
export function sealToken(token: string) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
	return [iv, cipher.getAuthTag(), encrypted].map((value) => value.toString("base64url")).join(".");
}
export function openToken(value: string) {
	const [iv, tag, data] = value.split(".");
	const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
	cipher.setAuthTag(Buffer.from(tag, "base64url"));
	return Buffer.concat([cipher.update(Buffer.from(data, "base64url")), cipher.final()]).toString(
		"utf8",
	);
}
export class CalendlyApiError extends Error {
	constructor(
		public readonly status: number,
		missingScope: boolean | "users:read" | "scheduled_events:read" = false,
	) {
		super(
			status === 403 && missingScope
				? `Your Calendly token is missing ${typeof missingScope === "string" ? missingScope : "scheduled_events:read"} permission. Create a token with that permission in Calendly, then reconnect in Booking setup.`
				: status === 401
					? "Calendly connection expired or was revoked. Reconnect in Booking setup."
					: status === 403
						? "Calendly denied reservation access. Check your token permissions and reconnect in Booking setup."
						: status === 429
							? "Calendly is limiting requests. Wait a moment, then refresh your schedule."
							: "Calendly is temporarily unavailable. Try refreshing your schedule again.",
		);
		this.name = "CalendlyApiError";
	}
}
export function calendlyFailureMessage(
	error: unknown,
	fallback = "Calendly could not refresh. Retry to see current reservations.",
) {
	return error instanceof CalendlyApiError ? error.message : fallback;
}
export async function calendlyGet(token: string, path: string) {
	if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid Calendly API path.");
	const url = new URL(path, "https://api.calendly.com");
	if (url.origin !== "https://api.calendly.com") throw new Error("Invalid Calendly API origin.");
	const response = await fetch(url, {
		redirect: "error",
		headers: { Authorization: `Bearer ${token}` },
		cache: "no-store",
		signal: AbortSignal.timeout(15000),
	});
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new CalendlyApiError(
			response.status,
			body?.title === "Insufficient scope"
				? url.pathname.startsWith("/users/")
					? "users:read"
					: "scheduled_events:read"
				: false,
		);
	}
	return response.json();
}
export const calendlyUserSchema = z.object({
	resource: z.object({
		uri: z.url().regex(/^https:\/\/api\.calendly\.com\/users\/[A-Za-z0-9-]+$/),
		name: z.string(),
	}),
});
const eventSchema = z.object({
	uri: z.string().regex(/^https:\/\/api\.calendly\.com\/scheduled_events\/[A-Za-z0-9-]+$/),
	name: z.string(),
	start_time: z.iso.datetime(),
	end_time: z.iso.datetime(),
	status: z.string(),
});
const inviteeSchema = z.object({
	uri: z.string(),
	name: z.string(),
	email: z.string(),
	status: z.string(),
	questions_and_answers: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
});
export async function readReservations(token: string, userUri: string) {
	const params = new URLSearchParams({
		user: userUri,
		status: "active",
		min_start_time: new Date().toISOString(),
		max_start_time: new Date(Date.now() + 60 * 86400000).toISOString(),
		count: "50",
		sort: "start_time:asc",
	});
	const data = await calendlyGet(token, `/scheduled_events?${params}`);
	const events = z.array(eventSchema).parse(data.collection);
	const reservations = [];
	let limited = !!data.pagination?.next_page_token;
	for (const event of events.filter((event) => event.status === "active")) {
		const id = event.uri.split("/").pop();
		const result = await calendlyGet(
			token,
			`/scheduled_events/${id}/invitees?status=active&count=100`,
		);
		if (result.pagination?.next_page_token) limited = true;
		for (const invitee of z
			.array(inviteeSchema)
			.parse(result.collection)
			.filter((invitee) => invitee.status === "active")) {
			const answer = (name: string) =>
				invitee.questions_and_answers?.find(
					(item) =>
						item.question
							.toLowerCase()
							.replace(/[^a-z ]/g, "")
							.trim() === name,
				)?.answer ?? "";
			reservations.push({
				sourceUri: invitee.uri,
				inviteeEmail: invitee.email.toLowerCase(),
				learnerName: answer("student name") || answer("learner name") || invitee.name,
				subject: answer("subject"),
				topic: answer("topic"),
				startsAt: event.start_time,
				endsAt: event.end_time,
				eventName: event.name,
			});
		}
	}
	return { reservations, limited };
}
