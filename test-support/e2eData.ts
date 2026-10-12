// Everything the Playwright suite creates in Supabase is named with E2E_PREFIX,
// so it is recognisable in the admin UI and so the suite can find and delete its
// own rows. Nothing else in the project may start with this prefix.
//
// cleanUpE2eData() runs before and after the whole suite (see e2eGlobal.ts), so
// a run starts from, and leaves behind, a database with no test data in it. The
// "e2e-smoke-test" form the specs submit to is created by ensureSmokeForm() when a
// suite starts and deleted by removeSmokeForm() when it ends, so it never sits in
// a database between runs.
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEST_ADMIN_EMAIL, createServiceRoleClient, isDisposableTestEmail } from "./adminSession";

export const E2E_PREFIX = "E2E ";
export const SMOKE_FORM_SLUG = "e2e-smoke-test";
export const SMOKE_FORM_TITLE = e2eName("Smoke Test Form");
/** A throwaway account the RLS integration test signs in as; it is never given a role. */
export const RLS_TEST_EMAIL = "leads-rls-nonadmin-test@example.com";

const question = (id: string, type: string, label: string, y: number) => ({
  id,
  type: "question",
  position: { x: 80, y },
  data: { field: { id, type, label, placeholder: "", required: true, helpText: "", width: "full", validation: {}, showIf: null } },
});

/** Name, email, why: the three-question flow every spec walks through. */
export const SMOKE_FORM_SCHEMA = {
  version: 2,
  startNodeId: "start",
  nodes: [
    { id: "start", type: "start", position: { x: 80, y: 40 }, data: {} },
    question("name", "text", "Full name", 180),
    question("email", "email", "Email", 320),
    question("why", "textarea", "Why do you want to join?", 460),
    { id: "end1", type: "end", position: { x: 80, y: 600 }, data: { label: "Finish", message: "", redirect_url: "" } },
  ],
  edges: [
    { id: "e1", source: "start", target: "name", type: "flow", data: { kind: "always" } },
    { id: "e2", source: "name", target: "email", type: "flow", data: { kind: "always" } },
    { id: "e3", source: "email", target: "why", type: "flow", data: { kind: "always" } },
    { id: "e4", source: "why", target: "end1", type: "flow", data: { kind: "always" } },
  ],
};

/** `e2eName("Applicant Hub Create")` -> `E2E Applicant Hub Create`. */
export function e2eName(label: string): string {
  return `${E2E_PREFIX}${label}`;
}

const LIKE = `${E2E_PREFIX}%`;

/** Makes sure the smoke-test form exists and returns its id. */
export async function ensureSmokeForm(db: SupabaseClient = createServiceRoleClient()): Promise<string> {
  const { data: existing } = await db.from("forms").select("id").eq("slug", SMOKE_FORM_SLUG).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await db
    .from("forms")
    .insert({ title: SMOKE_FORM_TITLE, slug: SMOKE_FORM_SLUG, status: "active", schema: SMOKE_FORM_SCHEMA })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create the smoke-test form: ${error?.message ?? "no row returned"}`);
  return data.id as string;
}

/** Deletes the smoke-test form. Its submissions, leads and email logs go with it. */
export async function removeSmokeForm(db: SupabaseClient = createServiceRoleClient()): Promise<void> {
  const { error } = await db.from("forms").delete().eq("slug", SMOKE_FORM_SLUG);
  if (error) throw new Error(`delete forms: ${error.message}`);
}

async function ids(db: SupabaseClient, table: string, column: string): Promise<string[]> {
  const { data, error } = await db.from(table).select("id").like(column, LIKE);
  if (error) throw new Error(`select ${table}: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

async function remove(db: SupabaseClient, table: string, column: string, values: string[]): Promise<void> {
  if (values.length === 0) return;
  const { error } = await db.from(table).delete().in(column, values);
  if (error) throw new Error(`delete ${table}: ${error.message}`);
}

/**
 * Deletes every row the e2e suite may have created. Order matters: hubs.track_id
 * has no ON DELETE action, so hubs go before tracks; deleting a smoke-form
 * submission cascades to its lead, the lead's hub, email thread, calls, etc.
 */
export async function cleanUpE2eData(db: SupabaseClient = createServiceRoleClient()): Promise<void> {
  const trackIds = await ids(db, "tracks", "name");

  // Hubs: on a test track, or for a standalone test applicant.
  const hubIds = new Set<string>();
  if (trackIds.length > 0) {
    const { data } = await db.from("hubs").select("id").in("track_id", trackIds);
    (data ?? []).forEach((h) => hubIds.add(h.id as string));
  }
  const { data: standalone } = await db.from("hubs").select("id").like("applicant_name", LIKE);
  (standalone ?? []).forEach((h) => hubIds.add(h.id as string));
  await remove(db, "hubs", "id", [...hubIds]);

  // Smoke-form submissions made by the suite (-> leads -> everything on a lead).
  const { data: form } = await db.from("forms").select("id").eq("slug", SMOKE_FORM_SLUG).maybeSingle();
  if (form) {
    const { data: submissions } = await db.from("form_submissions").select("id").eq("form_id", form.id).like("data->>name", LIKE);
    await remove(db, "form_submissions", "id", (submissions ?? []).map((s) => s.id as string));
    await db.from("analytics_events").delete().eq("form_slug", SMOKE_FORM_SLUG);
  }

  // Content and templates (tracks cascade to their hub templates).
  await remove(db, "founders", "id", await ids(db, "founders", "name"));
  await remove(db, "mentors", "id", await ids(db, "mentors", "name"));
  await remove(db, "case_studies", "id", await ids(db, "case_studies", "title"));
  await remove(db, "email_templates", "id", await ids(db, "email_templates", "name"));
  await remove(db, "tracks", "id", trackIds);

  // Throwaway team accounts. Only ever disposable addresses; profiles cascade from auth.users.
  const emails = [TEST_ADMIN_EMAIL, RLS_TEST_EMAIL];
  const { data: invitees } = await db.from("profiles").select("email").like("email", "admin-team-e2e-%");
  (invitees ?? []).forEach((p) => emails.push(p.email as string));
  for (const email of emails.filter(isDisposableTestEmail)) {
    const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    if (profile?.id) await db.auth.admin.deleteUser(profile.id as string);
  }
}
