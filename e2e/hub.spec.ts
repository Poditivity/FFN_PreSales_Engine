import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { acceptPrivacyConsent } from "./fixtures/consent";
import { loginAsAdmin, TEST_ADMIN_EMAIL } from "../test-support/adminSession";
import { e2eName } from "../test-support/e2eData";

// Real end-to-end run against the live Supabase project, same constraint as
// e2e/leads-pipeline.spec.ts / e2e/content-database.spec.ts (this sandbox's
// egress policy blocks *.supabase.co) — runs in CI, not locally. Needs
// SUPABASE_SERVICE_ROLE_KEY to log in as a real admin without an email
// round-trip and to seed/assert DB state directly.
test("staff creates and sends a hub for a real lead; the public page respects track eligibility and the open/preview guard", async ({
  page,
}) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to mint an admin session");
  // Real, mostly-sequential network round trips: form submission, admin
  // login, hub create + send (up to a 15s poll), the public page's own
  // open/opened poll (up to another 15s), and an explicit 8.5s wait for the
  // engagement-event batch flush. That routinely runs past Playwright's
  // 30s default test timeout on a loaded CI runner — this test previously
  // failed in CI on exactly that boundary (run 35902332955, 2026-09-23),
  // not because anything in the product was broken.
  test.setTimeout(90_000);

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const stamp = Date.now();

  // ---- 1. Real lead: submit the Phase 1 smoke-test form ----
  await page.goto("/forms/e2e-smoke-test");
  await page.getByTestId("field-name").pressSequentially(e2eName("Applicant Hub Create"), { delay: 15 });
  await page.getByTestId("submit-button").click();
  await page.getByTestId("field-email").pressSequentially("poditivity.company@gmail.com", { delay: 15 });
  await page.getByTestId("submit-button").click();
  const sessionId = await page.evaluate(() => sessionStorage.getItem("ffn_session_id"));
  await page.getByTestId("field-why").pressSequentially("Testing the Phase 4 proof hub end to end.", { delay: 15 });
  await acceptPrivacyConsent(page);
  await page.getByTestId("submit-button").click();
  await expect(page.getByTestId("submission-confirmation")).toBeVisible({ timeout: 15000 });

  const { data: submission } = await serviceClient
    .from("form_submissions")
    .select("id")
    .eq("session_id", sessionId)
    .single();
  const { data: lead } = await serviceClient
    .from("leads")
    .select("id")
    .eq("form_submission_id", submission!.id)
    .single();

  // ---- 2. Seed a track, an off-track founder, and two eligible founders ----
  const { data: track } = await serviceClient
    .from("tracks")
    .insert({ name: e2eName("Track Hub Create"), slug: `hub-e2e-${stamp}` })
    .select()
    .single();
  const { data: otherTrack } = await serviceClient
    .from("tracks")
    .insert({ name: e2eName("Track Hub Create (other)"), slug: `hub-e2e-other-${stamp}` })
    .select()
    .single();

  const everyoneFounderName = e2eName("Founder Everyone");
  const inTrackFounderName = e2eName("Founder In-Track");
  const offTrackFounderName = e2eName("Founder Off-Track");
  await serviceClient.from("founders").insert([
    { name: everyoneFounderName, visibility: "public", audience: [] },
    { name: inTrackFounderName, visibility: "public", audience: [track!.id] },
    { name: offTrackFounderName, visibility: "public", audience: [otherTrack!.id] },
  ]);

  const { data: template } = await serviceClient
    .from("hub_templates")
    .insert({
      track_id: track!.id,
      name: e2eName("Template Hub Create"),
      modules: [
        { type: "founders", enabled: true, mode: "auto", ids: [], featured_only: false, limit: null },
        { type: "case_studies", enabled: false, mode: "auto", ids: [], featured_only: false, limit: null },
        { type: "testimonials", enabled: false, mode: "auto", ids: [], featured_only: false, limit: null },
        { type: "mentors", enabled: false, mode: "auto", ids: [], featured_only: false, limit: null },
        { type: "faqs", enabled: false, mode: "auto", ids: [], featured_only: false, limit: null },
      ],
    })
    .select()
    .single();

  // ---- 3. Log in as a real admin and create + send the hub from the lead page ----
  await loginAsAdmin(page, TEST_ADMIN_EMAIL, `/admin/leads/${lead!.id}`);
  await expect(page.getByRole("heading", { name: e2eName("Applicant Hub Create") })).toBeVisible();

  await page.getByRole("button", { name: "Create hub" }).click();
  await page.getByLabel("Track", { exact: true }).selectOption({ label: e2eName("Track Hub Create") });
  // The Template select only appears once the modal's own real Supabase
  // round trip (listHubTemplatesForTrack, fired from the Track onChange)
  // resolves — Playwright's 5s default assertion timeout is too tight for
  // that on a loaded CI runner, same underbudgeted-for-real-network-latency
  // shape as the .poll({timeout: 15000}) calls below.
  await expect(page.getByLabel("Template", { exact: true })).toHaveValue(template!.id, { timeout: 15000 });
  // Create & Send is one action — no separate Send click afterward (the
  // hub-detail Send button only appears for a still-draft hub, and this one
  // won't be).
  await page.getByRole("button", { name: "Create & Send", exact: true }).click();
  // Real network round trip (create, then hub-send -> ZeptoMail -> DB
  // update) — poll the DB directly rather than scraping page text for
  // "sent": this same lead-detail page also renders the Phase 5 email
  // thread's own status badges, and a stage-triggered auto-email can
  // already show "sent" there before this hub's own round trip finishes.
  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("hubs").select("status").eq("lead_id", lead!.id).maybeSingle();
        return data?.status ?? null;
      },
      { timeout: 15000 },
    )
    .toBe("sent");

  const { data: hub } = await serviceClient
    .from("hubs")
    .select("*")
    .eq("lead_id", lead!.id)
    .single();
  expect(hub!.track_id).toBe(track!.id);
  expect(hub!.template_id).toBe(template!.id);
  expect(hub!.modules).toBeNull(); // inherits the template — never customized in this flow
  expect(hub!.status).toBe("sent");

  // ---- 4. Public hub page: only track-eligible, public content renders ----
  // hub-hydrate is a real edge-function round trip (cold Deno invocation +
  // several DB queries) — 5s is too tight for the first visibility check
  // that depends on it finishing.
  await page.goto(`/hub/${hub!.token}`);
  await expect(page.getByText(everyoneFounderName)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(inTrackFounderName)).toBeVisible();
  await expect(page.getByText(offTrackFounderName)).not.toBeVisible();

  // ---- 5. The real (non-preview) view logged an open ----
  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("hubs").select("status, open_count").eq("id", hub!.id).single();
        return data?.status;
      },
      { timeout: 15000 },
    )
    .toBe("opened");
  const { data: afterFirstView } = await serviceClient
    .from("hubs")
    .select("open_count, first_opened_at")
    .eq("id", hub!.id)
    .single();
  expect(afterFirstView!.open_count).toBe(1);
  expect(afterFirstView!.first_opened_at).not.toBeNull();

  // Engagement events batch-flush on an 8s interval (see src/lib/hubs/tracker.ts) — wait for it rather than reloading, so this proves the real batching path, not just the immediate-open write.
  await page.waitForTimeout(8500);
  const { data: events } = await serviceClient.from("hub_events").select("type").eq("hub_id", hub!.id);
  expect((events ?? []).some((e) => e.type === "hub_view")).toBe(true);

  // ---- 6. A second, preview-mode view must not inflate open_count ----
  await page.goto(`/hub/${hub!.token}?preview=1`);
  await expect(page.getByText("not tracked")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(everyoneFounderName)).toBeVisible();

  // The hub is always light, even for a visitor whose saved choice is dark. A
  // preview view is not tracked, so reloading it here does not touch open_count.
  await page.evaluate(() => window.localStorage.setItem("ffn_theme", "dark"));
  await page.reload();
  await expect(page.getByText(everyoneFounderName)).toBeVisible({ timeout: 15000 });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.evaluate(() => window.localStorage.removeItem("ffn_theme"));
  await page.waitForTimeout(500);
  const { data: afterPreview } = await serviceClient.from("hubs").select("open_count, status").eq("id", hub!.id).single();
  expect(afterPreview!.open_count).toBe(1);
  expect(afterPreview!.status).toBe("opened");
});

