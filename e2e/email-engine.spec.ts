import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { acceptPrivacyConsent } from "./fixtures/consent";
import { loginAsAdmin, TEST_ADMIN_EMAIL } from "../test-support/adminSession";
import { e2eName } from "../test-support/e2eData";

// Real end-to-end run against the live Supabase project, same constraint as
// e2e/hub.spec.ts / e2e/leads-pipeline.spec.ts (this sandbox's egress
// policy blocks *.supabase.co) — runs in CI, not locally. Needs
// SUPABASE_SERVICE_ROLE_KEY to log in as a real admin without an email
// round-trip and to seed/assert DB state directly.
//
// stage_email_rules is a real global singleton (one row per pipeline
// stage, unique(stage)) — unlike tracks/founders/templates, which are
// freely stampable fixtures, overwriting a stage's rule during a test run
// could clobber a real admin-configured rule. Every test below saves
// whatever rule already exists for the stage it touches before mutating
// it, and restores that exact state in a `finally` block.

async function saveRule(serviceClient: SupabaseClient, stage: string) {
  const { data } = await serviceClient.from("stage_email_rules").select("*").eq("stage", stage).maybeSingle();
  return data as { stage: string; template_id: string; enabled: boolean } | null;
}

async function restoreRule(
  serviceClient: SupabaseClient,
  stage: string,
  original: { stage: string; template_id: string; enabled: boolean } | null,
) {
  if (original) {
    await serviceClient
      .from("stage_email_rules")
      .update({ template_id: original.template_id, enabled: original.enabled })
      .eq("stage", stage);
  } else {
    await serviceClient.from("stage_email_rules").delete().eq("stage", stage);
  }
}

async function submitLead(page: import("@playwright/test").Page, serviceClient: SupabaseClient, name: string, why: string) {
  await page.goto("/forms/e2e-smoke-test");
  await page.getByTestId("field-name").pressSequentially(name, { delay: 15 });
  await page.getByTestId("submit-button").click();
  await page.getByTestId("field-email").pressSequentially("poditivity.company@gmail.com", { delay: 15 });
  await page.getByTestId("submit-button").click();
  const sessionId = await page.evaluate(() => sessionStorage.getItem("ffn_session_id"));
  await page.getByTestId("field-why").pressSequentially(why, { delay: 15 });
  await acceptPrivacyConsent(page);
  await page.getByTestId("submit-button").click();
  await expect(page.getByTestId("submission-confirmation")).toBeVisible({ timeout: 15000 });

  const { data: submission } = await serviceClient.from("form_submissions").select("id").eq("session_id", sessionId).single();
  const { data: lead } = await serviceClient.from("leads").select("id, stage").eq("form_submission_id", submission!.id).single();
  return lead as { id: string; stage: string };
}

