"use client";

import Link from "next/link";
import { Radio } from "lucide-react";
import { Avatar, Card, EmptyState } from "@/components/ffn";
import { formatDuration } from "@/lib/forms/insights";
import { relativeTime, sectionLabel } from "@/lib/dashboard/metrics";
import type { LeadName } from "@/lib/dashboard/queries";
import type { LiveHub } from "@/lib/dashboard/types";
import { SectionError, Skeleton } from "./ui";

export function LivePanel({
  live,
  names,
  now,
  updatedAt,
  error,
}: {
  live: LiveHub[] | undefined;
  names: Map<string, LeadName>;
  now: Date | null;
  updatedAt: number;
  error: Error | null;
}) {
  const status = (
    <span className="flex items-center label-sm" style={{ gap: "var(--space-2)", color: "var(--ink-muted)" }}>
      <span className={`dash-dot ${live && live.length ? "dash-dot--success" : "dash-dot--muted"}`} aria-hidden />
      {live && live.length ? "Live" : "Idle"}
    </span>
  );

  return (
    <Card
      title="Live now"
      subtitle={
        now && updatedAt
          ? `People reading a hub. Checked ${relativeTime(new Date(updatedAt).toISOString(), now).toLowerCase()}.`
          : "People reading a hub. Checks every 30 seconds."
      }
      actions={status}
      flush
    >
      {error ? (
        <div style={{ padding: "var(--space-6)" }}>
          <SectionError message={error.message} />
        </div>
      ) : !live ? (
        <div className="flex flex-col" style={{ gap: "var(--space-3)", padding: "var(--space-6)" }}>
          <Skeleton height="var(--control-lg)" />
          <Skeleton height="var(--control-lg)" />
        </div>
      ) : live.length === 0 ? (
        <EmptyState icon={<Radio size={20} strokeWidth={1.75} />} title="No one is on a hub right now">
          When an applicant opens their hub, they appear here with the section they are reading.
        </EmptyState>
      ) : (
        <div data-testid="live-list">
          {live.map((hub) => {
            const lead = hub.lead_id ? names.get(hub.lead_id) : undefined;
            const name = lead?.name || lead?.email || hub.applicant_name || "Unnamed applicant";
            return (
              <Link key={hub.hub_id} href={hub.lead_id ? `/admin/leads/${hub.lead_id}` : "/admin/hubs"} className="dash-row-link">
                <Avatar name={name} size="sm" />
                <span className="ffn-grow flex flex-col">
                  <span className="label ffn-truncate">{name}</span>
                  <span className="caption ffn-truncate" style={{ color: "var(--ink-muted)" }}>
                    {hub.section ? `Reading ${sectionLabel(hub.section)}` : "Opened their hub"}
                    {hub.engaged_seconds > 0 ? ` · ${formatDuration(hub.engaged_seconds)} this visit` : ""}
                  </span>
                </span>
                <span className="data-sm" style={{ color: "var(--ink-subtle)", flex: "none" }}>
                  {now ? relativeTime(hub.last_seen, now) : ""}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
