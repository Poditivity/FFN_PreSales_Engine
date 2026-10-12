"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ffn";
import { formatDuration } from "@/lib/forms/insights";
import { formatCount, formatPercent, formHealthFlag, periodPhrase, ratio } from "@/lib/dashboard/metrics";
import type { DashboardOverview, PeriodId } from "@/lib/dashboard/types";
import { Skeleton } from "./ui";

export function FormHealthCard({ overview, period }: { overview: DashboardOverview | undefined; period: PeriodId }) {
  // Forms with no traffic in the window are noise here; the Forms page lists them all.
  const forms = (overview?.forms ?? []).filter((f) => f.starts > 0 || f.applications > 0);

  return (
    <Card title="Form health" subtitle={`How each form performs ${periodPhrase(period)}.`} flush>
      {!overview ? (
        <div style={{ padding: "var(--space-6)" }}>
          <Skeleton height="calc(var(--space-16) * 2)" />
        </div>
      ) : forms.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0, padding: "var(--space-6)" }}>
          No one opened a form {periodPhrase(period)}.
        </p>
      ) : (
        <>
        {/* Phones get one stacked row per form; the table needs tablet width. */}
        <ul className="md:hidden" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {forms.map((form) => {
            const flag = formHealthFlag(form);
            return (
              <li key={form.id} className="dash-stack-row">
                <Link href={`/admin/submissions?form=${form.id}`} className="dash-link body-medium">
                  {form.title}
                </Link>
                <span className="data-sm" style={{ color: "var(--ink)" }}>
                  {formatPercent(ratio(form.completes, form.starts))} of {formatCount(form.starts)} finished · median{" "}
                  {formatDuration(form.median_seconds)}
                </span>
                <span className="body-sm flex items-center flex-wrap" style={{ gap: "var(--space-2)", color: "var(--ink-muted)" }}>
                  {form.top_drop_field ? `Most common exit: ${form.top_drop_field}` : "No exits recorded"}
                  {flag && <Badge tone={flag.tone}>{flag.text}</Badge>}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="ffn-table-wrap hidden md:block" style={{ border: 0, borderRadius: 0, overflowX: "auto" }}>
          <table className="ffn-table">
            <caption className="ffn-sr">Form completion and time to finish, {periodPhrase(period)}</caption>
            <thead>
              <tr>
                <th scope="col">Form</th>
                <th scope="col" className="ffn-table__num">Started</th>
                <th scope="col" className="ffn-table__num">Completion</th>
                <th scope="col" className="ffn-table__num">Median time</th>
                <th scope="col">Most common exit</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => {
                const flag = formHealthFlag(form);
                return (
                  <tr key={form.id}>
                    <td style={{ minWidth: "calc(var(--space-16) * 3)" }}>
                      <Link href={`/admin/submissions?form=${form.id}`} className="dash-link body-medium">
                        {form.title}
                      </Link>
                      <span className="ffn-table__sub flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
                        <span>
                          {formatCount(form.applications)} {form.applications === 1 ? "application" : "applications"}
                          {form.status !== "active" ? ` · ${form.status}` : ""}
                        </span>
                        {flag && <Badge tone={flag.tone}>{flag.text}</Badge>}
                      </span>
                    </td>
                    <td className="ffn-table__num">{formatCount(form.starts)}</td>
                    <td className="ffn-table__num">
                      {formatPercent(ratio(form.completes, form.starts))}
                      <span className="ffn-table__sub">{formatCount(form.completes)} finished</span>
                    </td>
                    <td className="ffn-table__num">{formatDuration(form.median_seconds)}</td>
                    <td style={{ whiteSpace: "normal", minWidth: "calc(var(--space-16) * 2)" }}>
                      {form.top_drop_field ? (
                        <span className="body-sm">
                          {form.top_drop_field}
                          <span className="ffn-table__sub">
                            {formatCount(form.drops)} left the form
                          </span>
                        </span>
                      ) : (
                        <span className="body-sm" style={{ color: "var(--ink-subtle)" }}>
                          None recorded
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Card>
  );
}
