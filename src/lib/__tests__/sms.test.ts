import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch before importing sendSms
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { sendSms } from "../sms";

describe("sendSms", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		vi.clearAllMocks();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("returns { ok: false, error: 'AWS SNS not configured' } when env vars are missing", async () => {
		delete process.env.AWS_ACCESS_KEY_ID;
		delete process.env.AWS_SECRET_ACCESS_KEY;

		const result = await sendSms("+12125550001", "Hello");

		expect(result).toEqual({ ok: false, error: "AWS SNS not configured" });
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("calls SNS Publish endpoint with correct params when configured", async () => {
		process.env.AWS_ACCESS_KEY_ID = "AKIAtest";
		process.env.AWS_SECRET_ACCESS_KEY = "secretkey";
		process.env.AWS_REGION = "us-east-1";

		const messageId = "abc-123-def";
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: async () =>
				`<PublishResponse><PublishResult><MessageId>${messageId}</MessageId></PublishResult></PublishResponse>`,
		});

		const result = await sendSms("+12125550001", "Test message");

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe("https://sns.us-east-1.amazonaws.com/");
		expect(init.method).toBe("POST");
		expect(init.body).toContain("Action=Publish");
		expect(init.body).toContain("PhoneNumber=%2B12125550001");
		expect(init.body).toContain("Message=Test+message");
		expect(result).toEqual({ ok: true, sid: messageId });
	});

	it("returns { ok: false, error } when SNS returns an error response", async () => {
		process.env.AWS_ACCESS_KEY_ID = "AKIAtest";
		process.env.AWS_SECRET_ACCESS_KEY = "secretkey";

		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 400,
			text: async () =>
				"<ErrorResponse><Error><Message>Invalid phone number</Message></Error></ErrorResponse>",
		});

		const result = await sendSms("+1000", "Hello");

		expect(result).toEqual({ ok: false, error: "Invalid phone number" });
	});

	it("returns { ok: false, error } when fetch throws", async () => {
		process.env.AWS_ACCESS_KEY_ID = "AKIAtest";
		process.env.AWS_SECRET_ACCESS_KEY = "secretkey";

		mockFetch.mockRejectedValueOnce(new Error("Network failure"));

		const result = await sendSms("+12125550001", "Hello");

		expect(result).toEqual({ ok: false, error: "Network failure" });
	});
});
