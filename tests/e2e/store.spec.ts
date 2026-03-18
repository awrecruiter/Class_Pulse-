import { expect, test } from "@playwright/test";

test.describe("store open/close flow", () => {
	test("store API without auth returns 401", async ({ request }) => {
		const res = await request.put("/api/teacher-settings", {
			data: { storeIsOpen: true },
		});
		expect(res.status()).toBe(401);
	});

	test.skip("store page shows items when store is open (requires teacher auth)", async ({
		page,
	}) => {
		await page.goto("/store");
	});

	test.skip("purchase flow (requires student + teacher auth)", async ({ page }) => {
		// Navigate to student store view, click item → confirm purchase, expect balance decrease
		expect(page).toBeDefined(); // placeholder
	});
});
