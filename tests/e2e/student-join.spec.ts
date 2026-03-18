import { expect, test } from "@playwright/test";

test.describe("student join flow", () => {
	test("shows code entry form on load", async ({ page }) => {
		await page.goto("/student");
		await expect(page.locator('input[placeholder="A B C 1 2 3"]')).toBeVisible();
		await expect(page.getByRole("button", { name: /find my class/i })).toBeDisabled();
	});

	test("submit button disabled until 6 chars entered", async ({ page }) => {
		await page.goto("/student");
		const input = page.locator('input[placeholder="A B C 1 2 3"]');
		await input.fill("ABC");
		await expect(page.getByRole("button", { name: /find my class/i })).toBeDisabled();
		await input.fill("ABC123");
		await expect(page.getByRole("button", { name: /find my class/i })).toBeEnabled();
	});

	test("shows error for invalid code (API 404)", async ({ page }) => {
		await page.route("/api/sessions/join*", (route) => {
			route.fulfill({
				status: 404,
				contentType: "application/json",
				body: JSON.stringify({ error: "Session not found or already ended" }),
			});
		});
		await page.goto("/student");
		await page.locator('input[placeholder="A B C 1 2 3"]').fill("XXXXXX");
		await page.getByRole("button", { name: /find my class/i }).click();
		await expect(page.locator("text=Session not found")).toBeVisible();
	});

	test("advances to student ID phase on valid code", async ({ page }) => {
		await page.route("/api/sessions/join?code=ABC123", (route) => {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					sessionId: "sess-1",
					sessionLabel: "5th Grade Math",
					date: "2026-03-17",
				}),
			});
		});
		await page.goto("/student");
		await page.locator('input[placeholder="A B C 1 2 3"]').fill("ABC123");
		await page.getByRole("button", { name: /find my class/i }).click();
		await expect(page.locator("text=5th Grade Math")).toBeVisible({ timeout: 5000 });
		await expect(page.locator('input[placeholder*="e.g."]')).toBeVisible();
	});

	test("'different code' button navigates back to code entry", async ({ page }) => {
		await page.route("/api/sessions/join?code=ABC123", (route) => {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					sessionId: "sess-1",
					sessionLabel: "5th Grade Math",
					date: "2026-03-17",
				}),
			});
		});
		await page.goto("/student");
		await page.locator('input[placeholder="A B C 1 2 3"]').fill("ABC123");
		await page.getByRole("button", { name: /find my class/i }).click();
		await expect(page.locator('input[placeholder*="e.g."]')).toBeVisible({ timeout: 5000 });
		await page.getByRole("button", { name: /different code/i }).click();
		await expect(page.locator('input[placeholder="A B C 1 2 3"]')).toBeVisible({ timeout: 3000 });
	});
});
