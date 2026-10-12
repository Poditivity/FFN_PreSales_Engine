"use client";

import Link from "next/link";
import { Card, FunnelChart, STAGES, StageBadge } from "@/components/ffn";
import { formatCount, formatDays, periodPhrase } from "@/lib/dashboard/metrics";
import type { DashboardOverview, PeriodId } from "@/lib/dashboard/types";
import { Figure, LinkButton, Skeleton } from "./ui";

// The five on-path stages only; nurture, dormant and lost are off the path, not steps.
const PATH = STAGES.slice(0, 5);

export function PipelineCard({ overview, period }: { overview: DashboardOverview | undefined; period: PeriodId }) {
  return (
    <Card
      title="Pipeline"
      subtitle={`Leads created ${periodPhrase(period)}, by the furthest stage each one reached.`}
      actions={
        <LinkButton href="/admin/leads" size="sm" variant="ghost">
          Leads board
        </LinkButton>
      }
    >
      {!overview ? (
        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          {PATH.map((s) => (
            <Skeleton key={s.id} height="var(--space-8)" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
          <FunnelChart
            label={`Pipeline funnel, ${periodPhrase(period)}`}
            data={PATH.map((s) => ({
              name: s.label,
              value: overview.funnel.find((f) => f.stage === s.id)?.count ?? 0,
            }))}
          />

          <div className="grid grid-cols-2" style={{ gap: "var(--space-4)" }}>
            <Figure label="Stage moves" value={formatCount(overview.kpis.stage_moves)} note={periodPhrase(period)} />
            <Figure
              label="Lead to customer"
              value={formatDays(overview.median_days_to_customer)}
              note="Median, for customers won in this period"
            />
          </div>

          <div>
            <p className="eyebrow" style={{ color: "var(--ink-subtle)", textTransform: "uppercase", margin: "0 0 var(--space-2)" }}>
              Right now
            </p>
            <ul className="flex flex-wrap" style={{ gap: "var(--space-2)", listStyle: "none", margin: 0, padding: 0 }}>
              {STAGES.map((s) => (
                <li key={s.id}>
                  <Link href="/admin/leads" className="dash-chip" aria-label={`${overview.stages_now[s.id] ?? 0} leads at ${s.label}`}>
                    <StageBadge stage={s.id} />
                    <span className="data-sm">{formatCount(overview.stages_now[s.id] ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
