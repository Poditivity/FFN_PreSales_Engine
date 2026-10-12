import { extractFields } from "@/lib/forms/flowModel";
import { resolveIdentity } from "@/lib/forms/insights";
import { resolveHubIdentity } from "@/lib/hubs/identity";
import type { HubListRow } from "@/lib/hubs/hubList";
import type { Hub } from "@/lib/hubs/types";
import type { LeadWithSubmission } from "@/lib/leads/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/content/types";
import { HubsManager, type LeadOption } from "./HubsManager";

export default async function HubsPage({ searchParams }: PageProps<"/admin/hubs">) {
  const supabase = await createServerSupabaseClient();

  const [{ data: hubs }, { data: leads }, { data: tracks }] = await Promise.all([
    supabase.from("hubs").select("*").order("created_at", { ascending: false }).returns<Hub[]>(),
    supabase
      .from("leads")
      .select("*, form_submissions(id, data, created_at, forms(id, title, slug, schema))")
      .order("created_at", { ascending: false })
      .returns<LeadWithSubmission[]>(),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }).returns<Track[]>(),
  ]);

  const identityByLeadId = new Map((leads ?? []).map((lead) => {
    const fields = extractFields(lead.form_submissions.forms.schema);
    return [lead.id, resolveIdentity(lead.form_submissions.data, fields)] as const;
  }));
  const trackNameById = new Map((tracks ?? []).map((t) => [t.id, t.name] as const));
  const leadIdsWithHub = new Set((hubs ?? []).map((h) => h.lead_id));

  const rows: HubListRow[] = (hubs ?? []).map((h) => {
    const identity = resolveHubIdentity(h, h.lead_id ? (identityByLeadId.get(h.lead_id) ?? null) : null);
    return {
      id: h.id,
      token: h.token,
      status: h.status,
      open_count: h.open_count,
      last_opened_at: h.last_opened_at,
      first_opened_at: h.first_opened_at,
      updated_at: h.updated_at,
      lead_id: h.lead_id,
      applicant_name: identity.name,
      applicant_email: identity.email,
      applicant_whatsapp: identity.whatsapp,
      track_name: trackNameById.get(h.track_id) ?? "—",
    };
  });

  const leadOptions: LeadOption[] = (leads ?? []).map((lead) => {
    const identity = identityByLeadId.get(lead.id);
    return {
      id: lead.id,
      name: identity?.name ?? "",
      email: identity?.email ?? "",
      programTitle: lead.form_submissions.forms.title,
      hasHub: leadIdsWithHub.has(lead.id),
    };
  });

  return (
    <HubsManager
      initialRows={rows}
      leadOptions={leadOptions}
      tracks={tracks ?? []}
      startCreating={(await searchParams).new === "1"}
    />
  );
}
