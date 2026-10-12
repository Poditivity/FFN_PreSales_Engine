import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { acceptPrivacyConsent } from "./fixtures/consent";
import { createServiceRoleClient } from "../test-support/adminSession";

// Real end-to-end upload from a public form to Cloudflare R2.
//
// Like e2e/image-upload.spec.ts this runs in CI, not in this repo's sandbox. It
// needs SUPABASE_SERVICE_ROLE_KEY (to create a throwaway form and read the
// submission back) and E2E_R2_PUBLIC_BASE_URL (the same value as the
// R2_PUBLIC_BASE_URL function secret), the form-upload-presign function
// deployed with its R2_* secrets, the app_settings migration applied, and a CORS
// rule on the bucket that allows PUT from the app's origin.

const FIXTURE = "e2e/fixtures/test-photo.png";
const PUBLIC_BASE = (process.env.E2E_R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY || !PUBLIC_BASE, "needs SUPABASE_SERVICE_ROLE_KEY and E2E_R2_PUBLIC_BASE_URL");

test("an applicant uploads a file, the form refuses a type it does not accept, and the answer is a real R2 link", async ({ page }) => {
  const db = createServiceRoleClient();
  const slug = `e2e-file-upload-${Date.now()}`;
  const fieldId = "field_upload01";

  const { data: form, error } = await db
    .from("forms")
    .insert({
      title: "E2E file upload",
      slug,
      status: "active",
      post_submit_action: "message",
      thank_you_message: "Thanks",
      schema: {
        version: 2,
        startNodeId: "start",
        nodes: [
          { id: "start", type: "start", position: { x: 0, y: 0 }, data: {}, deletable: false },
          {
            id: fieldId,
            type: "question",
            position: { x: 0, y: 100 },
            data: {
              field: {
                id: fieldId,
                type: "file",
                label: "Your pitch deck",
                placeholder: "",
                required: true,
                helpText: "",
                width: "full",
                validation: {},
                showIf: null,
                fileConfig: { categories: ["images"], maxMb: 5 },
              },
            },
          },
          { id: "end_1", type: "end", position: { x: 0, y: 200 }, data: { label: "Finish", message: "", redirect_url: "" } },
        ],
        edges: [
          { id: "e1", source: "start", target: fieldId, type: "flow", data: { kind: "always" } },
          { id: "e2", source: fieldId, target: "end_1", type: "flow", data: { kind: "always" } },
        ],
      },
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  try {
    await page.goto(`/forms/${slug}`);
    await expect(page.getByText("Images. Up to 5 MB.")).toBeVisible();

    // A type the question did not turn on is refused before anything is uploaded.
    await page.getByTestId(`field-${fieldId}`).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText(/not accepted here/)).toBeVisible();

    // Submitting without a file says so.
    await acceptPrivacyConsent(page);
    await page.getByTestId("submit-button").click();
    await expect(page.getByText("This field is required").first()).toBeVisible();

    // A real image goes straight to R2.
    await page.getByTestId(`field-${fieldId}`).setInputFiles(FIXTURE);
    await expect(page.getByTestId(`file-name-${fieldId}`)).toContainText("test-photo.png", { timeout: 20000 });

    await page.getByTestId("submit-button").click();
    await expect(page.getByTestId("submission-confirmation")).toBeVisible({ timeout: 15000 });

    const { data: submission } = await db
      .from("form_submissions")
      .select("data, completed")
      .eq("form_id", form!.id)
      .single();
    expect(submission!.completed).toBe(true);
    const url = (submission!.data as Record<string, unknown>)[fieldId] as string;
    expect(url.startsWith(`${PUBLIC_BASE}/forms/${form!.id}/`)).toBe(true);
    expect(url).toMatch(/\.png$/);
    expect(url).not.toContain("cloudflarestorage.com");
    expect((submission!.data as Record<string, unknown>).__consent).toMatchObject({ accepted: true });

    const res = await page.request.get(url);
    expect(res.status()).toBe(200);
    expect(Buffer.compare(await res.body(), readFileSync(FIXTURE))).toBe(0);
  } finally {
    await db.from("forms").delete().eq("id", form!.id);
  }
});
