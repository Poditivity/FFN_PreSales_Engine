"use client";

// Form-level read across whatever the filters are currently showing: how
// interested this cohort is, how long they stayed, where they came from, and
// which individual questions earn real answers and which cost you applicants.
// Ported from build-fellowship's InsightsPanel.

import { Clock, PenLine, SkipForward, TrendingUp, type LucideIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Card, EmptyState } from "@/components/ffn";
import { formatDuration } from "@/lib/forms/insights";
import {
  analyzeQuestions,
  distributions,
  QUESTION_VERDICT,
  type SubmissionEntry,
  type SubmissionStats,
  type TallyItem,
} from "@/lib/forms/submissionAnalysis";
import { Eyebrow, SignalChip } from "./parts";

const pct = (n: number) => `${Math.round(n * 100)}%`;

function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: "var(--space-3)" }}>
      <Eyebrow>{children}</Eyebrow>
      {hint && (
        <div className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

type FillTone = "success" | "warning" | "danger" | "neutral" | undefined;

function BarList({ items, total, tone }: { items: (TallyItem & { tone?: FillTone })[]; total: number; tone?: FillTone }) {
  if (!items.length) {
    return (
      <div className="body-sm" style={{ color: "var(--ink-muted)" }}>
        No data
      </div>
    );
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      {items.map((item) => {
        const t = item.tone ?? tone;
        return (
          <div key={item.key} className="flex items-center" style={{ gap: "var(--space-3)" }}>
            <span className="body-sm" style={{ width: "calc(var(--space-16) * 1.5)", flexShrink: 0 }}>
              {item.label}
            </span>
            <div className="subs-track">
              <span className={t ? `subs-fill subs-fill--${t}` : "subs-fill"} style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
            <span className="data-sm" style={{ color: "var(--ink-muted)", minWidth: "var(--space-16)", textAlign: "right", flexShrink: 0 }}>
              {item.count}
              {total ? ` · ${pct(item.count / total)}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Callout({ icon: Icon, label, question, value }: { icon: LucideIcon; label: string; question?: string; value: string }) {
  return (
    <div className="subs-metric">
      <div className="flex items-center" style={{ gap: "var(--space-2)", color: "var(--ink-subtle)" }}>
        <Icon size={14} aria-hidden />
        <span className="caption">{label}</span>
      </div>
      <div className="body" style={{ marginTop: "var(--space-1)" }}>
        {question || "—"}
      </div>
      <div className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-0\\.5)" }}>
        {value}
      </div>
    </div>
  );
}

function DayBars({ days }: { days: { key: string; count: number }[] }) {
  if (days.length < 2) {
    return (
      <div className="body-sm" style={{ color: "var(--ink-muted)" }}>
        Not enough days to chart
      </div>
    );
  }
  const max = Math.max(...days.map((d) => d.count), 1);
  const shown = days.slice(-30);
  return (
    <div>
      <div className="flex items-end" style={{ gap: "var(--space-0\\.5)", height: "calc(var(--space-16) * 1.25)" }}>
        {shown.map((d) => (
          <div
            key={d.key}
            title={`${d.key}: ${d.count}`}
            style={{
              flex: 1,
              minWidth: "var(--space-0\\.5)",
              height: `${Math.max((d.count / max) * 100, 4)}%`,
              background: "var(--chart-1)",
              borderRadius: "var(--radius-xs) var(--radius-xs) 0 0",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between" style={{ marginTop: "var(--space-2)" }}>
        <span className="data-sm" style={{ color: "var(--chart-axis)" }}>{shown[0].key}</span>
        <span className="data-sm" style={{ color: "var(--chart-axis)" }}>peak {max}/day</span>
        <span className="data-sm" style={{ color: "var(--chart-axis)" }}>{shown[shown.length - 1].key}</span>
      </div>
    </div>
  );
}

export function InsightsPanel({ entries, stats }: { entries: SubmissionEntry[]; stats: SubmissionStats }) {
  const { questions } = useMemo(() => analyzeQuestions(entries), [entries]);
  const dist = useMemo(() => distributions(entries), [entries]);

  if (!entries.length) {
    return <EmptyState title="Nothing to analyse">No submissions match these filters.</EmptyState>;
  }

  const total = entries.length;
  const answerable = questions.filter((q) => q.avgSeconds > 0);
  const slowest = [...answerable].sort((a, b) => b.avgSeconds - a.avgSeconds)[0];
  const mostSkipped = [...questions].sort((a, b) => b.skipRate - a.skipRate)[0];
  const richest = [...questions].sort((a, b) => b.avgWords - a.avgWords)[0];

  const bandTone: Record<string, FillTone> = { high: "success", medium: "warning", low: "danger" };

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
        Everything below is calculated across the <span className="data-sm">{total}</span> submission{total === 1 ? "" : "s"}{" "}
        matching your current filters. Change a filter and these numbers follow.
      </p>

      {/* Headline callouts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(calc(var(--space-16) * 3.5), 1fr))", gap: "var(--space-3)" }}>
        <Callout
          icon={Clock}
          label="Slowest question"
          question={slowest?.label}
          value={slowest ? `${formatDuration(slowest.avgSeconds)} on average` : ""}
        />
        <Callout
          icon={SkipForward}
          label="Most skipped"
          question={mostSkipped?.label}
          value={mostSkipped ? `${pct(mostSkipped.skipRate)} left it blank` : ""}
        />
        <Callout
          icon={PenLine}
          label="Longest answers"
          question={richest?.label}
          value={richest ? `${richest.avgWords} words on average` : ""}
        />
        <Callout
          icon={TrendingUp}
          label="Cohort effort"
          question={`Average score ${stats.avgScore ?? "—"} / 100`}
          value={`${stats.highEffort} high effort · ${stats.flagged} flagged`}
        />
      </div>

      {/* Distributions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(calc(var(--space-16) * 4.5), 1fr))", gap: "var(--space-4)" }}>
        <Card>
          <SectionTitle hint="Effort score band: how much each applicant put in.">Interest level</SectionTitle>
          <BarList items={dist.bands.map((b) => ({ ...b, tone: bandTone[b.key] }))} total={total} />
        </Card>

        <Card>
          <SectionTitle hint="Your team's own scoring, for what has been reviewed so far.">Star ratings</SectionTitle>
          <BarList items={dist.ratings} total={total} tone="warning" />
        </Card>

        <Card>
          <SectionTitle hint="Under a minute on a long form usually means they were not reading it.">Time on form</SectionTitle>
          <BarList items={dist.times} total={total} />
        </Card>

        <Card>
          <SectionTitle hint="Where the traffic came from, by UTM source.">Source</SectionTitle>
          <BarList items={dist.sources} total={total} />
        </Card>
      </div>

      <Card>
        <SectionTitle hint="Applications per day, IST.">Volume over time</SectionTitle>
        <DayBars days={dist.days} />
      </Card>

      {/* Question performance */}
      <div>
        <div style={{ marginBottom: "var(--space-3)" }}>
          <SectionTitle hint="Average time runs from when a field is focused to when it is left, so it reflects thinking time, not page time. Verdicts are relative to the other questions on this form.">
            Question performance
          </SectionTitle>
        </div>
        <div className="ffn-table-wrap" style={{ overflowX: "auto" }}>
          <table className="ffn-table">
            <caption className="ffn-sr">Question performance across the submissions matching the current filters</caption>
            <thead>
              <tr>
                <th style={{ minWidth: "calc(var(--space-16) * 4)" }}>Question</th>
                <th style={{ width: "calc(var(--space-16) * 2.5)" }}>Avg time</th>
                <th style={{ textAlign: "right" }}>Answered</th>
                <th style={{ textAlign: "right" }}>Avg words</th>
                <th style={{ textAlign: "right" }}>Pasted</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const verdict = QUESTION_VERDICT[q.verdict];
                return (
                  <tr key={q.id}>
                    <td style={{ verticalAlign: "top" }}>
                      <div className="body-sm">{q.label}</div>
                      <span className="ffn-table__sub data-sm">
                        {q.type}
                        {q.formTitle ? ` · ${q.formTitle}` : ""}
                      </span>
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                        <div className="subs-track" style={{ minWidth: "var(--space-10)" }}>
                          <span
                            className={q.isSlow ? "subs-fill subs-fill--warning" : "subs-fill subs-fill--neutral"}
                            style={{ width: `${q.timeShare * 100}%` }}
                          />
                        </div>
                        <span className="data-sm" style={{ width: "var(--space-12)", textAlign: "right" }}>
                          {formatDuration(q.avgSeconds)}
                        </span>
                      </div>
                    </td>
                    <td className="ffn-table__num" style={{ verticalAlign: "top" }}>
                      {q.answered}/{q.shown}
                      <div className="caption" style={{ color: q.skipRate >= 0.35 ? "var(--warning)" : "var(--ink-muted)" }}>
                        {pct(1 - q.skipRate)}
                      </div>
                    </td>
                    <td className="ffn-table__num" style={{ verticalAlign: "top" }}>
                      {q.avgWords || "—"}
                    </td>
                    <td className="ffn-table__num" style={{ verticalAlign: "top" }}>
                      {q.pasteRate ? pct(q.pasteRate) : "—"}
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <SignalChip tone={verdict.tone} title={verdict.hint}>
                        {verdict.label}
                      </SignalChip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "var(--space-4)", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(calc(var(--space-16) * 5), 1fr))",
                gap: "var(--space-2) var(--space-5)",
              }}
            >
              {Object.entries(QUESTION_VERDICT).map(([key, v]) => (
                <div key={key} className="flex items-start" style={{ gap: "var(--space-2)" }}>
                  <SignalChip tone={v.tone}>{v.label}</SignalChip>
                  <span className="caption" style={{ color: "var(--ink-muted)" }}>
                    {v.hint}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
