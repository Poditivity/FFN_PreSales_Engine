import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { loginAsAdmin, TEST_ADMIN_EMAIL } from "../test-support/adminSession";
import { e2eName } from "../test-support/e2eData";

// Real end-to-end run against the live Supabase project, same constraint as
// e2e/form-submission.spec.ts and e2e/leads-pipeline.spec.ts (this sandbox's
// egress policy blocks *.supabase.co) — runs in CI, not locally. Needs
// SUPABASE_SERVICE_ROLE_KEY to log in as a real admin without an email
// round-trip and to assert DB state directly (no public read policy on any
// content table).
test("create a founder, tag a co-founder, and create a case study spanning two unrelated founders", async ({
  page,
}) => {
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to mint an admin session");

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const stamp = Date.now();
  const nameA = e2eName("Founder Ada Lovelace");
  const nameB = e2eName("Founder Grace Hopper");
  const nameC = e2eName("Founder Alan Turing");

  // ---- Log in as a real admin (no email round-trip) ----
  await loginAsAdmin(page, TEST_ADMIN_EMAIL, "/admin/content/founders");
  await expect(page.getByRole("heading", { name: "Content database" })).toBeVisible();

  // ---- Create three founders through the real admin UI ----
  async function createFounder(name: string) {
    await page.getByRole("button", { name: "New founder" }).click();
    await page.getByLabel("Founder name").fill(name);
    // A founder needs a startup name as well as a founder name.
    await page.getByLabel("Startup name").fill(`${name} Labs`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  }

  await createFounder(nameA);
  await createFounder(nameB);
  await createFounder(nameC);

  // ---- Tag B as a co-founder of A ----
  await page.getByRole("link", { name: new RegExp(nameA) }).click();
  await expect(page.getByRole("heading", { name: nameA })).toBeVisible();
  await page.getByLabel("Add a co-founder").selectOption({ label: `${nameB} (${nameB} Labs)` });
  await page.getByRole("button", { name: "Link" }).click();
  await expect(page.getByText(nameB)).toBeVisible();

  // ---- Real DB check: the link is symmetric ----
  const { data: founderRows } = await serviceClient
    .from("founders")
    .select("id, name")
    .in("name", [nameA, nameB, nameC]);
  const idOf = (name: string) => founderRows!.find((f) => f.name === name)!.id;
  const [idA, idB, idC] = [idOf(nameA), idOf(nameB), idOf(nameC)];

  const { data: linksFromA } = await serviceClient
    .from("founder_co_founder_links")
    .select("co_founder_id")
    .eq("founder_id", idA);
  const { data: linksFromB } = await serviceClient
    .from("founder_co_founder_links")
    .select("co_founder_id")
    .eq("founder_id", idB);
  expect(linksFromA?.map((r) => r.co_founder_id)).toContain(idB);
  expect(linksFromB?.map((r) => r.co_founder_id)).toContain(idA);

  // ---- Create a case study spanning A and C (not co-founders of each other) ----
  const caseStudyTitle = e2eName("Case Study Zero to Revenue");
  await page.goto("/admin/content/case-studies");
  await page.getByRole("button", { name: "New case study" }).click();
  await page.getByLabel("Title").fill(caseStudyTitle);
  // A case study needs its link and at least one founder.
  await page.getByLabel("Case study link").fill(`https://example.com/case-studies/${stamp}`);
  await page.getByRole("combobox").first().selectOption({ label: `${nameA} (${nameA} Labs)` });
  await page.getByRole("button", { name: "Add another founder" }).click();
  await page.getByRole("combobox").nth(1).selectOption({ label: `${nameC} (${nameC} Labs)` });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(caseStudyTitle)).toBeVisible();

  // ---- Real DB check: both founders are linked to the case study ----
  const { data: caseStudy } = await serviceClient
    .from("case_studies")
    .select("id")
    .eq("title", caseStudyTitle)
    .single();
  const { data: csFounders } = await serviceClient
    .from("case_study_founders")
    .select("founder_id")
    .eq("case_study_id", caseStudy!.id);
  const linkedIds = csFounders?.map((r) => r.founder_id) ?? [];
  expect(linkedIds).toContain(idA);
  expect(linkedIds).toContain(idC);
  // A and C were never tagged as co-founders of each other — confirms the
  // case study's founder link is independent of founder_co_founders.
  expect(linkedIds).not.toContain(idB);
});
