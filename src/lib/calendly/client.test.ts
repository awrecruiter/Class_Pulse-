import { afterEach, expect, it, vi } from "vitest";
import {
	calendlyFailureMessage,
	calendlyGet,
	openToken,
	readReservations,
	sealToken,
} from "./client";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});
it("encrypts credentials with unique nonces and authenticates ciphertext", () => {
	vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "test-only-credential-key");
	const sealed = sealToken("private-calendly-token");
	expect(sealed).not.toContain("private-calendly-token");
	expect(openToken(sealed)).toBe("private-calendly-token");
	expect(sealToken("private-calendly-token")).not.toBe(sealed);
	expect(() => openToken(`${sealed.slice(0, -4)}AAAA`)).toThrow();
});
it("requires an explicit credential encryption secret", () => {
	vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "");
	expect(() => sealToken("test")).toThrow();
});
it("does not forward credentials to another origin", async () => {
	const request = vi.fn();
	vi.stubGlobal("fetch", request);
	await expect(calendlyGet("secret", "//evil.test")).rejects.toThrow();
	expect(request).not.toHaveBeenCalled();
});
it("reads only active events for the connected user and excludes cancelled invitees", async () => {
	const request = vi
		.fn()
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					collection: [
						{
							uri: "https://api.calendly.com/scheduled_events/event-1",
							name: "Tutoring",
							start_time: "2026-12-01T14:00:00Z",
							end_time: "2026-12-01T14:30:00Z",
							status: "active",
						},
					],
					pagination: {},
				}),
			),
		)
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					collection: [
						{
							uri: "https://api.calendly.com/scheduled_events/event-1/invitees/student-1",
							name: "Demo learner",
							email: "demo@example.com",
							status: "active",
							questions_and_answers: [
								{ question: "Subject", answer: "Math" },
								{ question: "Topic", answer: "Ratios" },
							],
						},
						{ uri: "cancelled", name: "Cancelled", email: "other@example.com", status: "canceled" },
					],
				}),
			),
		);
	vi.stubGlobal("fetch", request);
	const result = await readReservations("secret", "https://api.calendly.com/users/teacher-1");
	expect(new URL(String(request.mock.calls[0][0])).searchParams.get("user")).toBe(
		"https://api.calendly.com/users/teacher-1",
	);
	expect(result.reservations).toHaveLength(1);
	expect(result.reservations[0]).toMatchObject({
		learnerName: "Demo learner",
		subject: "Math",
		topic: "Ratios",
	});
});

it("explains missing event-read permission without exposing provider details or credentials", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(
			Response.json(
				{
					title: "Insufficient scope",
					message: "sensitive provider details",
					required_scopes: ["scheduled_events:read"],
				},
				{ status: 403 },
			),
		),
	);
	try {
		await calendlyGet("secret-token", "/scheduled_events");
		throw new Error("Expected a scope error");
	} catch (error) {
		const message = calendlyFailureMessage(error);
		expect(message).toContain("scheduled_events:read");
		expect(message).toContain("reconnect");
		expect(message).not.toContain("secret-token");
		expect(message).not.toContain("sensitive provider details");
	}
});
it("reports revoked credentials separately and does not expose unknown errors", async () => {
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 401 })));
	await expect(calendlyGet("secret-token", "/users/me")).rejects.toThrow("expired or was revoked");
	expect(calendlyFailureMessage(new Error("secret-token"))).not.toContain("secret-token");
});

it("identifies missing profile-read scope separately from reservation scope", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(Response.json({ title: "Insufficient scope" }, { status: 403 })),
	);
	await expect(calendlyGet("secret-token", "/users/me")).rejects.toThrow("users:read permission");
});
