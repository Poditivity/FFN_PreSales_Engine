import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { acceptPrivacyConsent } from "./fixtures/consent";
import { loginAsAdmin, TEST_ADMIN_EMAIL } from "../test-support/adminSession";
import { e2eName } from "../test-support/e2eData";

// Real end-to-end run against the live Supabase project, same constraint as
// e2e/hub.spec.ts (this sandbox's egress policy blocks *.supabase.co) —
// runs in CI, not locally. Verifies the admin-wide Hubs list (/admin/hubs)
// is a real view over Phase 4's existing hub system, not a parallel one: the
// hub it lists is created through the same CreateHubModal reused from
// ProofHubCard. "From application" picks an existing lead and funnels into
// that exact same modal; "New hub" instead collects a standalone applicant's
// own name/email/WhatsApp directly, for someone who isn't a lead at all.
test("the hubs list shows a real hub, search filters it, and From application / Templates reuse the real flows", async ({ page }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to mint an admin session");
  test.setTimeout(90_000);

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = Date.now();

  // ---- 1. Seed a track + template, and submit a real lead for it ----
  const trackName = e2eName("Track Hubs List");
  const { data: track } = await serviceClient
    .from("tracks")
    .insert({ name: trackName, slug: `hubs-list-e2e-${stamp}` })
    .select()
    .single();
  const { data: template } = await serviceClient
    .from("hub_templates")
    .insert({
      track_id: track!.id,
      name: e2eName("Template Hubs List"),
      modules: [{ type: "founders", enabled: true, mode: "auto", ids: [], featured_only: false, limit: null }],
    })
    .select()
    .single();

  const leadOneName = e2eName("Applicant Hubs List One");
  await page.goto("/forms/e2e-smoke-test");
  await page.getByTestId("field-name").pressSequentially(leadOneName, { delay: 15 });
  await page.getByTestId("submit-button").click();
  await page.getByTestId("field-email").pressSequentially("poditivity.company@gmail.com", { delay: 15 });
  await page.getByTestId("submit-button").click();
  const sessionIdOne = await page.evaluate(() => sessionStorage.getItem("ffn_session_id"));
  await page.getByTestId("field-why").pressSequentially("Testing the admin-wide hubs list.", { delay: 15 });
  await acceptPrivacyConsent(page);
  await page.getByTestId("submit-button").click();
  await expect(page.getByTestId("submission-confirmation")).toBeVisible({ timeout: 15000 });

  const { data: submissionOne } = await serviceClient.from("form_submissions").select("id").eq("session_id", sessionIdOne).single();
  const { data: leadOne } = await serviceClient.from("leads").select("id").eq("form_submission_id", submissionOne!.id).single();

  // ---- 2. Create + send its hub through the existing lead-detail flow (ProofHubCard) ----
  await loginAsAdmin(page, TEST_ADMIN_EMAIL, `/admin/leads/${leadOne!.id}`);
  await expect(page.getByRole("heading", { name: leadOneName })).toBeVisible();
  await page.getByRole("button", { name: "Create hub", exact: true }).click();
  await page.getByLabel("Track", { exact: true }).selectOption({ label: trackName });
  await expect(page.getByLabel("Template", { exact: true })).toHaveValue(template!.id, { timeout: 15000 });
  // Create & Send is one action — this real hub is sent immediately, no
  // separate Send click needed. Poll the DB directly rather than scraping
  // page text for "sent": this lead-detail page also renders the Phase 5
  // email thread's own status badges, and a stage-triggered auto-email can
  // already show "sent" there before this hub's own round trip finishes.
  await page.getByRole("button", { name: "Create & Send", exact: true }).click();
  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("hubs").select("status").eq("lead_id", leadOne!.id).maybeSingle();
        return data?.status ?? null;
      },
      { timeout: 15000 },
    )
    .toBe("sent");

  const { data: hubOne } = await serviceClient.from("hubs").select("id").eq("lead_id", leadOne!.id).single();

  // ---- 3. The admin-wide list shows this real hub with real data ----
  await page.goto("/admin/hubs");
  await expect(page.getByRole("heading", { name: "Applicant Hubs" })).toBeVisible();
  const row = page.getByTestId(`hub-row-${hubOne!.id}`);
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(row.getByText(leadOneName, { exact: true })).toBeVisible();
  await expect(row.getByText(trackName, { exact: true })).toBeVisible(); // track badge
  await expect(row.getByText("sent", { exact: true })).toBeVisible();

  // ---- 4. Search actually filters ----
  const search = page.getByRole("textbox", { name: "Search applicants" });
  await search.fill("no such applicant at all");
  await expect(row).not.toBeVisible();
  await expect(page.getByText("No hubs match your search")).toBeVisible();
  await search.fill(leadOneName);
  await expect(row).toBeVisible();

  // ---- 5. Templates entry point reuses the real Hub Templates manager ----
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hub templates" })).toBeVisible();

  // ---- 6. From application: pick a different, hub-less lead and create
  // through the real, reused CreateHubModal — proving this entry point
  // doesn't dead-end ----
  await page.goto("/forms/e2e-smoke-test");
  const leadTwoName = e2eName("Applicant Hubs List Two");
  await page.getByTestId("field-name").pressSequentially(leadTwoName, { delay: 15 });
  await page.getByTestId("submit-button").click();
  await page.getByTestId("field-email").pressSequentially("poditivity.company@gmail.com", { delay: 15 });
  await page.getByTestId("submit-button").click();
  const sessionIdTwo = await page.evaluate(() => sessionStorage.getItem("ffn_session_id"));
  await page.getByTestId("field-why").pressSequentially("Testing From application from the admin-wide list.", { delay: 15 });
  await acceptPrivacyConsent(page);
  await page.getByTestId("submit-button").click();
  await expect(page.getByTestId("submission-confirmation")).toBeVisible({ timeout: 15000 });
  const { data: submissionTwo } = await serviceClient.from("form_submissions").select("id").eq("session_id", sessionIdTwo).single();
  const { data: leadTwo } = await serviceClient.from("leads").select("id").eq("form_submission_id", submissionTwo!.id).single();

  // Already authenticated from step 2's loginAsAdmin — the session cookie
  // persists across navigations within this same browser context, so a
  // plain goto suffices without signing in again.
  await page.goto("/admin/hubs");
  await expect(page.getByRole("heading", { name: "Applicant Hubs" })).toBeVisible();
  await page.getByRole("button", { name: "From application", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create hub from an application" })).toBeVisible();
  await page.getByRole("textbox", { name: "Find an applicant" }).fill(leadTwoName);
  await page.getByRole("button", { name: "Create hub", exact: true }).click();

  // The same CreateHubModal ProofHubCard uses — not a second implementation.
  await page.getByLabel("Track", { exact: true }).selectOption({ label: trackName });
  await expect(page.getByLabel("Template", { exact: true })).toHaveValue(template!.id, { timeout: 15000 });
  await page.getByRole("button", { name: "Create & Send", exact: true }).click();

  // Lands on the new hub's own page, not back on the lead.
  await expect(page).toHaveURL(/\/admin\/hubs\/[0-9a-f-]{36}$/, { timeout: 15000 });
  // Poll the DB directly rather than scraping page text for "sent" — see
  // the identical note on step 2 above.
  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("hubs").select("status").eq("lead_id", leadTwo!.id).maybeSingle();
        return data?.status ?? null;
      },
      { timeout: 15000 },
    )
    .toBe("sent");

  const { data: hubTwo } = await serviceClient.from("hubs").select("id").eq("lead_id", leadTwo!.id).single();
  expect(hubTwo).not.toBeNull();
});

