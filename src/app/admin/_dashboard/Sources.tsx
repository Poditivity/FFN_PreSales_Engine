"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ffn";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCount, periodPhrase } from "@/lib/dashboard/metrics";
import type { DashboardOverview, PeriodId } from "@/lib/dashboard/types";
import { Skeleton } from "./ui";

const config = { count: { label: "Finished applications", color: "var(--chart-1)" } } satisfies ChartConfig;

// Referrer hosts can be long; the axis keeps the start, the tooltip has it whole.
const MAX_LABEL = 18;
const sourceLabel = (s: string) => (s === "direct" ? "Direct or unknown" : s);
const axisLabel = (s: string) => (s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL - 1)}\u2026` : s);

export function SourcesCard({ overview, period }: { overview: DashboardOverview | undefined; period: PeriodId }) {
  const sources = (overview?.sources ?? []).map((s) => ({ ...s, label: sourceLabel(s.source) }));
  const onlyDirect = sources.length > 0 && sources.every((s) => s.source === "direct");

  return (
    <Card title="Where applicants come from" subtitle={`Finished applications by source, ${periodPhrase(period)}.`}>
      {!overview ? (
        <Skeleton height="calc(var(--space-16) * 3)" />
      ) : sources.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          No finished applications {periodPhrase(period)}.
        </p>
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
          <ChartContainer config={config} height={Math.max(96, sources.length * 36)} label={`Finished applications by source, ${periodPhrase(period)}`}>
            <BarChart data={sources} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis type="number" hide domain={[0, "auto"]} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={136} tickFormatter={axisLabel} />
              <ChartTooltip
                cursor={{ fill: "var(--surface-hover)" }}
                content={(props) => (
                  <ChartTooltipContent
                    active={props.active}
                    payload={props.payload}
                    label={props.label as string}
                    valueFormatter={(v) => formatCount(Number(v))}
                  />
                )}
              />
              <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>

          {overview.campaigns.length > 0 && (
            <div>
              <h4 className="h4" style={{ margin: "0 0 var(--space-2)" }}>
                Campaigns
              </h4>
              <ul className="flex flex-col" style={{ gap: "var(--space-2)", listStyle: "none", margin: 0, padding: 0 }}>
                {overview.campaigns.map((c) => (
                  <li key={c.campaign} className="flex items-baseline" style={{ gap: "var(--space-2)" }}>
                    <span className="body-sm ffn-grow ffn-truncate">{c.campaign}</span>
                    <span className="data-sm">{formatCount(c.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onlyDirect && (
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
              Add <span className="data-sm">utm_source</span> and <span className="data-sm">utm_campaign</span> to the form
              links you share, and each channel shows up here by name.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
