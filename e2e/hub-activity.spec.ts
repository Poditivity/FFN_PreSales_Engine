import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { loginAsAdmin, TEST_ADMIN_EMAIL } from "../test-support/adminSession";
import { e2eName } from "../test-support/e2eData";

// Real end-to-end run against the live Supabase project, same constraint as
// e2e/hub.spec.ts (this sandbox's egress policy blocks *.supabase.co) — runs
// in CI, not locally.
//
// Verifies the detailed hub analytics this repo was missing compared to
// build-fellowship: which sections a visitor viewed, how long each held
// their attention, and which buttons/links they clicked — on top of the
// open_count counter hub-hydrate already kept. Own file, own budget: this
// needs a real ~15s dwell for a heartbeat to fire and a real flush-interval
// wait on top of that (see src/lib/hubs/tracker.ts), which would starve any
// other scenario sharing the same test's timeout.
test("a hub page tracks section views, dwell time, and link clicks; the admin activity view shows them", async ({ page, context }) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to seed/assert DB state directly");
  test.setTimeout(90_000);

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = Date.now();

  // ---- 1. A standalone hub (no lead needed to exercise public-page tracking) ----
  const { data: track } = await serviceClient
    .from("tracks")
    .insert({ name: e2eName("Track Hub Activity"), slug: `hub-activity-e2e-${stamp}` })
    .select()
    .single();
  const founderName = e2eName("Founder Hub Activity");
  await serviceClient.from("founders").insert({ name: founderName, visibility: "public", audience: [] });
  const linkLabel = e2eName("Link Hub Activity");

  const { data: template } = await serviceClient
    .from("hub_templates")
    .insert({
      track_id: track!.id,
      name: e2eName("Template Hub Activity"),
      modules: [
        { type: "founders", enabled: true, title: null, subtitle: null, mode: "auto", ids: [], featured_only: false, limit: null, links: [] },
        {
          type: "links",
          enabled: true,
          title: null,
          subtitle: null,
          mode: "auto",
          ids: [],
          featured_only: false,
          limit: null,
          links: [{ label: linkLabel, url: "https://example.com/hub-activity-e2e" }],
        },
      ],
    })
    .select()
    .single();

  const { data: hub } = await serviceClient
    .from("hubs")
    .insert({
      lead_id: null,
      track_id: track!.id,
      template_id: template!.id,
      modules: null,
      applicant_name: e2eName("Applicant Hub Activity"),
      applicant_email: "poditivity.company@gmail.com",
    })
    .select()
    .single();

  // ---- 2. Visit the public page: center the founders section and click the link ----
  await page.goto(`/hub/${hub!.token}`);
  await expect(page.getByText(founderName)).toBeVisible({ timeout: 15000 });
  // scrollIntoViewIfNeeded only scrolls to the nearest viewport *edge* — the
  // production tracker's IntersectionObserver instead watches a thin band
  // around the exact vertical *center* (rootMargin: "-45% 0px -45% 0px" in
  // useSectionEngagement, src/lib/hubs/tracker.ts). The section can cross
  // that center band momentarily during the scroll itself (which is why
  // section_view alone was already passing) while settling outside it at
  // rest, so no heartbeat ever logs. Scroll to put the section's own
  // midpoint at the viewport's midpoint instead, matching what the tracker
  // actually watches for.
  await page.locator("#founders").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const targetScrollY = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(targetScrollY, 0), left: 0, behavior: "instant" });
  });

  // Poll for the heartbeat rather than a fixed sleep-then-check-once: the
  // heartbeat's own 15s timer starts when hub-hydrate resolves (data load),
  // but the tracker's batch flush that actually writes it to hub_events
  // runs on a *separate* 8s timer started at page mount (see useHubTracker
  // vs useSectionEngagement in src/lib/hubs/tracker.ts). Those two clocks
  // aren't aligned, so a fixed wait can land in the gap between when the
  // heartbeat fires in-browser and when the next flush tick actually sends
  // it — confirmed via the live hub_events rows from the prior failed CI
  // run (36260512366): only hub_view + section_view had landed, both
  // flushed together in one batch, and no heartbeat row ever appeared even
  // much later. Polling is immune to exactly which tick picks it up.
  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("hub_events").select("type, target_id").eq("hub_id", hub!.id);
        return (data ?? []).some((e) => e.type === "heartbeat" && e.target_id === "founders");
      },
      { timeout: 40_000, intervals: [2000] },
    )
    .toBe(true);

  const { data: eventsAfterDwell } = await serviceClient.from("hub_events").select("type, target_id").eq("hub_id", hub!.id);
  expect(eventsAfterDwell!.some((e) => e.type === "hub_view")).toBe(true);
  expect(eventsAfterDwell!.some((e) => e.type === "section_view" && e.target_id === "founders")).toBe(true);

  // The link opens in a new tab (target="_blank") — the click handler that
  // records it runs before that navigation, so the new tab itself is
  // irrelevant beyond not leaving it dangling. Only click it now, after the
  // heartbeat above is already confirmed — a heartbeat only logs while the
  // tab is actually visible, and opening the link's new tab steals focus in
  // Chromium, flipping this tab to hidden for the rest of the test.
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: linkLabel }).click();
  const popup = await popupPromise;
  await popup.close();
  await page.bringToFront();

  // Same independent-timer reasoning as the heartbeat above — poll for the
  // click's flush instead of assuming a fixed wait lands after it.
  await expect
    .poll(
      async () => {
        const { data } = await serviceClient.from("hub_events").select("type, target_type, target_id").eq("hub_id", hub!.id);
        return (data ?? []).some((e) => e.type === "cta_click" && e.target_type === "links" && e.target_id === linkLabel);
      },
      { timeout: 15_000, intervals: [2000] },
    )
    .toBe(true);

  // ---- 3. The admin-wide hubs list's activity view surfaces this real data ----
  await loginAsAdmin(page, TEST_ADMIN_EMAIL, "/admin/hubs");
  await expect(page.getByRole("heading", { name: "Applicant Hubs" })).toBeVisible();

  const row = page.getByTestId(`hub-row-${hub!.id}`);
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole("button", { name: "View activity" }).click();
  await expect(page.getByRole("heading", { name: "Hub activity" })).toBeVisible();

  await expect(page.getByText("Founders").first()).toBeVisible({ timeout: 15000 });
  // The click shows up in the activity timeline as "Clicked link: <label>", and the
  // summary sentence quotes the label too, so match the timeline's own text exactly.
  await expect(page.getByText(`Clicked link: ${linkLabel}`, { exact: true })).toBeVisible();
});
