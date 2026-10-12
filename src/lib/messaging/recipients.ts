import { extractFields } from "@/lib/forms/flowModel";
import { orderedFields, resolveIdentity } from "@/lib/forms/insights";
import type { LeadStage } from "@/lib/leads/schema";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/** A lead as the composer needs it: who they are, how to reach them, and where they are in the pipeline. */
export interface MessageRecipient {
  leadId: string;
  name: string;
  email: string;
  phone: string;
  stage: LeadStage;
  /** The form they applied through, for filtering. */
  formId: string;
  programTitle: string;
  /** The token of the lead's hub, or null when no hub has been made for them yet. */
  hubToken: string | null;
}

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface Row {
  id: string;
  stage: LeadStage;
  form_submissions: { data: Record<string, unknown>; forms: { id: string; title: string; schema: unknown } };
}

const PAGE = 1000;

/** Every lead as a recipient, newest first. Pages past PostgREST's row cap. */
export async function loadRecipients(supabase: Supabase): Promise<{ recipients: MessageRecipient[]; error: string | null }> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, stage, form_submissions(data, forms(id, title, schema))")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<Row[]>();
    if (error) return { recipients: [], error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const hubTokens = await loadHubTokens(supabase);
  if (hubTokens.error) return { recipients: [], error: hubTokens.error };

  const fieldsBySchema = new Map<unknown, ReturnType<typeof orderedFields>>();
  const recipients = rows.map((row): MessageRecipient => {
    const sub = row.form_submissions;
    let fields = fieldsBySchema.get(sub.forms.schema);
    if (!fields) {
      fields = orderedFields(sub.forms.schema);
      if (fields.length === 0) fields = extractFields(sub.forms.schema);
      fieldsBySchema.set(sub.forms.schema, fields);
    }
    const identity = resolveIdentity(sub.data, fields);
    return {
      leadId: row.id,
      name: identity.name,
      email: identity.email,
      phone: identity.phone,
      stage: row.stage,
      formId: sub.forms.id,
      programTitle: sub.forms.title,
      hubToken: hubTokens.byLead.get(row.id) ?? null,
    };
  });
  return { recipients, error: null };
}

/** The hub token for each lead that has a hub. A lead with more than one gets the newest. */
async function loadHubTokens(supabase: Supabase): Promise<{ byLead: Map<string, string>; error: string | null }> {
  const byLead = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("hubs")
      .select("lead_id, token")
      .not("lead_id", "is", null)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<{ lead_id: string; token: string }[]>();
    if (error) return { byLead, error: error.message };
    for (const hub of data ?? []) if (!byLead.has(hub.lead_id)) byLead.set(hub.lead_id, hub.token);
    if (!data || data.length < PAGE) break;
  }
  return { byLead, error: null };
}
