import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { readFunctionError } from "@/lib/supabase/functionError";
import type { Hub, HubModule } from "./types";

export async function listHubsForLead(leadId: string): Promise<Hub[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("hubs")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Hub[];
}

export async function getHub(id: string): Promise<Hub | null> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("hubs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Hub | null;
}

export interface CreateHubInput {
  // null when this hub has no lead — a standalone applicant instead (see
  // applicant_name/email/whatsapp below).
  lead_id: string | null;
  track_id: string;
  template_id: string;
  // null = inherit the template's modules at hydration time; a non-null
  // array (including []) means this hub was customized at creation.
  modules: HubModule[] | null;
  // Lead Context — all optional, never required to create a hub.
  startup_name?: string | null;
  founder_stage?: string | null;
  current_context?: string | null;
  // Only meaningful (and only ever set) when lead_id is null.
  applicant_name?: string | null;
  applicant_email?: string | null;
  applicant_whatsapp?: string | null;
}

export async function createHub(input: CreateHubInput): Promise<Hub> {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("hubs")
    .insert({ ...input, created_by: user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Hub;
}

export async function updateHubModules(id: string, modules: HubModule[] | null): Promise<Hub> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("hubs").update({ modules }).eq("id", id).select().single();
  if (error) throw error;
  return data as Hub;
}

export interface HubUpdate {
  track_id?: string;
  template_id?: string | null;
  status?: Hub["status"];
  // null = go back to inheriting the template; an array = customized.
  modules?: HubModule[] | null;
  startup_name?: string | null;
  founder_stage?: string | null;
  current_context?: string | null;
  // Only ever set for a hub with no lead.
  applicant_name?: string | null;
  applicant_email?: string | null;
  applicant_whatsapp?: string | null;
}

export async function updateHub(id: string, patch: HubUpdate): Promise<Hub> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("hubs").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Hub;
}

/** Removes the hub, its private link and (by cascade) its engagement events. */
export async function deleteHub(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("hubs").delete().eq("id", id);
  if (error) throw error;
}

export interface HubSendRecord {
  id: string;
  at: string;
  channel: "email" | "whatsapp";
  status: string;
  detail: string | null;
}

/**
 * Every time this hub was sent. Email is logged by address (email_send_log has
 * no hub reference), WhatsApp by hub id (whatsapp_send_log.recipient_ref), so
 * the email side needs the applicant's address to be found.
 */
export async function getHubSends(hubId: string, email: string): Promise<HubSendRecord[]> {
  const supabase = createBrowserSupabaseClient();
  const [emails, whatsapp] = await Promise.all([
    email
      ? supabase
          .from("email_send_log")
          .select("id, created_at, status, error, provider")
          .eq("source", "hub-send")
          .contains("to_emails", [email])
      : Promise.resolve({ data: [], error: null }),
    supabase.from("whatsapp_send_log").select("id, created_at, status, reason, error_message").eq("recipient_ref", hubId),
  ]);
  if (emails.error) throw emails.error;
  if (whatsapp.error) throw whatsapp.error;

  const records: HubSendRecord[] = [
    ...(emails.data ?? []).map(
      (r): HubSendRecord => ({
        id: `email-${r.id}`,
        at: r.created_at,
        channel: "email",
        status: r.status,
        detail: r.error ?? (r.provider ? `via ${r.provider}` : null),
      }),
    ),
    ...(whatsapp.data ?? []).map(
      (r): HubSendRecord => ({
        id: `whatsapp-${r.id}`,
        at: r.created_at,
        channel: "whatsapp",
        status: r.status,
        detail: r.error_message ?? r.reason ?? null,
      }),
    ),
  ];
  return records.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export interface HubContextInput {
  startup_name: string | null;
  founder_stage: string | null;
  current_context: string | null;
  // Editable only for a hub with no lead — see Hub.applicant_name's own note.
  applicant_name?: string | null;
  applicant_email?: string | null;
  applicant_whatsapp?: string | null;
}

export async function updateHubContext(id: string, input: HubContextInput): Promise<Hub> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("hubs").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Hub;
}

export function hubUrl(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/hub/${token}`;
}

export function hubPreviewUrl(token: string): string {
  return `${hubUrl(token)}?preview=1`;
}

/** Invokes the staff-only hub-send edge function — see supabase/functions/hub-send. */
export async function sendHub(hubId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke("hub-send", { body: { hubId } });
  if (error) {
    // Show the reason the function gave, not supabase-js's generic "non-2xx status code".
    const { message } = await readFunctionError(error);
    return { ok: false, error: message ?? error.message };
  }
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}
