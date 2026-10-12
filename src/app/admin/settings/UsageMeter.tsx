interface UsageMeterProps {
  label: string;
  /** Amount used, already in the unit shown. */
  used: number;
  /** Allowance in the same unit. Null draws an empty track and no percentage. */
  limit: number | null;
  format: (n: number) => string;
}

// A labelled bar. The figures are always printed beside it, so the bar is
// never the only signal.
export function UsageMeter({ label, used, limit, format }: UsageMeterProps) {
  const share = limit ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      <div className="flex items-baseline justify-between" style={{ gap: "var(--space-3)" }}>
        <span className="body-sm" style={{ color: "var(--ink-muted)" }}>
          {label}
        </span>
        <span className="data-sm" style={{ color: "var(--ink)" }}>
          {format(used)}
          {limit ? ` of ${format(limit)}` : ""}
        </span>
      </div>
      <div
        className="settings-meter"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit ?? undefined}
        aria-valuenow={limit ? Math.min(used, limit) : undefined}
        aria-valuetext={limit ? `${format(used)} of ${format(limit)}` : `${format(used)}, no limit set`}
      >
        <div className="settings-meter__fill" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}
