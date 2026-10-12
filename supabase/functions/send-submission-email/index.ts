// send-submission-email — public, called right after a form submission
// completes. Sends a confirmation to the submitter and a notification to
// every admin + notification_emails recipient, then logs each attempt in
// email_logs. Rewritten to match build-fellowship's real edge function
// (examined directly), server-driven instead of client-computed: the
// caller passes only {formId, sessionId} (or {submissionId} for an admin
// resend) and this function looks up the submission, form and identity
// itself — reusing Phase 0's shared mail infra (_shared/email.ts).
//
// Body: { submissionId } | { formId, sessionId }, mode?: 'all' | 'resend_confirmation'
//
// Who may call it: the applicant's browser calls it with the public key right after
// submitting ({ formId, sessionId }); that automatic path sends at most ONCE per
// submission (an atomic claim on confirmation_email_sent_at), so replaying it cannot
// flood anyone. Anything else (an explicit submissionId, or a resend) needs a signed-in
// staff member.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type Notification, notify, resolveSubmissionContact } from "../_shared/notify.ts";
import { requireStaff } from "../_shared/adminAuth.ts";
import { loadSystemTemplate, renderSystemEmail } from "../_shared/systemEmail.ts";

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

function answersTable(fields: SchemaField[], data: Record<string, unknown>): string {
  const rows = fields
    .filter((f) => data[f.id] !== undefined && data[f.id] !== null && data[f.id] !== "")
    .map((f) => {
      const raw = data[f.id];
      const text = Array.isArray(raw) ? raw.join(", ") : String(raw);
      // A file question's answer is the link to the uploaded file.
      const val = f.type === "file" && /^https:\/\//i.test(text)
        ? `<a href="${escapeHtml(text)}" style="color:#233ce6;">Open the uploaded file</a>`
        : escapeHtml(text);
      return `<tr>
        <td style="padding:8px 14px;border-bottom:1px solid #e3e6ec;font-size:13px;color:#4e5566;white-space:nowrap;font-weight:500;">${escapeHtml(f.label || f.id)}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #e3e6ec;font-size:13px;color:#0a0c12;">${val}</td>
      </tr>`;
    })
    .join("");
  if (!rows) return "";
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e6ec;border-radius:10px;overflow:hidden;margin-bottom:24px;">${rows}</table>`;
}

