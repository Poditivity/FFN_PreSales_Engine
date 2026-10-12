import { cx } from "./cx";

// Ported from the FFN design system's bundle.js (FunnelChart — see
// .claude/skills/ffn-design-system/components/FunnelChart/README.md). One
// measure, one colour: every bar is chart-1 and the drop from the row above
// is printed beside each count, because the drop is the point of the chart.

export interface FunnelDatum {
  name: string;
  value: number;
}

export interface FunnelChartProps {
  /** Ordered top to bottom. The first value sets the full-width bar. */
  data: FunnelDatum[];
  label?: string;
  className?: string;
}

export function funnelRows(data: FunnelDatum[]) {
  const top = data.length ? data[0].value : 0;
  return data.map((d, i) => {
    const pct = top ? Math.round((d.value / top) * 1000) / 10 : 0;
    const prev = i > 0 ? data[i - 1].value : null;
    const drop = prev ? Math.round((1 - d.value / prev) * 1000) / 10 : null;
    return { ...d, pct, drop };
  });
}

export function FunnelChart({ data, label, className }: FunnelChartProps) {
  return (
    <div className={cx("ffn-funnel", className)} role="group" aria-label={label || "Funnel"}>
      {funnelRows(data).map((d) => (
        <div key={d.name} className="ffn-funnel__row">
          <span className="ffn-funnel__name">{d.name}</span>
          <span className="ffn-funnel__track">
            <span className="ffn-funnel__fill" style={{ width: `${Math.max(d.pct, 2)}%`, background: "var(--chart-1)" }} />
          </span>
          <span className="ffn-funnel__stat">
            {d.value.toLocaleString("en")}
            {d.drop === null ? null : <span className="ffn-funnel__drop">{`  −${d.drop}%`}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
