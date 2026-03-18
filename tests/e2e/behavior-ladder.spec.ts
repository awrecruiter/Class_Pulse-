import { expect, test } from "@playwright/test";

test.describe("behavior ladder", () => {
	test.skip("behavior incident API accepts step 1–8 (requires teacher auth)", async ({
		request,
	}) => {
		const res = await request.post("/api/classes/test-class-id/behavior/incident", {
			data: { rosterId: "test-roster-id", step: 1 },
		});
		expect(res.status()).toBe(201);
	});

	test.skip("UI flow — teacher logs a warning (requires teacher auth)", async ({ page }) => {
		await page.goto("/coach");
		// Find and interact with behavior panel
		await expect(page.locator("text=Warning")).toBeVisible();
	});
});
