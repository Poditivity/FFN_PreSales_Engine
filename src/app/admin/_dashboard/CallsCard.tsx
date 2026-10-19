"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { Card } from "@/components/ffn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatCount } from "@/lib/dashboard/metrics";
import { Figure, SectionError, Skeleton } from "./ui";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE = 1000;

interface CallsSnapshot {
  weekCalls: number;
  weekConnected: number;
  mqlUncalled: number;
  sqlUncalled: number;
}

async function fetchCallsSnapshot(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  formIds: string[],
): Promise<CallsSnapshot> {
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  // With forms chosen, only calls to leads from those forms count. The embedded
  // inner joins are added only then, so the unfiltered reads are the original ones.
  const filtered = formIds.length > 0;
  const callsQuery = () =>
    filtered
      ? supabase
          .from("lead_calls")
          .select("id, leads!inner(form_submissions!inner(form_id))", { count: "exact", head: true })
          .in("leads.form_submissions.form_id", formIds)
      : supabase.from("lead_calls").select("id", { count: "exact", head: true });
  const [week, connected] = await Promise.all([
    callsQuery().gte("called_at", since),
    callsQuery().gte("called_at", since).eq("outcome", "connected"),
  ]);
  if (week.error) throw new Error(week.error.message);
  if (connected.error) throw new Error(connected.error.message);

  // Leads waiting at MQL or SQL that nobody has called yet. The embedded count is
  // per lead, so a lead with no calls reads 0.
  let mqlUncalled = 0;
  let sqlUncalled = 0;
  for (let from = 0; ; from += PAGE) {
    const base = filtered
      ? supabase.from("leads").select("id, stage, lead_calls(count), form_submissions!inner(form_id)").in("form_submissions.form_id", formIds)
      : supabase.from("leads").select("id, stage, lead_calls(count)");
    const { data, error } = await base
      .in("stage", ["mql", "sql"])
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<{ id: string; stage: "mql" | "sql"; lead_calls: { count: number }[] }[]>();
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if ((row.lead_calls?.[0]?.count ?? 0) > 0) continue;
      if (row.stage === "mql") mqlUncalled += 1;
      else sqlUncalled += 1;
    }
    if (!data || data.length < PAGE) break;
  }
  return { weekCalls: week.count ?? 0, weekConnected: connected.count ?? 0, mqlUncalled, sqlUncalled };
}

/** What the team's calling looks like this week, and who is still waiting for a first call. */
export function CallsCard({ formIds = [] }: { formIds?: string[] }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const query = useQuery({
    queryKey: ["dashboard", "calls", formIds.join(",")],
    queryFn: () => fetchCallsSnapshot(supabase, formIds),
    refetchInterval: 60_000,
  });

  return (
    <Card title="Calls" subtitle="The last 7 days, and the leads still waiting for a first call.">
      {query.error ? (
        <SectionError message={query.error.message} />
      ) : !query.data ? (
        <Skeleton height="calc(var(--space-16) * 1.5)" />
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: "var(--space-4)" }}>
            <Figure label="Calls this week" value={formatCount(query.data.weekCalls)} />
            <Figure label="Connected" value={formatCount(query.data.weekConnected)} />
            <Figure label="MQL, not called yet" value={formatCount(query.data.mqlUncalled)} />
            <Figure label="SQL, not called yet" value={formatCount(query.data.sqlUncalled)} />
          </div>
          <p className="body-sm" style={{ margin: 0 }}>
            <Link href="/admin/leads" style={{ color: "var(--brand)", textDecoration: "underline" }}>
              Open the leads list
            </Link>{" "}
            and pick Not called yet under Calls to work through them.
          </p>
        </div>
      )}
    </Card>
  );
}
