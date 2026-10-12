"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ffn";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatDuration } from "@/lib/forms/insights";
import { bucketLabel, formatCount, periodPhrase, sectionLabel } from "@/lib/dashboard/metrics";
import type { DashboardOverview, PeriodId } from "@/lib/dashboard/types";
import { Figure, Skeleton } from "./ui";

const opensConfig = { hub_opens: { label: "Hub views", color: "var(--chart-1)" } } satisfies ChartConfig;
const sectionConfig = { seconds: { label: "Reading time", color: "var(--chart-1)" } } satisfies ChartConfig;

const ITEM_TYPE_LABEL: Record<string, string> = {
  founders: "Founder",
  case_studies: "Case study",
  faqs: "FAQ",
  mentors: "Mentor",
  collection: "Collection item",
  links: "Link",
};

export function HubEngagementCard({
  overview,
  period,
  contentNames,
}: {
  overview: DashboardOverview | undefined;
  period: PeriodId;
  contentNames: Map<string, string>;
}) {
  const hub = overview?.hub;
  const bucket = overview?.range.bucket ?? "day";
  const sections = (hub?.sections ?? []).map((s) => ({ ...s, label: sectionLabel(s.section) }));
  const maxViewed = Math.max(1, ...(hub?.items ?? []).map((i) => i.count));
  const maxClicked = Math.max(1, ...(hub?.clicks ?? []).map((c) => c.count));

  return (
    <Card title="Proof that gets read" subtitle={`How applicants use their hubs ${periodPhrase(period)}.`}>
      {!overview || !hub ? (
        <Skeleton height="calc(var(--space-16) * 4)" />
      ) : hub.views === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          No hub was opened {periodPhrase(period)}. Views, reading time and clicks appear here once applicants open their hubs.
        </p>
      ) : (
        // Two rows of two, so no column outgrows the others: reach and where
        // the time goes on top, what gets opened and clicked underneath.
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "var(--space-8)" }}>
          <div className="flex flex-col" style={{ gap: "var(--space-5)", minWidth: 0 }}>
            <div className="grid grid-cols-3" style={{ gap: "var(--space-4)" }}>
              <Figure label="Views" value={formatCount(hub.views)} />
              <Figure label="Hubs" value={formatCount(hub.hubs_viewed)} />
              <Figure label="Reading" value={formatDuration(hub.engaged_seconds)} />
            </div>
            <ChartContainer config={opensConfig} height={184} label={`Hub views per ${bucket}, ${periodPhrase(period)}`}>
              <BarChart data={overview.trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(b: string) => bucketLabel(b, "day")}
                />
                <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} tickCount={3} domain={[0, "auto"]} />
                <ChartTooltip
                  cursor={{ fill: "var(--surface-hover)" }}
                  content={(props) => (
                    <ChartTooltipContent
                      active={props.active}
                      payload={props.payload}
                      label={props.label as string}
                      labelFormatter={(l) => bucketLabel(String(l), bucket)}
                    />
                  )}
                />
                <Bar dataKey="hub_opens" fill="var(--color-hub_opens)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </div>

          <div style={{ minWidth: 0 }}>
            <h4 className="h4" style={{ margin: "0 0 var(--space-3)" }}>
              Where they spend time
            </h4>
            {sections.length === 0 ? (
              <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
                No reading time recorded yet.
              </p>
            ) : (
              <ChartContainer
                config={sectionConfig}
                height={Math.max(120, sections.length * 36)}
                label="Reading time by hub section"
              >
                <BarChart data={sections} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide domain={[0, "auto"]} />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={120} />
                  <ChartTooltip
                    cursor={{ fill: "var(--surface-hover)" }}
                    content={(props) => (
                      <ChartTooltipContent
                        active={props.active}
                        payload={props.payload}
                        label={props.label as string}
                        valueFormatter={(v) => formatDuration(Number(v))}
                      />
                    )}
                  />
                  <Bar dataKey="seconds" fill="var(--color-seconds)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
            )}
          </div>

          <div
            className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2"
            style={{ gap: "var(--space-8)", borderTop: "1px solid var(--border)", paddingTop: "var(--space-6)" }}
          >
            <RankedList
              title="Most viewed proof"
              empty="No founder, case study or FAQ has been opened yet."
              max={maxViewed}
              rows={hub.items.map((i) => ({
                key: `${i.target_type}:${i.target_id}`,
                name: contentNames.get(`${i.target_type}:${i.target_id}`) ?? ITEM_TYPE_LABEL[i.target_type] ?? sectionLabel(i.target_type),
                kind: ITEM_TYPE_LABEL[i.target_type] ?? sectionLabel(i.target_type),
                count: i.count,
              }))}
            />
            <RankedList
              title="Most clicked"
              empty="No links or buttons clicked yet."
              max={maxClicked}
              rows={hub.clicks.map((c) => ({
                key: `${c.type}:${c.target_id}`,
                name: c.target_id,
                kind: c.type === "call_click" ? "Call button" : "Link",
                count: c.count,
              }))}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function RankedList({
  title,
  empty,
  rows,
  max,
}: {
  title: string;
  empty: string;
  rows: { key: string; name: string; kind: string; count: number }[];
  max: number;
}) {
  return (
    <div>
      <h4 className="h4" style={{ margin: "0 0 var(--space-3)" }}>
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          {empty}
        </p>
      ) : (
        <ol className="flex flex-col" style={{ gap: "var(--space-3)", listStyle: "none", margin: 0, padding: 0 }}>
          {rows.slice(0, 5).map((row) => (
            <li key={row.key} className="flex flex-col" style={{ gap: "var(--space-1)" }}>
              <span className="flex items-baseline" style={{ gap: "var(--space-2)" }}>
                <span className="body-sm ffn-grow ffn-truncate" style={{ color: "var(--ink)" }} title={row.name}>
                  {row.name}
                </span>
                <span className="caption" style={{ color: "var(--ink-subtle)" }}>
                  {row.kind}
                </span>
                <span className="data-sm" style={{ color: "var(--ink)" }}>
                  {formatCount(row.count)}
                </span>
              </span>
              <span className="dash-meter" aria-hidden>
                <span className="dash-meter__fill" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
