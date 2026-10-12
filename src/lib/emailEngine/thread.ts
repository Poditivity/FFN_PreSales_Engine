import { extractFields } from "@/lib/forms/flowModel";
import { resolveIdentity } from "@/lib/forms/insights";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { LeadEmailMessage, LeadEmailThread, LeadHistoryEntry } from "./types";

export async function getOrCreateThreadForLead(leadId: string): Promise<LeadEmailThread> {
  const supabase = createBrowserSupabaseClient();
  const { data: existing, error: selectError } = await supabase
    .from("lead_email_threads")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing as LeadEmailThread;

  const { data: created, error: insertError } = await supabase
    .from("lead_email_threads")
    .insert({ lead_id: leadId })
    .select()
    .single();
  if (insertError) throw insertError;
  return created as LeadEmailThread;
}

export async function listThreadMessages(threadId: string): Promise<LeadEmailMessage[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("lead_email_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LeadEmailMessage[];
}

/**
 * The lead's full email history, merged chronologically: live Phase 5
 * thread messages (manual + stage-triggered) alongside read-only entries
 * surfaced from Phase 1's send-submission-email log (matched by the exact
 * submission_id — unambiguous) and Phase 4's hub-send log (matched by the
 * lead's resolved email address, since hub_send's log has no lead_id of its
 * own). Neither of those senders is rebuilt here — this only reads their
 * existing logs for display.
 */
export async function listLeadEmailHistory(leadId: string): Promise<LeadHistoryEntry[]> {
  const supabase = createBrowserSupabaseClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("form_submission_id, form_submissions(data, forms(schema))")
    .eq("id", leadId)
    .single();
  if (leadError) throw leadError;

  const submission = lead.form_submissions as unknown as { data: Record<string, unknown>; forms: { schema: unknown } };
  const identity = resolveIdentity(submission.data, extractFields(submission.forms.schema));

  const [{ data: thread }, { data: submissionEmails }, hubEmailsResult] = await Promise.all([
    supabase.from("lead_email_threads").select("id").eq("lead_id", leadId).maybeSingle(),
    supabase
      .from("email_logs")
      .select("id, subject, to_email, status, created_at")
      .eq("submission_id", lead.form_submission_id),
    identity.email
      ? supabase
          .from("email_send_log")
          .select("id, subject, to_emails, status, created_at")
          .eq("source", "hub-send")
          .contains("to_emails", [identity.email])
      : Promise.resolve({ data: [] as { id: string; subject: string; to_emails: string[]; status: string; created_at: string }[] }),
  ]);

  const messages = thread ? await listThreadMessages(thread.id) : [];

  const entries: LeadHistoryEntry[] = [
    ...messages.map((m): LeadHistoryEntry => ({ kind: "lead_email_message", ...m })),
    ...(submissionEmails ?? []).map(
      (e): LeadHistoryEntry => ({
        kind: "submission_email",
        id: e.id,
        subject: e.subject,
        to_email: e.to_email,
        status: e.status as "sent" | "failed",
        created_at: e.created_at,
      }),
    ),
    ...(hubEmailsResult.data ?? []).map(
      (e): LeadHistoryEntry => ({
        kind: "hub_email",
        id: e.id,
        subject: e.subject,
        to_email: e.to_emails[0] ?? "",
        status: e.status,
        created_at: e.created_at,
      }),
    ),
  ];

  return entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export interface SendLeadEmailResult {
  ok: boolean;
  error?: string;
}

/** Invokes the staff-only lead-email-send edge function — see supabase/functions/lead-email-send. */
export async function sendLeadEmail(leadId: string, subject: string, body: string): Promise<SendLeadEmailResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("lead-email-send", { body: { leadId, subject, body } });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

/** Invokes lead-email-dispatch to render+send any pending stage-triggered stub for this lead — see supabase/functions/lead-email-dispatch. */
export async function dispatchPendingLeadEmail(leadId: string): Promise<SendLeadEmailResult> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("lead-email-dispatch", { body: { leadId } });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}
