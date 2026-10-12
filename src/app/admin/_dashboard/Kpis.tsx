"use client";

import { StatCard } from "@/components/ffn";
import {
  compareCounts,
  compareRates,
  formatCount,
  formatPercent,
  periodLabel,
  ratio,
  shortDate,
} from "@/lib/dashboard/metrics";
import type { DashboardOverview, PeriodId } from "@/lib/dashboard/types";
import { Skeleton } from "./ui";

const GRID = "grid grid-cols-2 xl:grid-cols-4";

export function KpiRow({ overview, period }: { overview: DashboardOverview | undefined; period: PeriodId }) {
  if (!overview) {
    return (
      <div className={GRID} style={{ gap: "var(--space-4)" }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height="calc(var(--space-16) * 1.75)" />
        ))}
      </div>
    );
  }

  const { kpis, kpis_previous: prev, range } = overview;
  const note = range.all_time
    ? `Since ${shortDate(new Date(range.from))}`
    : `vs the previous ${periodLabel(period).toLowerCase()}`;

  const completion = ratio(kpis.form_completes, kpis.form_starts);
  const completionPrev = prev ? ratio(prev.form_completes, prev.form_starts) : null;
  const openRate = ratio(kpis.hubs_opened, kpis.hubs_sent);
  const openRatePrev = prev ? ratio(prev.hubs_opened, prev.hubs_sent) : null;

  const cards = [
    { label: "New applications", value: formatCount(kpis.applications), cmp: compareCounts(kpis.applications, prev?.applications) },
    { label: "Form completion", value: formatPercent(completion), cmp: compareRates(completion, prev ? completionPrev : undefined) },
    { label: "Hub open rate", value: formatPercent(openRate), cmp: compareRates(openRate, prev ? openRatePrev : undefined) },
    { label: "New customers", value: formatCount(kpis.new_customers), cmp: compareCounts(kpis.new_customers, prev?.new_customers) },
  ];

  return (
    <div className={GRID} style={{ gap: "var(--space-4)" }} data-testid="kpi-row">
      {cards.map((c) => (
        <StatCard
          key={c.label}
          label={c.label}
          value={c.value}
          delta={c.cmp.text ?? undefined}
          direction={c.cmp.direction}
          note={note}
        />
      ))}
    </div>
  );
}
