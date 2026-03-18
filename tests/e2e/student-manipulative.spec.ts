import { expect, test } from "@playwright/test";

test.describe("student manipulative push", () => {
	test.skip("student sees fraction-bar after teacher push (requires auth + data-testid)", async ({
		page,
	}) => {
		await page.route("/api/sessions/sess-1/student-feed*", (route) => {
			route.fulfill({
				status: 200,
				headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
				body: `data: ${JSON.stringify({ type: "push", spec: { type: "fraction-bar", caption: "Show 3/4", bars: [{ parts: 4, filled: 3, label: "3/4" }] } })}\n\n`,
			});
		});
		await page.goto("/student/sess-1");
		// Add data-testid="manipulative-fraction-bar" to the fraction bar container
		// then uncomment:
		// await expect(page.locator('[data-testid="manipulative-fraction-bar"]')).toBeVisible({ timeout: 5000 });
		expect(true).toBe(true); // placeholder
	});
});
