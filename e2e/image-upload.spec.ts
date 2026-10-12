import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createServiceRoleClient, loginAsAdmin, TEST_ADMIN_EMAIL } from "../test-support/adminSession";
import { e2eName } from "../test-support/e2eData";

// Real end-to-end upload to Cloudflare R2, through the real admin UI.
//
// Like e2e/content-database.spec.ts this runs in CI, not in this repo's
// sandbox (egress to *.supabase.co is blocked there). It needs:
//   SUPABASE_SERVICE_ROLE_KEY      to log in as a real admin and read rows back
//   E2E_R2_PUBLIC_BASE_URL         the bucket's public address, the same value as
//                                  the R2_PUBLIC_BASE_URL function secret
// and the r2-presign function deployed with its R2_* secrets set, plus a CORS
// rule on the bucket that allows PUT from the app's origin.

const FIXTURE = "e2e/fixtures/test-photo.png";
const PUBLIC_BASE = (process.env.E2E_R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY || !PUBLIC_BASE, "needs SUPABASE_SERVICE_ROLE_KEY and E2E_R2_PUBLIC_BASE_URL");

/** True once the browser has decoded the image, which a 200 from the upload step does not show. */
async function renders(img: Locator) {
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { message: "image should decode" })
    .toBe(true);
}

/** Fetches the stored URL outside the browser and checks the bytes are the file that was picked. */
async function expectRetrievable(page: Page, url: string) {
  expect(url.startsWith(`${PUBLIC_BASE}/`), `${url} should be on the public bucket address`).toBe(true);
  expect(url).not.toContain("cloudflarestorage.com");
  const res = await page.request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
  expect(Buffer.compare(await res.body(), readFileSync(FIXTURE))).toBe(0);
}

test("upload a founder photo and startup logo, store real R2 URLs, and see them render after a reload", async ({ page }) => {
  const db = createServiceRoleClient();
  const name = e2eName("Founder Upload");

  await loginAsAdmin(page, TEST_ADMIN_EMAIL, "/admin/content/founders");
  await page.getByRole("button", { name: "New founder" }).click();
  await page.getByLabel("Founder name").fill(name);
  await page.getByLabel("Startup name").fill(`${name} Labs`);

  // Pick a real file in each control and wait for the preview to decode.
  await page.getByTestId("founder-photo-input").setInputFiles(FIXTURE);
  await renders(page.getByTestId("founder-photo-preview"));
  await page.getByTestId("founder-logo-input").setInputFiles(FIXTURE);
  await renders(page.getByTestId("founder-logo-preview"));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(name).first()).toBeVisible();

  // The row holds the public URLs, not object keys and not the S3 endpoint.
  const { data: row, error } = await db.from("founders").select("id, photo_url, startup_logo_url").eq("name", name).single();
  expect(error).toBeNull();
  for (const url of [row!.photo_url, row!.startup_logo_url]) {
    expect(url).toMatch(/^https:\/\//);
    await expectRetrievable(page, url!);
  }
  expect(row!.photo_url).toContain("/founders/photos/");
  expect(row!.startup_logo_url).toContain("/founders/logos/");

  // After a full reload, the saved photo still renders from its stored URL.
  await page.reload();
  // The row is the innermost block holding both the name and an Edit button.
  await page.locator("div").filter({ hasText: name }).filter({ has: page.getByRole("button", { name: "Edit" }) }).last().getByRole("button", { name: "Edit" }).click();
  await renders(page.getByTestId("founder-photo-preview"));
  await expect(page.getByTestId("founder-photo-preview")).toHaveAttribute("src", row!.photo_url!);

  await db.from("founders").delete().eq("id", row!.id);
});

test("upload a mentor photo, and a pasted link still works as an alternative", async ({ page }) => {
  const db = createServiceRoleClient();
  const uploaded = e2eName("Mentor Upload");
  const pasted = e2eName("Mentor Pasted");
  const pastedUrl = "https://example.com/avatars/someone.png";

  await loginAsAdmin(page, TEST_ADMIN_EMAIL, "/admin/content/mentors");

  async function createMentor(name: string, photo: (page: Page) => Promise<void>) {
    await page.getByRole("button", { name: "New mentor" }).click();
    // Required fields carry a trailing asterisk in their label, so an exact "Name" never matches.
    await page.getByLabel(/^Name/).fill(name);
    await page.getByLabel(/^Role/).fill("Advisor");
    await page.getByLabel(/^Expertise/).fill("Go to market");
    await photo(page);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  }

  await createMentor(uploaded, async (p) => {
    await p.getByTestId("mentor-photo-input").setInputFiles(FIXTURE);
    await renders(p.getByTestId("mentor-photo-preview"));
  });
  await createMentor(pasted, async (p) => {
    await p.getByRole("button", { name: "Paste a link instead" }).click();
    await p.getByTestId("mentor-photo-link").fill(pastedUrl);
  });

  const { data: rows } = await db.from("mentors").select("id, name, photo_url").in("name", [uploaded, pasted]);
  const byName = (n: string) => rows!.find((r) => r.name === n)!;

  await expectRetrievable(page, byName(uploaded).photo_url!);
  expect(byName(uploaded).photo_url).toContain("/mentors/photos/");
  // A pasted link is stored exactly as typed.
  expect(byName(pasted).photo_url).toBe(pastedUrl);

  await db.from("mentors").delete().in("id", rows!.map((r) => r.id));
});