test("moving a lead into a stage with an enabled rule sends the templated email automatically", async ({ page }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to mint an admin session");
  test.setTimeout(60_000);

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const STAGE = "mql";
  const originalRule = await saveRule(serviceClient, STAGE);

  try {
    const leadName = e2eName("Applicant Stage Auto");
    const lead = await submitLead(page, serviceClient, leadName, "Testing the stage-triggered auto-send.");

    // The {{program}} token renders from the lead's own form's real title —
    // read it live rather than hardcoding it, since a fixture's title is
    // metadata that can change independently of this test.
    const { data: form } = await serviceClient.from("forms").select("title").eq("slug", "e2e-smoke-test").single();
    const program = form!.title;

    const { data: template } = await serviceClient
      .from("email_templates")
      .insert({
        name: e2eName("Template Stage Auto"),
        subject: `Welcome, {{lead_name}}!`,
        body: `Hi {{lead_name}}, thanks for applying to {{program}}.`,
      })
      .select()
      .single();

    await serviceClient
      .from("stage_email_rules")
      .upsert({ stage: STAGE, template_id: template!.id, enabled: true }, { onConflict: "stage" });

    await loginAsAdmin(page, TEST_ADMIN_EMAIL, "/admin/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    // The list is the default view; the board is where a card carries its own stage menu.
    await page.getByRole("button", { name: "Board" }).click();

    const card = page.getByTestId(`lead-card-${lead.id}`);
    await expect(card).toBeVisible();
    await card.locator("select").selectOption(STAGE);

    // Real network round trip: leads.stage UPDATE -> DB trigger inserts a
    // pending stub -> the board calls lead-email-dispatch -> render + send.
    // Scoped by the lead's own thread, not a global "latest row" query, so
    // this can never pick up another test's message.
    await expect
      .poll(
        async () => {
          const { data } = await serviceClient.from("lead_email_threads").select("id").eq("lead_id", lead.id).maybeSingle();
          return data?.id ?? null;
        },
        { timeout: 20000 },
      )
      .not.toBeNull();
    const { data: thread } = await serviceClient.from("lead_email_threads").select("id").eq("lead_id", lead.id).single();

    await expect
      .poll(
        async () => {
          const { data } = await serviceClient
            .from("lead_email_messages")
            .select("status")
            .eq("thread_id", thread!.id)
            .eq("trigger", "stage_change")
            .maybeSingle();
          return data?.status ?? null;
        },
        { timeout: 20000 },
      )
      .toBe("sent");

    const { data: sentMessage } = await serviceClient
      .from("lead_email_messages")
      .select("subject, body, to_email")
      .eq("thread_id", thread!.id)
      .eq("trigger", "stage_change")
      .single();
    expect(sentMessage!.subject).toBe(`Welcome, ${leadName}!`);
    // Bodies are stored as HTML from the visual editor; older plain-text templates are wrapped in a paragraph.
    expect(sentMessage!.body).toContain(`Hi ${leadName}, thanks for applying to ${program}.`);
    expect(sentMessage!.to_email).toBe("poditivity.company@gmail.com");

    // The lead detail page's thread panel shows it too.
    await page.goto(`/admin/leads/${lead.id}`);
    await expect(page.getByText(`Welcome, ${leadName}!`)).toBeVisible({ timeout: 15000 });
  } finally {
    await restoreRule(serviceClient, STAGE, originalRule);
  }
});

test("moving a lead into a stage with no enabled rule sends nothing", async ({ page }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to mint an admin session");

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const STAGE = "sql";
  const originalRule = await saveRule(serviceClient, STAGE);

  try {
    // Guarantee "no enabled rule" for this stage regardless of what real
    // staff may have configured, for the duration of this test only.
    await serviceClient.from("stage_email_rules").delete().eq("stage", STAGE);

    const leadName = e2eName("Applicant No Rule");
    const lead = await submitLead(page, serviceClient, leadName, "Testing that a stage with no rule sends nothing.");

    await loginAsAdmin(page, TEST_ADMIN_EMAIL, "/admin/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    // The list is the default view; the board is where a card carries its own stage menu.
    await page.getByRole("button", { name: "Board" }).click();

    const card = page.getByTestId(`lead-card-${lead.id}`);
    await expect(card).toBeVisible();
    await card.locator("select").selectOption(STAGE);

    await expect
      .poll(
        async () => {
          const { data } = await serviceClient.from("leads").select("stage").eq("id", lead.id).single();
          return data?.stage;
        },
        { timeout: 10000 },
      )
      .toBe(STAGE);

    // Give any (incorrect) auto-send a real chance to happen before asserting its absence.
    await page.waitForTimeout(3000);

    // No enabled rule for this stage -> the DB trigger's IF branch never
    // fires -> no thread is ever created for this lead at all, let alone a
    // message. That absence is the proof nothing sent.
    const { data: thread } = await serviceClient.from("lead_email_threads").select("id").eq("lead_id", lead.id).maybeSingle();
    expect(thread).toBeNull();
  } finally {
    await restoreRule(serviceClient, STAGE, originalRule);
  }
});

test("manually composing and sending from the thread logs it correctly", async ({ page }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to mint an admin session");
  test.setTimeout(60_000);

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const leadName = e2eName("Applicant Manual Compose");
  const lead = await submitLead(page, serviceClient, leadName, "Testing manual compose and send from the thread.");

  await loginAsAdmin(page, TEST_ADMIN_EMAIL, `/admin/leads/${lead.id}`);
  await expect(page.getByRole("heading", { name: leadName })).toBeVisible();

  const subject = e2eName("Manual follow-up");
  const body = `Hi ${leadName}, following up manually.`;
  await page.getByLabel("Subject", { exact: true }).fill(subject);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await page.getByRole("button", { name: "Send email", exact: true }).click();

  await expect(page.getByText(subject)).toBeVisible({ timeout: 15000 });

  const { data: thread } = await serviceClient.from("lead_email_threads").select("id").eq("lead_id", lead.id).single();
  const { data: message } = await serviceClient
    .from("lead_email_messages")
    .select("trigger, subject, body, status, to_email, sent_by")
    .eq("thread_id", thread!.id)
    .eq("trigger", "manual")
    .single();
  expect(message!.subject).toBe(subject);
  expect(message!.body).toContain(body);
  expect(message!.to_email).toBe("poditivity.company@gmail.com");
  expect(message!.sent_by).not.toBeNull();
  expect(["sent", "pending"]).toContain(message!.status);

  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("lead_email_messages").select("status").eq("thread_id", thread!.id).eq("trigger", "manual").single();
        return data?.status;
      },
      { timeout: 15000 },
    )
    .toBe("sent");
});