// Phase 5 kickoff, Step 0.3: one real hub page load exercising three
// subsystems together — audience filtering (auto mode), hand-picked mode
// (bypasses audience/featured entirely), and a singleton block's
// hide-if-empty rule — not three isolated unit tests. Builds the hub row
// directly (hub creation through the admin UI is already proven by the test
// above) so this test's own page load is squarely about hub-hydrate's
// module resolution and the public page's rendering of it.
test("a single hub page load resolves audience filtering, hand-picked mode, and singleton auto-hide together", async ({
  page,
}) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to seed/assert DB state directly");

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const stamp = Date.now();

  // ---- 1. A real lead (form submission -> auto-created lead row) ----
  await page.goto("/forms/e2e-smoke-test");
  await page.getByTestId("field-name").pressSequentially(e2eName("Applicant Hub Combo"), { delay: 15 });
  await page.getByTestId("submit-button").click();
  await page.getByTestId("field-email").pressSequentially("poditivity.company@gmail.com", { delay: 15 });
  await page.getByTestId("submit-button").click();
  const sessionId = await page.evaluate(() => sessionStorage.getItem("ffn_session_id"));
  await page.getByTestId("field-why").pressSequentially("Testing the combined hub page load.", { delay: 15 });
  await acceptPrivacyConsent(page);
  await page.getByTestId("submit-button").click();
  await expect(page.getByTestId("submission-confirmation")).toBeVisible({ timeout: 15000 });

  const { data: submission } = await serviceClient
    .from("form_submissions")
    .select("id")
    .eq("session_id", sessionId)
    .single();
  const { data: lead } = await serviceClient
    .from("leads")
    .select("id")
    .eq("form_submission_id", submission!.id)
    .single();

  // ---- 2. Tracks + founders (audience filtering, auto mode) ----
  const { data: track } = await serviceClient
    .from("tracks")
    .insert({ name: e2eName("Track Hub Combo"), slug: `hub-combo-e2e-${stamp}` })
    .select()
    .single();
  const { data: otherTrack } = await serviceClient
    .from("tracks")
    .insert({ name: e2eName("Track Hub Combo (other)"), slug: `hub-combo-e2e-other-${stamp}` })
    .select()
    .single();

  const everyoneFounderName = e2eName("Combo Founder Everyone");
  const inTrackFounderName = e2eName("Combo Founder In-Track");
  const offTrackFounderName = e2eName("Combo Founder Off-Track");
  await serviceClient.from("founders").insert([
    { name: everyoneFounderName, visibility: "public", audience: [] },
    { name: inTrackFounderName, visibility: "public", audience: [track!.id] },
    { name: offTrackFounderName, visibility: "public", audience: [otherTrack!.id] },
  ]);

  // ---- 3. Mentors (hand-picked mode must bypass audience AND featured) ----
  // handPickedMentor is off-track and not featured — in auto mode it would
  // be filtered out twice over; hand-picked mode must show it anyway,
  // because ticked ids alone decide membership.
  // excludedMentor is in-track and featured — exactly what auto mode would
  // select — but it is deliberately left off the hand-picked list, proving
  // manual mode is a strict allowlist, not an additive one.
  const handPickedMentorName = e2eName("Combo Mentor Hand-Picked");
  const excludedMentorName = e2eName("Combo Mentor Excluded");
  const { data: mentors } = await serviceClient
    .from("mentors")
    .insert([
      { name: handPickedMentorName, visibility: "public", audience: [otherTrack!.id], featured: false },
      { name: excludedMentorName, visibility: "public", audience: [track!.id], featured: true },
    ])
    .select();
  const handPickedMentor = mentors!.find((m) => m.name === handPickedMentorName)!;

  // ---- 4. Singleton auto-hide: read ffn_profile's real, current state ----
  // rather than mutating it — ffn_profile is one shared global row, not
  // per-test fixture data, so this test observes whatever staff has
  // actually configured and asserts hub-hydrate's hide-if-empty rule
  // against that real state, instead of assuming it's empty.
  const { data: profile } = await serviceClient
    .from("ffn_profile")
    .select("credibility_founders_stat, credibility_programs_stat, credibility_events_stat, credibility_partnerships_stat")
    .eq("id", true)
    .single();
  const credibilityHasContent = [
    profile?.credibility_founders_stat,
    profile?.credibility_programs_stat,
    profile?.credibility_events_stat,
    profile?.credibility_partnerships_stat,
  ].some((v) => typeof v === "string" && v.trim() !== "");

  // ---- 5. One hub, one template, all three modules enabled together ----
  const { data: template } = await serviceClient
    .from("hub_templates")
    .insert({
      track_id: track!.id,
      name: e2eName("Template Hub Combo"),
      modules: [
        { type: "founders", enabled: true, mode: "auto", ids: [], featured_only: false, limit: null },
        { type: "mentors", enabled: true, mode: "manual", ids: [handPickedMentor.id], featured_only: false, limit: null },
        { type: "credibility", enabled: true, mode: "auto", ids: [], featured_only: false, limit: null },
      ],
    })
    .select()
    .single();

  const { data: hub } = await serviceClient
    .from("hubs")
    .insert({ lead_id: lead!.id, track_id: track!.id, template_id: template!.id, modules: null })
    .select()
    .single();

  // ---- 6. One page load; assert all three behaviors from it ----
  await page.goto(`/hub/${hub!.token}?preview=1`);

  // Audience filtering (auto mode): everyone + in-track show, off-track doesn't.
  // hub-hydrate is a real edge-function round trip — 5s is too tight for
  // this first visibility check.
  await expect(page.getByText(everyoneFounderName)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(inTrackFounderName)).toBeVisible();
  await expect(page.getByText(offTrackFounderName)).not.toBeVisible();

  // Hand-picked mode: the ticked (off-track, non-featured) mentor shows;
  // the un-ticked (in-track, featured) mentor — what auto mode would have
  // picked instead — does not.
  await expect(page.getByText(handPickedMentorName)).toBeVisible();
  await expect(page.getByText(excludedMentorName)).not.toBeVisible();

  // Singleton auto-hide: the credibility section appears iff ffn_profile
  // actually has credibility content right now.
  const credibilitySection = page.locator("#credibility");
  if (credibilityHasContent) {
    await expect(credibilitySection).toBeVisible();
  } else {
    await expect(credibilitySection).toHaveCount(0);
  }
});
