"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { ResponsiveContainer, Tooltip } from "recharts";
import { cx } from "@/components/ffn/cx";

// The shadcn/ui chart primitives (ChartContainer, ChartTooltip,
// ChartTooltipContent, ChartLegend, ChartLegendContent), trimmed to what the
// FFN admin uses and styled with FFN tokens instead of shadcn's defaults —
// the design system's brand book names Recharts, themed with chart-1 through
// chart-6, chart-grid and chart-axis, as the charting layer. Each series in
// a ChartConfig gets a --color-<key> custom property, so marks are written
// as fill="var(--color-applications)" and follow the theme automatically.

export type ChartConfig = Record<string, { label: ReactNode; color: string }>;

const ChartContext = createContext<ChartConfig>({});

export function useChartConfig() {
  return useContext(ChartContext);
}

export function ChartContainer({
  config,
  className,
  height = 240,
  label,
  children,
}: {
  config: ChartConfig;
  className?: string;
  /** Plot height; the width always follows the container. */
  height?: number;
  /** Read by screen readers; say what the chart shows and for which period. */
  label: string;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const vars = Object.fromEntries(
    Object.entries(config).map(([key, { color }]) => [`--color-${key}`, color]),
  ) as CSSProperties;
  return (
    <ChartContext.Provider value={config}>
      <div className={cx("ffn-chartbox caption", className)} style={{ ...vars, height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = Tooltip;

interface TooltipEntry {
  dataKey?: string | number | ((obj: unknown) => unknown);
  name?: string | number;
  value?: unknown;
  color?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = (v) => (typeof v === "number" ? v.toLocaleString("en") : String(v ?? "")),
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: ReactNode;
  labelFormatter?: (label: ReactNode) => ReactNode;
  valueFormatter?: (value: unknown) => ReactNode;
}) {
  const config = useChartConfig();
  if (!active || !payload?.length) return null;
  return (
    <div className="ffn-chart-tooltip">
      {label !== undefined && label !== "" && (
        <p className="label-sm" style={{ color: "var(--ink)", margin: 0 }}>
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <ul className="ffn-chart-tooltip__list">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? "");
          const series = config[key];
          return (
            <li key={key} className="ffn-chart-tooltip__row">
              <span className="ffn-chart-tooltip__swatch" style={{ background: series?.color ?? entry.color }} aria-hidden />
              <span className="body-sm ffn-grow" style={{ color: "var(--ink-muted)" }}>
                {series?.label ?? entry.name}
              </span>
              <span className="data-sm" style={{ color: "var(--ink)" }}>
                {valueFormatter(entry.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Series names printed with a mark beside each, so colour is never the only key. */
export function ChartLegendContent({ config, keys }: { config: ChartConfig; keys: string[] }) {
  return (
    <ul className="ffn-chart-legend">
      {keys.map((key) => (
        <li key={key} className="ffn-chart-legend__item label-sm">
          <span className="ffn-chart-tooltip__swatch" style={{ background: config[key]?.color }} aria-hidden />
          {config[key]?.label ?? key}
        </li>
      ))}
    </ul>
  );
}
