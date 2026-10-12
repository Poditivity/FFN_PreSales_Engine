import { expect, test } from "@playwright/test";

test("the home page sends a signed-out visitor to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin\/login/);
});
