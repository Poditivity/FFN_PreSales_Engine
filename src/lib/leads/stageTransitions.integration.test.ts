import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createServiceRoleClient,
  createSessionClient,
  mintSession,
  TEST_ADMIN_EMAIL,
  type MintedSession,
} from "../../../test-support/adminSession";
import { cleanUpE2eData, e2eName, ensureSmokeForm, RLS_TEST_EMAIL, removeSmokeForm } from "../../../test-support/e2eData";

// Real end-to-end run against the live Supabase project (RLS/triggers can't
// be exercised meaningfully with mocks). Needs SUPABASE_SERVICE_ROLE_KEY to
// mint sessions without an email round-trip — see test-support/adminSession.
// This sandbox's egress policy blocks *.supabase.co (same constraint as
// e2e/form-submission.spec.ts), so this suite runs in CI, not locally, and
// skips entirely if the key isn't configured yet.
const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = TEST_ADMIN_EMAIL;
// A dedicated, disposable email — never promoted to admin/staff, so it
// always gets handle_new_user's plain default profile (role defaults to
// 'founder'). That's the real permission boundary this test exercises.
const NON_ADMIN_EMAIL = RLS_TEST_EMAIL;

describe.skipIf(!hasServiceRole)("leads stage transitions (real DB, RLS)", () => {
  // Created inside beforeAll (not at describe-body scope) so describe.skipIf
  // actually prevents this from running — a describe body always executes
  // to register its structure even when its tests are skipped.
  let serviceClient: ReturnType<typeof createServiceRoleClient>;
  let adminSession: MintedSession;
  let leadId: string;

  beforeAll(async () => {
    serviceClient = createServiceRoleClient();
    adminSession = await mintSession(ADMIN_EMAIL);

    // The suite owns its form: created here, removed in afterAll, so nothing is left in the database.
    const formId = await ensureSmokeForm(serviceClient);

    // Insert directly as the service role (bypasses RLS) rather than via
    // the public RPC, so this test owns exactly one fresh completed
    // submission and doesn't depend on any other test's data.
    const { data: submission, error: insertError } = await serviceClient
      .from("form_submissions")
      .insert({
        form_id: formId,
        session_id: `vitest-${crypto.randomUUID()}`,
        data: {
          name: e2eName("Applicant Stage Transitions"),
          email: "grace.hopper@example.com",
          why: "Testing the lead stage pipeline end to end.",
        },
        completed: true,
        partial: false,
      })
      .select("id")
      .single();
    if (insertError || !submission) throw insertError ?? new Error("Could not insert a test submission");

    const { data: lead, error: leadError } = await serviceClient
      .from("leads")
      .select("id, stage")
      .eq("form_submission_id", submission.id)
      .single();
    if (leadError || !lead) throw leadError ?? new Error("Trigger did not create a lead for the new submission");
    expect(lead.stage).toBe("lead");
    leadId = lead.id;
  });

  afterAll(async () => {
    await cleanUpE2eData(serviceClient);
    await removeSmokeForm(serviceClient);
  });

  it("lets an admin move a lead directly to a non-adjacent stage and logs it", async () => {
    const adminClient = createSessionClient(adminSession);

    const { error } = await adminClient.from("leads").update({ stage: "customer" }).eq("id", leadId);
    expect(error).toBeNull();

    const { data: updated } = await serviceClient.from("leads").select("stage").eq("id", leadId).single();
    expect(updated?.stage).toBe("customer");

    const { data: history } = await serviceClient
      .from("lead_stage_history")
      .select("from_stage, to_stage, changed_by")
      .eq("lead_id", leadId)
      .order("changed_at", { ascending: true });

    // Row 1: creation (null -> lead, changed_by null, written by the
    // form_submissions trigger). Row 2: this direct Lead -> Customer jump.
    expect(history).toHaveLength(2);
    expect(history![0]).toMatchObject({ from_stage: null, to_stage: "lead", changed_by: null });
    expect(history![1]).toMatchObject({ from_stage: "lead", to_stage: "customer" });
    expect(history![1].changed_by).toBe(adminSession.userId);
  });

  it("rejects a non-admin's attempt to move the same lead", async () => {
    const nonAdminSession = await mintSession(NON_ADMIN_EMAIL);
    const nonAdminClient = createSessionClient(nonAdminSession);

    const { data: updateResult } = await nonAdminClient
      .from("leads")
      .update({ stage: "advocate" })
      .eq("id", leadId)
      .select();

    // The admin-only RLS policy filters the row out of the UPDATE's WHERE
    // clause entirely — no row matches, so nothing changes. That's the
    // actual permission boundary here, not a stage-distance rule.
    expect(updateResult ?? []).toHaveLength(0);

    const { data: unchanged } = await serviceClient.from("leads").select("stage").eq("id", leadId).single();
    expect(unchanged?.stage).toBe("customer");
  });
});
