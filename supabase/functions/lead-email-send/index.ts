// lead-email-send — staff-only. Manually composes and sends one email in a
// lead's thread. Reuses the shared mail infra (_shared/email.ts) — no
// second sending path, same as every other mail step in this build.
//
// The message row is inserted (status 'pending') before the delivery
// attempt, then updated with the outcome afterward — so a crash mid-send
// leaves evidence (a stuck 'pending' row) instead of no row at all.
//
// Identity resolution is duplicated here (not imported from src/lib)
// because this Deno function can't reach into the Next app's source tree —
// same reason hub-hydrate/hub-send reimplement it too. Keep this in sync
// with src/lib/forms/insights.ts's resolveIdentity if either changes.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailBodyToHtml, hasVisibleText } from "../_shared/messageText.ts";
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

function resolveEmail(data: Record<string, unknown>, fields: SchemaField[]): string {
  const emailField = fields.find((f) => f.type === "email");
  return emailField ? String(data[emailField.id] ?? "").trim() : "";
}

async function requireStaff(req: Request, admin: SupabaseClient): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile && (profile.role === "staff" || profile.role === "admin") ? user.id : null;
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

  const userId = await requireStaff(req, admin);
  if (!userId) return json({ error: "Staff authentication required" }, 401);

  let leadId = "";
  let subject = "";
  let bodyText = "";
  try {
    const parsed = await req.json();
    leadId = String(parsed.leadId ?? "");
    subject = String(parsed.subject ?? "").trim();
    bodyText = String(parsed.body ?? "").trim();
    if (!leadId) throw new Error("leadId is required");
    if (!subject) throw new Error("subject is required");
    if (!bodyText || !hasVisibleText(bodyText)) throw new Error("body is required");
  } catch (e: unknown) {
    return json({ error: (e as Error).message }, 400);
  }

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .select("id, form_submissions(data, forms(title, schema))")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError || !lead) return json({ error: "Lead not found" }, 404);

  const submission = lead.form_submissions as unknown as {
    data: Record<string, unknown>;
    forms: { title: string; schema: unknown };
  };
  const fields = extractFields(submission.forms.schema);
  const toEmail = resolveEmail(submission.data, fields);
  if (!toEmail) return json({ error: "This lead has no resolvable email address" }, 422);
  const contact = resolveSubmissionContact(submission.data, fields);

  const { data: existingThread } = await admin.from("lead_email_threads").select("id").eq("lead_id", leadId).maybeSingle();
  let threadId = existingThread?.id as string | undefined;
  if (!threadId) {
    const { data: createdThread, error: threadError } = await admin
      .from("lead_email_threads")
      .insert({ lead_id: leadId })
      .select("id")
      .single();
    if (threadError || !createdThread) return json({ error: threadError?.message ?? "Could not create thread" }, 500);
    threadId = createdThread.id;
  }

  const { data: message, error: insertError } = await admin
    .from("lead_email_messages")
    .insert({
      thread_id: threadId,
      trigger: "manual",
      to_email: toEmail,
      subject,
      body: bodyText,
      status: "pending",
      sent_by: userId,
    })
    .select()
    .single();
  if (insertError || !message) return json({ error: insertError?.message ?? "Could not create message" }, 500);

  // The body is HTML from the visual editor, or plain text from before it
  // existed. Either way it is sanitized here before it goes into the shell.
  const html = shell(emailBodyToHtml(bodyText));
  // Only the email outcome decides the thread row and this response; the
  // WhatsApp notice is additive and logged in whatsapp_send_log.
  const { email: result, whatsapp } = await notify({
    type: "LEAD_MANUAL_MESSAGE",
    recipient: { email: toEmail, phone: contact.phone, ref: leadId },
    source: "lead-email-send",
    email: { subject, html },
    data: { name: contact.name, program: submission.forms.title, subject },
  });

  await admin
    .from("lead_email_messages")
    .update({
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : (result.error ?? "Send failed"),
      sent_at: result.ok ? new Date().toISOString() : null,
    })
    .eq("id", message.id);

  if (!result.ok) return json({ error: result.error ?? "Send failed" }, 502);
  return json({ ok: true, messageId: message.id, whatsapp: whatsapp.status });
});
