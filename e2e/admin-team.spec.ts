import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { ensureTestUser, loginAsAdmin, loginAsUser, setTestUserRole, TEST_ADMIN_EMAIL } from "../test-support/adminSession";

// Real end-to-end run against the live Supabase project, same constraint as
// e2e/content-database.spec.ts (this sandbox's egress policy blocks
// *.supabase.co) — runs in CI, not locally. Covers the admin team
// management feature end to end: a super admin invites a new admin through
// the real UI, grants them super admin (behind its confirmation dialog),
// deactivates/reactivates their account, then permanently deletes it (only
// offered once deactivated, behind its own confirmation dialog) — and a
// plain (non-super-admin) admin is refused both by the page and by the
// admin-users-* edge functions directly. There's no role picker to test —
// every invite is role: admin; is_super_admin is the only real permission
// tier.
test("a super admin manages the team; a non-super-admin is refused", async ({ page }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to seed test accounts");
  test.skip(!process.env.ADMIN_TEST_PASSWORD, "needs ADMIN_TEST_PASSWORD to log in through the real login form");
  test.setTimeout(60_000);

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const stamp = Date.now();
  const superAdminEmail = TEST_ADMIN_EMAIL;
  const inviteeEmail = `admin-team-e2e-invitee-${stamp}@example.com`;
  const plainAdminEmail = `admin-team-e2e-plain-${stamp}@example.com`;
  const plainAdminPassword = "not-a-super-admin-password-1!";

  // ---- 1. Seed a plain (non-super-admin) admin for the refusal checks ----
  const plainAdminId = await ensureTestUser(plainAdminEmail, plainAdminPassword);
  await setTestUserRole(plainAdminId, "admin", false);

  // ---- 2. Super admin invites a new admin through the real UI ----
  await loginAsAdmin(page, superAdminEmail, "/admin/team");
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();

  await page.getByRole("button", { name: "Invite team member" }).click();
  await page.getByLabel("Email").fill(inviteeEmail);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText(inviteeEmail)).toBeVisible({ timeout: 15000 });

  const { data: invitee } = await serviceClient.from("profiles").select("id").eq("email", inviteeEmail).single();
  const row = page.getByTestId(`team-row-${invitee!.id}`);
  await expect(row.getByText("Active")).toBeVisible();

  // ---- 3. Grant super admin — gated behind its confirmation dialog ----
  await row.getByLabel("Super admin").check();
  await expect(page.getByRole("heading", { name: "Make super admin?" })).toBeVisible();
  await page.getByRole("button", { name: "Make super admin" }).click();
  await expect
    .poll(async () => {
      const { data } = await serviceClient.from("profiles").select("is_super_admin").eq("email", inviteeEmail).maybeSingle();
      return data?.is_super_admin;
    }, { timeout: 10000 })
    .toBe(true);

  // ---- 4. Deactivate — Delete only appears once deactivated ----
  await expect(row.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(row.getByText("Deactivated")).toBeVisible({ timeout: 10000 });
  const { data: bannedUser } = await serviceClient.auth.admin.getUserById(invitee!.id);
  expect(bannedUser.user?.banned_until).toBeTruthy();
  await expect(row.getByRole("button", { name: "Delete" })).toBeVisible();

  // ---- 5. Reactivate — Delete disappears again while active ----
  await row.getByRole("button", { name: "Reactivate" }).click();
  await expect(row.getByText("Active")).toBeVisible({ timeout: 10000 });
  await expect(row.getByRole("button", { name: "Delete" })).toHaveCount(0);

  // ---- 6. Deactivate again, then permanently delete behind its own confirmation ----
  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(row.getByText("Deactivated")).toBeVisible({ timeout: 10000 });
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Delete this account?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(row).toHaveCount(0, { timeout: 10000 });
  const { data: deletedUser } = await serviceClient.auth.admin.getUserById(invitee!.id);
  expect(deletedUser.user).toBeNull();
  const { data: deletedProfile } = await serviceClient.from("profiles").select("id").eq("id", invitee!.id).maybeSingle();
  expect(deletedProfile).toBeNull();

  // ---- 7. A non-super-admin is refused by the page itself ----
  await loginAsUser(page, plainAdminEmail, plainAdminPassword, "/admin/team");
  await expect(page.getByText("Super admin access required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Invite team member" })).toHaveCount(0);

  // ---- 8. ...and by the edge function directly (defense in depth) ----
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn } = await anon.auth.signInWithPassword({ email: plainAdminEmail, password: plainAdminPassword });
  const { data: fnData, error: fnError } = await anon.functions.invoke("admin-users-list", {
    headers: { Authorization: `Bearer ${signIn.session!.access_token}` },
  });
  expect(fnError || fnData?.error).toBeTruthy();
});
