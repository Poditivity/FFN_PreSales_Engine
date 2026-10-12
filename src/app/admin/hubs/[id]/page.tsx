import { notFound } from "next/navigation";
import { extractFields } from "@/lib/forms/flowModel";
import { resolveIdentity } from "@/lib/forms/insights";
import { resolveHubIdentity } from "@/lib/hubs/identity";
import type { Hub } from "@/lib/hubs/types";
import type { LeadWithSubmission } from "@/lib/leads/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/content/types";
import { HubDetail } from "./HubDetail";

export default async function HubDetailPage({ params }: PageProps<"/admin/hubs/[id]">) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: hub, error } = await supabase.from("hubs").select("*").eq("id", id).maybeSingle<Hub>();
  if (error || !hub) notFound();

  const [{ data: lead }, { data: tracks }] = await Promise.all([
    hub.lead_id
      ? supabase
          .from("leads")
          .select("*, form_submissions(id, data, created_at, forms(id, title, slug, schema))")
          .eq("id", hub.lead_id)
          .maybeSingle<LeadWithSubmission>()
      : Promise.resolve({ data: null }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }).returns<Track[]>(),
  ]);

  const leadIdentity = lead
    ? resolveIdentity(lead.form_submissions.data, extractFields(lead.form_submissions.forms.schema))
    : null;
  const identity = resolveHubIdentity(hub, leadIdentity);

  return <HubDetail initialHub={hub} identity={identity} tracks={tracks ?? []} />;
}
