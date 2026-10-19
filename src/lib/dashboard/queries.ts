import type { SupabaseClient } from "@supabase/supabase-js";
import { extractFields } from "@/lib/forms/flowModel";
import { MANUAL_FORM_SLUG } from "@/lib/forms/manualForm";
import { resolveIdentity } from "@/lib/forms/insights";
import type { LeadWithSubmission } from "@/lib/leads/schema";
import { periodRange } from "./metrics";
import type { ActivityEvent, DashboardAttention, DashboardOverview, LiveHub, PeriodId } from "./types";

// Browser-side reads for the dashboard. Every number comes from one of the
// dashboard_* Postgres functions; the only extra reads here turn ids into
// names, using the same identity rule the leads board uses.

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// The form filter is only sent when forms are chosen, so with no filter these
// calls are exactly the ones the database functions have always accepted.
const formArg = (formIds: string[]) => (formIds.length > 0 ? { p_form_ids: formIds } : {});

export async function fetchOverview(supabase: SupabaseClient, period: PeriodId, now: Date, tz: string, formIds: string[] = []) {
  const { from, to } = periodRange(period, now);
  return unwrap<DashboardOverview>(
    await supabase.rpc("dashboard_overview", {
      p_from: from?.toISOString() ?? null,
      p_to: to.toISOString(),
      p_tz: tz,
      ...formArg(formIds),
    }),
  );
}

export async function fetchAttention(supabase: SupabaseClient, formIds: string[] = []) {
  return unwrap<DashboardAttention>(await supabase.rpc("dashboard_attention", formArg(formIds)));
}

export async function fetchLive(supabase: SupabaseClient, formIds: string[] = []) {
  return unwrap<LiveHub[]>(await supabase.rpc("dashboard_live", formArg(formIds)));
}

export async function fetchActivity(supabase: SupabaseClient, limit = 20, formIds: string[] = []) {
  return unwrap<ActivityEvent[]>(await supabase.rpc("dashboard_activity", { p_limit: limit, ...formArg(formIds) }));
}

export interface LeadName {
  name: string;
  email: string;
  program: string;
}

export async function fetchLeadNames(supabase: SupabaseClient, leadIds: string[]): Promise<Map<string, LeadName>> {
  const ids = [...new Set(leadIds.filter(Boolean))];
  const names = new Map<string, LeadName>();
  if (ids.length === 0) return names;
  const leads = unwrap<LeadWithSubmission[]>(
    await supabase.from("leads").select("*, form_submissions(id, data, created_at, forms(id, title, slug, schema))").in("id", ids),
  );
  for (const lead of leads ?? []) {
    const identity = resolveIdentity(lead.form_submissions.data, extractFields(lead.form_submissions.forms.schema));
    names.set(lead.id, { name: identity.name, email: identity.email, program: lead.form_submissions.forms.title });
  }
  return names;
}

const CONTENT_TABLES: Record<string, { table: string; column: string }> = {
  founders: { table: "founders", column: "name" },
  case_studies: { table: "case_studies", column: "title" },
  faqs: { table: "faqs", column: "question" },
  mentors: { table: "mentors", column: "name" },
  collection: { table: "content_collection_items", column: "title" },
};

/** Names for proof items viewed on hubs, keyed "<target_type>:<id>". */
export async function fetchContentNames(
  supabase: SupabaseClient,
  items: { target_type: string; target_id: string }[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const byType = new Map<string, string[]>();
  for (const item of items) {
    if (!CONTENT_TABLES[item.target_type]) continue;
    byType.set(item.target_type, [...(byType.get(item.target_type) ?? []), item.target_id]);
  }
  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      const { table, column } = CONTENT_TABLES[type];
      const { data } = await supabase.from(table).select(`id, ${column}`).in("id", ids);
      for (const row of (data ?? []) as unknown as Record<string, string>[]) names.set(`${type}:${row.id}`, row[column]);
    }),
  );
  return names;
}

export interface SearchEntry {
  kind: "lead" | "hub" | "form";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  stage?: string;
}

/** Everything the command palette can jump to. Loaded once, on first open. */
export async function fetchSearchIndex(supabase: SupabaseClient): Promise<SearchEntry[]> {
  const [leads, hubs, forms] = await Promise.all([
    supabase
      .from("leads")
      .select("*, form_submissions(id, data, created_at, forms(id, title, slug, schema))")
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<LeadWithSubmission[]>(),
    supabase.from("hubs").select("id, lead_id, applicant_name, status").is("lead_id", null).limit(500),
    supabase.from("forms").select("id, title, status").neq("slug", MANUAL_FORM_SLUG).order("created_at", { ascending: false }),
  ]);

  const entries: SearchEntry[] = [];
  for (const lead of leads.data ?? []) {
    const identity = resolveIdentity(lead.form_submissions.data, extractFields(lead.form_submissions.forms.schema));
    entries.push({
      kind: "lead",
      id: lead.id,
      title: identity.name || identity.email || "Unnamed lead",
      subtitle: [identity.email, lead.form_submissions.forms.title].filter(Boolean).join(" · "),
      href: `/admin/leads/${lead.id}`,
      stage: lead.stage,
    });
  }
  for (const hub of (hubs.data ?? []) as { id: string; applicant_name: string | null; status: string }[]) {
    entries.push({
      kind: "hub",
      id: hub.id,
      title: hub.applicant_name || "Standalone hub",
      subtitle: `Hub · ${hub.status}`,
      href: "/admin/hubs",
    });
  }
  for (const form of (forms.data ?? []) as { id: string; title: string; status: string }[]) {
    entries.push({
      kind: "form",
      id: form.id,
      title: form.title,
      subtitle: `Form · ${form.status}`,
      href: `/admin/forms/${form.id}`,
    });
  }
  return entries;
}

export function searchEntries(entries: SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const title = entry.title.toLowerCase();
    const sub = entry.subtitle.toLowerCase();
    const score = title.startsWith(q) ? 3 : title.includes(q) ? 2 : sub.includes(q) ? 1 : 0;
    if (score > 0) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.entry);
}
