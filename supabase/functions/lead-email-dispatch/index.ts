// lead-email-dispatch — staff-only. Renders and sends any pending
// stage-triggered stub messages for one lead. The dispatch_stage_email_rule
// DB trigger (see the Phase 5 migration) already inserted a minimal pending
// row — {template_id, stage_email_rule_id, status: 'pending'} — the moment
// the lead's stage actually changed, before any of this ran. This function
// is called by the client right after that stage-changing UPDATE succeeds;
// it resolves identity, renders the template, fills in the row's
// to_email/subject/body (still 'pending' at that point), then attempts
// delivery through the shared mail infra and updates the outcome.
//
// Personalization/identity-resolution logic is duplicated here (not
// imported from src/lib) because this Deno function can't reach into the
// Next app's source tree — same reason hub-hydrate/hub-send/lead-email-send
// reimplement it too. Keep this in sync with
// src/lib/emailEngine/personalization.ts and src/lib/forms/insights.ts if
// any of them change.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bodyToEditorHtml, emailBodyToHtml, personalizeHtml, personalizeText, usesHubLink } from "../_shared/messageText.ts";
import { notify, resolveSubmissionContact } from "../_shared/notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SchemaField {
  id: string;
  label: string;
  type: string;
}

function extractFields(schema: unknown): SchemaField[] {
  if (!schema || typeof schema !== "object") return [];
  const s = schema as Record<string, unknown>;
  const nodes: unknown[] = Array.isArray(s.nodes) ? (s.nodes as unknown[]) : [];
  return nodes
    .filter((n) => (n as Record<string, unknown>)?.type === "question")
    .map((n) => (n as Record<string, unknown>)?.data as Record<string, unknown>)
    .map((d) => d?.field as Record<string, unknown>)
    .filter(Boolean) as SchemaField[];
}

function resolveIdentity(data: Record<string, unknown>, fields: SchemaField[]): { name: string; email: string } {
  const emailField = fields.find((f) => f.type === "email");
  const email = emailField ? String(data[emailField.id] ?? "").trim() : "";
  const nameField = fields.find((f) => f.type === "name" || (f.type === "text" && /name/i.test(f.label ?? "")));
  const name = nameField ? String(data[nameField.id] ?? "").trim() : "";
  return { name, email };
}

async function requireStaff(req: Request, admin: SupabaseClient): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  if (!user) return false;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return !!profile && (profile.role === "staff" || profile.role === "admin");
}

function shell(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(10,12,18,0.09);" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0a0c12;padding:20px 28px;">
        <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8098ff;font-weight:600;font-family:'Segoe UI',Arial,sans-serif;">Founders First Network</span>
      </td></tr>
      <tr><td style="padding:32px 28px 28px;">${inner}</td></tr>
      <tr><td style="padding:14px 28px;background:#f6f7f9;border-top:1px solid #e3e6ec;">
        <p style="margin:0;font-size:11px;color:#616978;text-align:center;">Founders First Network</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (!(await requireStaff(req, admin))) return json({ error: "Staff authentication required" }, 401);

  let leadId = "";
  try {
    const parsed = await req.json();
    leadId = String(parsed.leadId ?? "");
    if (!leadId) throw new Error("leadId is required");
  } catch (e: unknown) {
    return json({ error: (e as Error).message }, 400);
  }

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .select("id, form_submissions(data, forms(title, schema))")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError || !lead) return json({ error: "Lead not found" }, 404);

  const { data: thread } = await admin.from("lead_email_threads").select("id").eq("lead_id", leadId).maybeSingle();
  if (!thread) return json({ ok: true, dispatched: 0 });

  const { data: pending, error: pendingError } = await admin
    .from("lead_email_messages")
    .select("id, template_id")
    .eq("thread_id", thread.id)
    .eq("trigger", "stage_change")
    .eq("status", "pending")
    .is("subject", null);
  if (pendingError) return json({ error: pendingError.message }, 500);
  if (!pending || pending.length === 0) return json({ ok: true, dispatched: 0 });

  const submission = lead.form_submissions as unknown as {
    data: Record<string, unknown>;
    forms: { title: string; schema: unknown };
  };
  const fields = extractFields(submission.forms.schema);
  const identity = resolveIdentity(submission.data, fields);
  const phone = resolveSubmissionContact(submission.data, fields).phone;
  const program = submission.forms.title;

  // {{hub_link}} is this lead's newest hub. Like hub-send, the address comes from
  // the SITE_URL secret or else from the staff browser that called this function.
  const siteUrl = (Deno.env.get("SITE_URL") || req.headers.get("origin") || "").replace(/\/+$/, "");
  const { data: hubRow } = await admin
    .from("hubs")
    .select("token")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const hubLink = hubRow?.token && siteUrl ? `${siteUrl}/hub/${hubRow.token}` : "";

  let dispatched = 0;
  for (const stub of pending) {
    if (!stub.template_id) {
      await admin
        .from("lead_email_messages")
        .update({ status: "failed", error: "Rule's template was removed before this could be sent" })
        .eq("id", stub.id);
      continue;
    }

    const { data: template } = await admin
      .from("email_templates")
      .select("subject, body")
      .eq("id", stub.template_id)
      .maybeSingle();
    if (!template) {
      await admin.from("lead_email_messages").update({ status: "failed", error: "Template not found" }).eq("id", stub.id);
      continue;
    }

    // Never send a message with an empty link in it.
    if (!hubLink && (usesHubLink(template.subject) || usesHubLink(template.body))) {
      await admin
        .from("lead_email_messages")
        .update({ status: "failed", error: "This lead has no hub yet, so the hub link could not be filled in" })
        .eq("id", stub.id);
      continue;
    }

    if (!identity.email) {
      await admin
        .from("lead_email_messages")
        .update({ status: "failed", error: "This lead has no resolvable email address" })
        .eq("id", stub.id);
      continue;
    }

    // {{name}} and {{hub_link}} are what templates offer. {{lead_name}} and
    // {{program}} still resolve so a template written before that keeps working.
    const extra = { program: program || null, hub_link: hubLink };
    const subject = personalizeText(template.subject, identity.name, extra);
    const bodyText = personalizeHtml(bodyToEditorHtml(template.body), identity.name, extra);

    // Fill in the rendered content on the already-existing pending row
    // before attempting delivery.
    await admin
      .from("lead_email_messages")
      .update({ to_email: identity.email, subject, body: bodyText })
      .eq("id", stub.id);

    const html = shell(emailBodyToHtml(bodyText));
    // The thread row tracks the email; a WhatsApp notice (subject line only,
    // pointing to the email) goes out alongside and is logged separately.
    const { email: result } = await notify({
      type: "LEAD_STAGE_MESSAGE",
      recipient: { email: identity.email, phone, ref: leadId },
      source: "lead-email-dispatch",
      email: { subject, html },
      data: { name: identity.name, program, subject },
    });

    await admin
      .from("lead_email_messages")
      .update({
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : (result.error ?? "Send failed"),
        sent_at: result.ok ? new Date().toISOString() : null,
      })
      .eq("id", stub.id);

    dispatched += 1;
  }

  return json({ ok: true, dispatched });
});
