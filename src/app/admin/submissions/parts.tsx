"use client";

import { Star, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ffn";
import { EFFORT_BAND_LABEL, type SubmissionInsights } from "@/lib/forms/insights";
import type { SignalTone } from "@/lib/forms/submissionAnalysis";

// Small pieces shared by the list, the review card and the insights view.

export type Band = SubmissionInsights["effortBand"];

const BAND_TONE: Record<Band, "success" | "warning" | "danger"> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

const SIGNAL_BADGE: Record<SignalTone, BadgeTone> = {
  good: "success",
  warn: "warning",
  neutral: "neutral",
};

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="eyebrow" style={{ color: "var(--ink-subtle)", textTransform: "uppercase", ...style }}>
      {children}
    </div>
  );
}

export function StarRating({
  value,
  onChange,
  size = 22,
  readOnly = false,
}: {
  value: number | null;
  onChange?: (next: number | null) => void;
  size?: number;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;

  return (
    <div className="flex items-center" style={{ gap: "var(--space-0\\.5)" }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="subs-star"
          disabled={readOnly}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={value === n}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={(e) => {
            e.stopPropagation();
            if (readOnly || !onChange) return;
            onChange(value === n ? null : n);
          }}
        >
          <Star
            size={size}
            strokeWidth={1.75}
            fill={n <= shown ? "var(--warning)" : "none"}
            color={n <= shown ? "var(--warning)" : "var(--border-control)"}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

/** The effort score as a ring. The band's word sits beside it wherever it is used. */
export function ScoreRing({ score, band, size = 76 }: { score: number; band: Band; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle className="subs-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className={`subs-ring--${BAND_TONE[band]}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <span className="data-lg">{score}</span>
      </div>
    </div>
  );
}

export function SignalChip({ tone = "neutral", children, title }: { tone?: SignalTone; children: ReactNode; title?: string }) {
  return (
    <span title={title} style={{ display: "inline-flex" }}>
      <Badge tone={SIGNAL_BADGE[tone]} dot={false}>
        {children}
      </Badge>
    </span>
  );
}

/** Effort score as a badge, in the table. The title carries the band's word. */
export function ScorePill({ score, band }: { score: number; band: Band }) {
  return (
    <span title={EFFORT_BAND_LABEL[band]} style={{ display: "inline-flex" }}>
      <Badge tone={BAND_TONE[band]} dot={false}>
        <span className="data-sm">{score}</span>
      </Badge>
    </span>
  );
}

export function BandBadge({ band }: { band: Band }) {
  return <Badge tone={BAND_TONE[band]}>{EFFORT_BAND_LABEL[band]}</Badge>;
}

export function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="subs-metric">
      <div className="flex items-center" style={{ gap: "var(--space-2)", color: "var(--ink-subtle)" }}>
        <Icon size={14} aria-hidden />
        <span className="caption">{label}</span>
      </div>
      <div className="data-lg" style={{ marginTop: "var(--space-1)" }}>
        {value}
      </div>
      {hint && (
        <div className="caption" style={{ color: "var(--ink-muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
      <span className="caption" style={{ color: "var(--ink-muted)", width: "calc(var(--space-16) * 1.4)", flexShrink: 0 }}>
        {label}
      </span>
      <div className="subs-track">
        <span className="subs-fill" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="data-sm" style={{ color: "var(--ink-muted)", width: "var(--space-10)", textAlign: "right" }}>
        {value}/{max}
      </span>
    </div>
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  new: "brand",
  reviewed: "neutral",
  shortlisted: "success",
  rejected: "danger",
  contacted: "warning",
};

export const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

export function SubmissionStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{statusLabel(status)}</Badge>;
}