// A separate test, not a step 7 tacked onto the one above: the test above
// already does two full real create flows (steps 2 and 6) plus list/search/
// nav checks and was already running close to its 90s budget by the time it
// reached the end of step 6 — a third full flow in the same test would only
// ever get whatever budget happened to be left over, timing out on pure bad
// luck regardless of whether the feature works. This gets its own fresh
// budget instead.
//
// New hub: a standalone applicant who isn't a lead at all — the actual
// feature request. Proves the form collects name/email/WhatsApp directly,
// the hub is created with no lead_id, it lists correctly, and Create & Send
// genuinely sends it in the same action (the hub-send edge function's
// fallback to the hub's own applicant_email, not just a type-level change).
test("New hub creates a standalone applicant hub with no lead, and Create & Send sends it immediately", async ({ page }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to mint an admin session");
  test.setTimeout(60_000);

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = Date.now();

  const trackName = e2eName("Track Standalone Hubs List");
  const { data: track } = await serviceClient
    .from("tracks")
    .insert({ name: trackName, slug: `hubs-list-standalone-e2e-${stamp}` })
    .select()
    .single();
  const { data: template } = await serviceClient
    .from("hub_templates")
    .insert({
      track_id: track!.id,
      name: e2eName("Template Standalone Hubs List"),
      modules: [{ type: "founders", enabled: true, mode: "auto", ids: [], featured_only: false, limit: null }],
    })
    .select()
    .single();

  await loginAsAdmin(page, TEST_ADMIN_EMAIL, "/admin/hubs");
  await expect(page.getByRole("heading", { name: "Applicant Hubs" })).toBeVisible();

  const standaloneName = e2eName("Applicant Standalone Hubs List");
  await page.getByRole("button", { name: "New hub", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create proof hub" })).toBeVisible();
  // No exact:true on either of these: both are required, and the Field
  // component renders a "*" inside its <label> alongside the text (see
  // src/components/ffn/Field.tsx) — the same reason the already-passing
  // content-database.spec.ts locates the equally-required "Founder name"
  // field via a plain, non-exact getByLabel.
  await page.getByLabel("Applicant name").fill(standaloneName);
  await page.getByLabel("Email").fill("poditivity.company@gmail.com");
  await page.getByLabel("WhatsApp number", { exact: true }).fill("919876543210");
  await page.getByLabel("Track", { exact: true }).selectOption({ label: trackName });
  await expect(page.getByLabel("Template", { exact: true })).toHaveValue(template!.id, { timeout: 15000 });
  // Create & Send is one action now — no separate Send click needed.
  await page.getByRole("button", { name: "Create & Send", exact: true }).click();

  // Unlike the lead-backed flow above, this one never navigates away from
  // /admin/hubs — the modal just opens on top of it. That means the URL
  // already matches /admin/hubs before Create & Send is even clicked, so
  // asserting on the URL here would resolve instantly without ever waiting
  // for the createHub()+sendHub() network calls to finish, and the DB query
  // below would race the actual insert. Wait for the modal to close instead
  // — it only does so after onCreated fires, which only happens once both
  // calls have resolved.
  await expect(page.getByRole("heading", { name: "Create proof hub" })).not.toBeVisible({ timeout: 15000 });

  // Real network round trip (create, then hub-send -> ZeptoMail -> DB
  // update) — poll rather than assume it's already landed.
  const { data: standaloneHub } = await serviceClient
    .from("hubs")
    .select("id, lead_id, applicant_name, applicant_email, applicant_whatsapp")
    .eq("applicant_name", standaloneName)
    .single();
  expect(standaloneHub!.lead_id).toBeNull();
  expect(standaloneHub!.applicant_email).toBe("poditivity.company@gmail.com");
  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("hubs").select("status").eq("id", standaloneHub!.id).single();
        return data?.status;
      },
      { timeout: 15000 },
    )
    .toBe("sent");

  const standaloneRow = page.getByTestId(`hub-row-${standaloneHub!.id}`);
  await expect(standaloneRow).toBeVisible({ timeout: 15000 });
  await expect(standaloneRow.getByText(standaloneName, { exact: true })).toBeVisible();
  // A standalone row's name isn't a link (no lead page exists to link to).
  await expect(standaloneRow.getByRole("link", { name: new RegExp(standaloneName) })).toHaveCount(0);
  await expect(standaloneRow.getByText("sent", { exact: true })).toBeVisible();
});
