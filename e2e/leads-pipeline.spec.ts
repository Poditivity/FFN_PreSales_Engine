import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { acceptPrivacyConsent } from "./fixtures/consent";
import { loginAsAdmin, TEST_ADMIN_EMAIL } from "../test-support/adminSession";
import { e2eName } from "../test-support/e2eData";

// Real end-to-end run against the live Supabase project, same constraint as
// e2e/form-submission.spec.ts (this sandbox's egress policy blocks
// *.supabase.co) — runs in CI, not locally. Additionally needs
// SUPABASE_SERVICE_ROLE_KEY to log in as a real admin without an email
// round-trip (see test-support/adminSession) and to assert DB state
// directly (leads/lead_stage_history have no public read policy).
test("submitting a real form auto-creates a lead, and moving it on the board logs the stage change", async ({
  page,
  context,
}) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to mint an admin session");

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ---- 1. Submit the real public flow (Phase 1's form) ----
  await page.goto("/forms/e2e-smoke-test");
  await page.getByTestId("field-name").pressSequentially(e2eName("Applicant Lead Pipeline"), { delay: 15 });
  await page.getByTestId("submit-button").click();

  await page.getByTestId("field-email").pressSequentially("poditivity.company@gmail.com", { delay: 15 });
  await page.getByTestId("submit-button").click();

  const sessionId = await page.evaluate(() => sessionStorage.getItem("ffn_session_id"));
  expect(sessionId).toBeTruthy();

  await page
    .getByTestId("field-why")
    .pressSequentially("I want to see the lead pipeline pick this submission up automatically.", { delay: 15 });
  await acceptPrivacyConsent(page);
  await page.getByTestId("submit-button").click();

  await expect(page.getByTestId("submission-confirmation")).toBeVisible({ timeout: 15000 });

  // ---- 2. Confirm the trigger fired: a real leads row at stage 'lead' ----
  const { data: submission, error: submissionError } = await serviceClient
    .from("form_submissions")
    .select("id")
    .eq("session_id", sessionId)
    .single();
  expect(submissionError).toBeNull();

  const { data: lead, error: leadError } = await serviceClient
    .from("leads")
    .select("id, stage")
    .eq("form_submission_id", submission!.id)
    .single();
  expect(leadError).toBeNull();
  expect(lead!.stage).toBe("lead");

  // ---- 3. Log in as a real admin (no email round-trip) and open the board ----
  await loginAsAdmin(page, TEST_ADMIN_EMAIL, "/admin/leads");
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  // The list is the default view; the board is where a card carries its own stage menu.
  await page.getByRole("button", { name: "Board" }).click();

  // ---- 4. Move the card directly to a non-adjacent stage (Lead -> Customer) ----
  const card = page.getByTestId(`lead-card-${lead!.id}`);
  await expect(card).toBeVisible();
  await card.locator("select").selectOption("customer");

  // ---- 5. Confirm the move succeeded and lead_stage_history logged it ----
  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("leads").select("stage").eq("id", lead!.id).single();
        return data?.stage;
      },
      { timeout: 10000 },
    )
    .toBe("customer");

  const { data: history } = await serviceClient
    .from("lead_stage_history")
    .select("from_stage, to_stage")
    .eq("lead_id", lead!.id)
    .order("changed_at", { ascending: true });

  expect(history).toHaveLength(2);
  expect(history![0]).toMatchObject({ from_stage: null, to_stage: "lead" });
  expect(history![1]).toMatchObject({ from_stage: "lead", to_stage: "customer" });

  await context.close();
});
