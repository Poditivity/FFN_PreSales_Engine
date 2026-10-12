import { expect, test } from "@playwright/test";
import { acceptPrivacyConsent } from "./fixtures/consent";
import { e2eName } from "../test-support/e2eData";

// Real end-to-end run against the live Supabase project (via the seeded
// "e2e-smoke-test" form — see the seed_e2e_form_graph_schema migration).
// The form is now a one-question-at-a-time flow (name -> email -> why ->
// end), so this walks it with Next between each question instead of
// filling every field on one page.
// Requires NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY to point
// at that project — this sandbox's own egress policy blocks *.supabase.co,
// so this spec is run in CI (GitHub Actions), not locally in this session.

test("walk the public flow, paste into the narrative question, submit, and confirm it lands", async ({ page }) => {
  await page.goto("/forms/e2e-smoke-test");

  // Real keystrokes for two fields — these should NOT be flagged as pasted.
  await page.getByTestId("field-name").pressSequentially(e2eName("Applicant Form Submission"), { delay: 15 });
  await page.getByTestId("submit-button").click();

  // A real, checkable inbox — the confirmation email this test triggers is
  // verified afterward against this actual mailbox, not just a 200 response.
  await page
    .getByTestId("field-email")
    .pressSequentially("poditivity.company@gmail.com", { delay: 15 });
  await page.getByTestId("submit-button").click();

  // A deliberate paste into the narrative field: set the value directly
  // without dispatching keydown events per character. This is exactly what
  // a real OS-level paste looks like from the tracker's point of view
  // (substantial content, ~0 recorded keystrokes) — the same signal
  // computeSubmissionInsights() scores as `pasted`.
  const pastedText =
    "I want to join because this program aligns with everything I have been " +
    "building toward and I believe the network can meaningfully accelerate it.";
  await page.getByTestId("field-why").evaluate((el, text) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, pastedText);

  await acceptPrivacyConsent(page);
  await page.getByTestId("submit-button").click();

  await expect(page.getByTestId("submission-confirmation")).toBeVisible({
    timeout: 15000,
  });

  // The confirmation-email call fires without being awaited by the UI (the
  // thank-you screen shouldn't block on it). Give it a moment to complete
  // so the send is real by the time this test — and any verification run
  // after it — checks email_logs / the inbox.
  await page.waitForTimeout(5000);
});
