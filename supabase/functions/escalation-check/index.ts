// escalation-check — scheduled (pg_cron, every 5 minutes). Tells the team in
// Google Chat, and by email, about leads that have waited longer than the delay
// set on the Settings page (app_settings.escalation_minutes) without being sent
// a personalised hub.
//
// A lead is escalated once. Leads that arrived before escalation was switched on
// are not announced (see escalation_since). A run sends one message listing every
// lead that has newly crossed the line, not one message per lead.
//
// Secrets: GOOGLE_CHAT_WEBHOOK_URL (optional; email still goes out without it),
// SITE_URL (optional; used for the links to each lead), plus the mail secrets.
// Caller: pg_cron, with the database's cron token (see _shared/cronAuth.ts).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceCall } from "../_shared/cronAuth.ts";
import { buildEscalation, type EscalatedLead } from "../_shared/digest.ts";
import { schemaFields } from "../_shared/formSchema.ts";
import { postToGoogleChat } from "../_shared/googleChat.ts";
import { notify } from "../_shared/notify.ts";
import { resolveSubmissionContact } from "../_shared/notifications/recipients.ts";
import { loadTeamRecipients } from "../_shared/teamRecipients.ts";

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

/** Leads handled in one run. The rest go out on the next run, five minutes later. */
const BATCH = 25;

interface Candidate {
  lead_id: string;
  stage: string;
  created_at: string;
  form_submission_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!(await isServiceCall(req, admin))) return json({ error: "Not allowed" }, 401);

  const { data: settings } = await admin.from("app_settings").select("escalation_minutes, escalation_since").eq("id", true).maybeSingle();
  const delay = settings?.escalation_minutes as number | null | undefined;
  if (!delay) return json({ ok: true, skipped: "Escalation is off" });

  const { data: candidates, error } = await admin.rpc("escalation_candidates", {
    p_minutes: delay,
    p_since: settings?.escalation_since ?? null,
    p_limit: BATCH,
  });
  if (error) return json({ error: error.message }, 500);
  const due = (candidates ?? []) as Candidate[];
  if (due.length === 0) return json({ ok: true, escalated: 0 });

  const { data: submissions } = await admin
    .from("form_submissions")
    .select("id, data, forms(title, schema)")
    .in("id", due.map((c) => c.form_submission_id));
  const bySubmission = new Map<string, { data: Record<string, unknown>; form: { title?: string; schema?: unknown } | null }>();
  for (const s of (submissions ?? []) as Record<string, unknown>[]) {
    const form = Array.isArray(s.forms) ? s.forms[0] : s.forms;
    bySubmission.set(String(s.id), { data: (s.data ?? {}) as Record<string, unknown>, form: (form ?? null) as { title?: string; schema?: unknown } | null });
  }

  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
  const now = Date.now();
  const leads: EscalatedLead[] = due.map((c) => {
    const sub = bySubmission.get(c.form_submission_id);
    const contact = sub ? resolveSubmissionContact(sub.data, schemaFields(sub.form?.schema)) : { name: "", email: "", phone: "" };
    return {
      name: contact.name,
      email: contact.email,
      program: sub?.form?.title ?? "",
      stage: c.stage,
      waitedMinutes: Math.max(Math.round((now - new Date(c.created_at).getTime()) / 60000), delay),
      url: siteUrl ? `${siteUrl}/admin/leads/${c.lead_id}` : "",
    };
  });

  const message = buildEscalation({ delayMinutes: delay, leads });

  const chat = await postToGoogleChat(Deno.env.get("GOOGLE_CHAT_WEBHOOK_URL"), message.chatText);
  if (chat.status === "failed") console.error("[escalation-check] google chat:", chat.error);

  const recipients = await loadTeamRecipients(admin);
  let emailsSent = 0;
  for (const recipient of recipients) {
    const { email } = await notify({
      type: "ADMIN_LEAD_ESCALATION",
      recipient,
      source: "escalation-check",
      email: { subject: message.subject, html: message.html },
      data: {},
    });
    if (email.ok) emailsSent += 1;
    else console.error("[escalation-check] email:", email.error);
  }

  // A lead is only marked once someone could have seen the message. If neither
  // channel is set up, or both failed, the same leads come round again.
  if (!chat.ok && emailsSent === 0) {
    return json({ ok: false, escalated: 0, chat: chat.status, emailsSent, error: chat.error ?? "No recipients" }, 502);
  }

  await admin.from("lead_escalations").upsert(
    due.map((c) => ({ lead_id: c.lead_id, chat_status: chat.status, emails_sent: emailsSent })),
    { onConflict: "lead_id", ignoreDuplicates: true },
  );

  return json({ ok: true, escalated: due.length, chat: chat.status, emailsSent });
});