// Delivers one notification (email + WhatsApp) and records the email
// attempt in email_logs exactly as before. Returns the email error, if any —
// the WhatsApp outcome is logged by notify() and never becomes an error here.
async function notifyAndLog(
  sb: SupabaseClient,
  notification: Notification,
  emailType: string,
  formId: string,
  submissionId: string,
): Promise<{ emailError: string | null; whatsappSent: boolean }> {
  const { email: result, whatsapp } = await notify(notification);
  const whatsappSent = whatsapp.ok;
  if (result.status === "skipped") return { emailError: null, whatsappSent };
  const to = notification.recipient.email ?? "";
  const subject = notification.email?.subject ?? "";
  if (result.ok) {
    await sb.from("email_logs").insert({
      form_id: formId,
      submission_id: submissionId,
      email_type: emailType,
      to_email: to,
      subject,
      status: "sent",
      provider: result.provider ?? null,
    });
    return { emailError: null, whatsappSent };
  }
  const msg = result.error ?? "Unknown error";
  console.error(`Email failed to ${to}:`, msg);
  try {
    await sb.from("email_logs").insert({
      form_id: formId,
      submission_id: submissionId,
      email_type: emailType,
      to_email: to,
      subject,
      status: "failed",
      error_message: msg,
    });
  } catch {
    // logging is best-effort — never let it mask the original send failure
  }
  return { emailError: msg, whatsappSent };
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

  let formId = "", sessionId = "", submissionId = "", mode = "all";
  try {
    const body = await req.json();
    formId = body.formId ?? "";
    sessionId = body.sessionId ?? "";
    submissionId = body.submissionId ?? "";
    mode = body.mode ?? "all"; // "all" | "resend_confirmation"
    if (!submissionId && (!formId || !sessionId)) {
      throw new Error("Provide submissionId, or formId + sessionId");
    }
  } catch (e: unknown) {
    return json({ error: (e as Error).message }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const staff = (await requireStaff(req, supabase)).ok;
  if ((submissionId || mode === "resend_confirmation") && !staff) {
    return json({ error: "Staff authentication required" }, 401);
  }

  // Fetch submission: by id (admin resend, no time guard) or by
  // form+session within the last hour (automatic post-submit call).
  let query = supabase.from("form_submissions").select("id, data, form_id").eq("completed", true);
  query = submissionId
    ? query.eq("id", submissionId)
    : query.eq("form_id", formId).eq("session_id", sessionId).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  const { data: submission, error: subErr } = await query.maybeSingle();

  if (subErr || !submission) return json({ error: "Submission not found" }, 404);
  const realFormId = submission.form_id as string;

  // The automatic call (the applicant's browser, public key) is once-only: claim the
  // submission before anything is sent, so a repeated or replayed call does nothing.
  // The claim is released below if the confirmation could not be sent, so a genuine
  // failure can still be retried within the hour.
  let claimed = false;
  if (!staff) {
    const { data: won } = await supabase
      .from("form_submissions")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", submission.id)
      .is("confirmation_email_sent_at", null)
      .select("id");
    if (!won || won.length === 0) return json({ ok: true, skipped: "already sent" });
    claimed = true;
  }

  const { data: form } = await supabase.from("forms").select("id, title, schema").eq("id", realFormId).maybeSingle();
  if (!form) return json({ error: "Form not found" }, 404);

  const fields = extractFields(form.schema);
  const answers = (submission.data ?? {}) as Record<string, unknown>;

  const emailField = fields.find((f) => f.type === "email");
  const submitterEmail = emailField ? String(answers[emailField.id] ?? "").trim() : "";
  const nameField = fields.find((f) => f.type === "text" && /name/i.test(f.label ?? ""));
  const submitterName = nameField ? String(answers[nameField.id] ?? "").trim() : "";

  const submitterPhone = resolveSubmissionContact(answers, fields).phone;

  const table = answersTable(fields, answers);
  // Both emails are system templates staff edit under Messaging; without a stored
  // row the built-in default is sent.
  const confirmation = renderSystemEmail("submission_received", await loadSystemTemplate(supabase, "submission_received"), {
    name: submitterName,
    vars: { form_title: form.title },
    answersHtml: table,
  });
  const errors: string[] = [];
  let whatsappSent = 0;

  // A submitter with only a phone number (no email answer) still gets the
  // WhatsApp confirmation; the email side is skipped exactly as before.
  if (submitterEmail || submitterPhone) {
    const outcome = await notifyAndLog(
      supabase,
      {
        type: "SUBMISSION_RECEIVED",
        recipient: { email: submitterEmail, phone: submitterPhone, ref: submission.id },
        source: "send-submission-email",
        email: { subject: confirmation.subject, html: shell(confirmation.html) },
        data: { name: submitterName, formTitle: form.title },
        // An admin "resend confirmation" is an explicit email resend.
        channels: mode === "resend_confirmation" ? ["email"] : undefined,
      },
      "submitter_confirmation",
      realFormId,
      submission.id,
    );
    if (outcome.emailError) errors.push(`submitter: ${outcome.emailError}`);
    if (outcome.whatsappSent) whatsappSent += 1;
  }

  let adminEmails: string[] = [];
  if (mode !== "resend_confirmation") {
    const [{ data: adminProfiles }, { data: notifRows }] = await Promise.all([
      supabase.from("profiles").select("id, email, phone").eq("role", "admin").eq("receive_notifications", true),
      supabase.from("notification_emails").select("email").eq("active", true),
    ]);
    // Admin profiles are notified unless a super admin switched notifications
    // off for them on the Team page (profiles.receive_notifications). Order and
    // de-duplication are as before; profiles also carry their own WhatsApp
    // number when they have set one.
    const adminRecipients: { email: string; phone: string | null; ref: string | null }[] = [];
    const addRecipient = (email: unknown, phone: unknown, ref: unknown) => {
      const address = String(email ?? "").trim();
      if (!address || adminRecipients.some((r) => r.email === address)) return;
      adminRecipients.push({ email: address, phone: phone ? String(phone) : null, ref: ref ? String(ref) : null });
    };
    for (const a of (adminProfiles ?? []) as Record<string, unknown>[]) addRecipient(a.email, a.phone, a.id);
    for (const n of (notifRows ?? []) as Record<string, unknown>[]) addRecipient(n.email, null, null);
    adminEmails = adminRecipients.map((r) => r.email);

    if (adminEmails.length > 0) {
      const notice = renderSystemEmail("admin_new_submission", await loadSystemTemplate(supabase, "admin_new_submission"), {
        vars: {
          form_title: form.title,
          submitter: submitterName && submitterEmail ? `${submitterName} · ${submitterEmail}` : submitterName || submitterEmail || "An applicant",
          submitter_email: submitterEmail,
        },
        answersHtml: table,
      });
      const html = shell(notice.html);
      for (const recipient of adminRecipients) {
        const outcome = await notifyAndLog(
          supabase,
          {
            type: "ADMIN_NEW_SUBMISSION",
            recipient,
            source: "send-submission-email",
            email: { subject: notice.subject, html },
            data: { formTitle: form.title, submitter: submitterName || submitterEmail },
          },
          "admin_notification",
          realFormId,
          submission.id,
        );
        if (outcome.emailError) errors.push(`admin ${recipient.email}: ${outcome.emailError}`);
        if (outcome.whatsappSent) whatsappSent += 1;
      }
    }
  }

  const submitterFailed = errors.some((e) => e.startsWith("submitter"));
  try {
    if (claimed && submitterFailed) {
      // Nothing reached the applicant: give the claim back so the call can be retried.
      await supabase.from("form_submissions").update({ confirmation_email_sent_at: null }).eq("id", submission.id);
    } else if (!claimed && submitterEmail && !submitterFailed) {
      await supabase
        .from("form_submissions")
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq("id", submission.id);
    }
  } catch {
    // best-effort — the send itself already succeeded and was logged
  }

  return json({
    ok: true,
    submitterEmailSent: !!submitterEmail && errors.every((e) => !e.startsWith("submitter")),
    adminEmailsSent: adminEmails.length > 0 && errors.every((e) => !e.startsWith("admin")),
    whatsappSent,
    errors,
  });
});
