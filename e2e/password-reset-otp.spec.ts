import { expect, test } from "@playwright/test";
import { createServiceRoleClient, ensureTestUser, setTestUserRole } from "../test-support/adminSession";

// Forgot password with a 6 digit code, against the real Supabase project.
//
// The code email goes through ZeptoMail and cannot be read from a test, so the
// one call that sends it (the admin-password-reset function) is stubbed. The
// code itself is real: it is taken from Supabase Auth's own generateLink, which
// returns exactly the value the email carries, and the app then checks it with
// the real verifyOtp. The spec uses its own throwaway admin account and deletes
// it afterwards.
//
// Like the other specs, this runs in CI rather than in this repo's sandbox.

test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to create a test admin and read its code");

test("reset a password with a 6 digit code, with no sidebar on the sign-in or set-password screens", async ({ page }) => {
  const db = createServiceRoleClient();
  const email = `password-reset-e2e-${Date.now()}@example.com`;
  const userId = await ensureTestUser(email, "Original-password-1");
  await setTestUserRole(userId, "staff");

  try {
    await page.route("**/functions/v1/admin-password-reset", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto("/admin/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(6);

    // The project must issue 6 digit codes. If it is set to any other length this fails here.
    const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
    expect(error).toBeNull();
    const code = data?.properties?.email_otp ?? "";
    expect(code).toMatch(/^\d{6}$/);

    // A wrong code is refused and the boxes clear.
    const wrong = code === "000000" ? "111111" : "000000";
    await page.keyboard.type(wrong);
    await expect(page.getByText(/wrong or has expired/i)).toBeVisible();
    await expect(page.getByTestId("otp-0")).toHaveValue("");
    await expect(page).toHaveURL(/\/admin\/login/);

    // The real code signs the person in and moves on by itself, with no button press.
    await page.getByTestId("otp-0").click();
    await page.keyboard.type(code);
    await page.waitForURL(/\/admin\/set-password/, { timeout: 15_000 });

    // Signed in now, and still no shell: no sidebar, no navigation, no profile block.
    await expect(page.getByRole("heading", { name: "Set your password" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);

    // The session is real, so setting the password works (no "Auth session missing").
    await page.getByLabel(/^New password\s*\*?$/).fill("Brand-new-password-2");
    await page.getByLabel(/^Confirm password\s*\*?$/).fill("Brand-new-password-2");
    await page.getByRole("button", { name: "Save password" }).click();
    await page.waitForURL(/\/admin\/forms/, { timeout: 15_000 });
    await expect(page.getByText("Auth session missing")).toHaveCount(0);

    // The new password is the one that works from now on.
    await page.context().clearCookies();
    await page.goto("/admin/login");
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Password\s*\*?$/).fill("Brand-new-password-2");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin(\/|$)/, { timeout: 15_000 });
    await expect(page.getByRole("navigation").first()).toBeVisible();
  } finally {
    await db.auth.admin.deleteUser(userId);
  }
});
