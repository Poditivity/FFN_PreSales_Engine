"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ffn";
import { ChartContainer, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { bucketLabel, formatCount, periodPhrase } from "@/lib/dashboard/metrics";
import type { DashboardOverview, PeriodId } from "@/lib/dashboard/types";
import { Skeleton } from "./ui";

// chart-1 is the primary measure (finished applications); starts are the
// context behind it, so they take chart-2.
const config = {
  applications: { label: "Finished applications", color: "var(--chart-1)" },
  starts: { label: "Form starts", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function TrendCard({ overview, period }: { overview: DashboardOverview | undefined; period: PeriodId }) {
  const bucket = overview?.range.bucket ?? "day";
  const data = overview?.trend ?? [];
  const total = data.reduce((sum, p) => sum + p.applications, 0);

  return (
    <Card
      title="Applications"
      subtitle={`Form starts and finished applications per ${bucket}, ${periodPhrase(period)}.`}
      actions={<ChartLegendContent config={config} keys={["applications", "starts"]} />}
    >
      {!overview ? (
        <Skeleton height="calc(var(--space-16) * 4)" />
      ) : total === 0 && data.every((p) => p.starts === 0) ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          No form activity {periodPhrase(period)}.
        </p>
      ) : (
        <ChartContainer config={config} height={256} label={`Form starts and finished applications per ${bucket}, ${periodPhrase(period)}`}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(b: string) => bucketLabel(b, "day")}
            />
            <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} tickCount={3} domain={[0, "auto"]} />
            <ChartTooltip
              cursor={{ stroke: "var(--border-strong)" }}
              content={(props) => (
                <ChartTooltipContent
                  active={props.active}
                  payload={props.payload}
                  label={props.label as string}
                  labelFormatter={(l) => bucketLabel(String(l), bucket)}
                  valueFormatter={(v) => formatCount(Number(v))}
                />
              )}
            />
            <Area
              dataKey="starts"
              type="monotone"
              stroke="var(--color-starts)"
              strokeWidth={2}
              fill="var(--color-starts)"
              fillOpacity={0.08}
              isAnimationActive={false}
            />
            <Area
              dataKey="applications"
              type="monotone"
              stroke="var(--color-applications)"
              strokeWidth={2}
              fill="var(--color-applications)"
              fillOpacity={0.16}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </Card>
  );
}
