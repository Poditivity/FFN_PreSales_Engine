import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractFields } from "@/lib/forms/flowModel";
import { computeSubmissionInsights, orderedFields, resolveIdentity, type FieldTiming } from "@/lib/forms/insights";
import type { Lead } from "@/lib/leads/schema";
import { LeadsBoard, type BoardLead } from "./LeadsBoard";

interface LeadRow extends Lead {
  form_submissions: {
    id: string;
    data: Record<string, unknown>;
    created_at: string;
    field_timings: Record<string, FieldTiming> | null;
    keystroke_counts: Record<string, number> | null;
    time_on_form_seconds: number | null;
    forms: { id: string; title: string; slug: string; schema: unknown };
  };
}

// PostgREST returns at most 1000 rows per request, so a long lead list is
// read in pages rather than silently cut off.
const PAGE = 1000;

export default async function LeadsPage() {
  const supabase = await createServerSupabaseClient();
  const leads: LeadRow[] = [];
  let loadError: string | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("leads")
      .select(
        "*, form_submissions(id, data, created_at, field_timings, keystroke_counts, time_on_form_seconds, forms(id, title, slug, schema))",
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<LeadRow[]>();
    if (error) {
      loadError = error.message;
      break;
    }
    leads.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  // One row per lead that has been called; the rest have no calls.
  const callStats = new Map<string, { total: number; last_called_at: string | null; next_follow_up_on: string | null }>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("lead_call_stats")
      .select("lead_id, total, last_called_at, next_follow_up_on")
      .order("lead_id")
      .range(from, from + PAGE - 1);
    // The leads still list without call numbers if this read fails.
    if (error) break;
    for (const row of data ?? []) callStats.set(row.lead_id, row);
    if (!data || data.length < PAGE) break;
  }

  const fieldsBySchema = new Map<unknown, ReturnType<typeof orderedFields>>();
  const boardLeads: BoardLead[] = leads.map((lead) => {
    const sub = lead.form_submissions;
    let fields = fieldsBySchema.get(sub.forms.schema);
    if (!fields) {
      fields = orderedFields(sub.forms.schema);
      if (fields.length === 0) fields = extractFields(sub.forms.schema);
      fieldsBySchema.set(sub.forms.schema, fields);
    }
    const identity = resolveIdentity(sub.data, fields);
    const insights = computeSubmissionInsights({
      fields,
      data: sub.data,
      fieldTimings: sub.field_timings ?? {},
      keystrokeCounts: sub.keystroke_counts ?? {},
      timeOnFormSeconds: sub.time_on_form_seconds,
    });
    return {
      id: lead.id,
      stage: lead.stage,
      ownerId: lead.owner_id,
      createdAt: lead.created_at,
      name: identity.name,
      email: identity.email,
      programId: sub.forms.id,
      programTitle: sub.forms.title,
      effortScore: insights.effortScore.total,
      effortBand: insights.effortBand,
      callCount: callStats.get(lead.id)?.total ?? 0,
      lastCallAt: callStats.get(lead.id)?.last_called_at ?? null,
      nextFollowUpOn: callStats.get(lead.id)?.next_follow_up_on ?? null,
    };
  });

  const programs = Array.from(new Map(boardLeads.map((l) => [l.programId, l.programTitle])).entries())
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // The team, for the Owner filter. An unreadable list just hides the filter.
  const { data: team } = await supabase.from("profiles").select("id, email, full_name").in("role", ["staff", "admin"]).order("email");
  const owners = (team ?? []).map((m: { id: string; email: string; full_name: string | null }) => ({
    id: m.id,
    label: m.full_name || m.email,
  }));

  return (
    <div>
      <LeadsBoard initialLeads={boardLeads} programs={programs} owners={owners} loadError={loadError} />
    </div>
  );
}
