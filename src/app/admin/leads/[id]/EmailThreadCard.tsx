"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Card } from "@/components/ffn";
import { getHubEngagementSummary, type HubEngagementSummary } from "@/lib/emailEngine/hubContext";
import { listLeadEmailHistory } from "@/lib/emailEngine/thread";
import type { LeadHistoryEntry } from "@/lib/emailEngine/types";
import { formatIST } from "@/lib/forms/ist";

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  pending: "warning",
  sent: "success",
  failed: "danger",
};

function entryLabel(entry: LeadHistoryEntry): string {
  if (entry.kind === "submission_email") return "Application confirmation";
  if (entry.kind === "hub_email") return "Hub notification";
  return entry.trigger === "stage_change" ? "Automated, stage change" : "Manual";
}

/**
 * Every email sent to this lead, automated and manual, newest last, with how the
 * lead's hub has been used. Writing a message is done in the composer above it;
 * `refreshKey` changes when that sends something, and the list reloads.
 */
export function EmailThreadCard({ leadId, refreshKey = 0 }: { leadId: string; refreshKey?: number }) {
  const [history, setHistory] = useState<LeadHistoryEntry[] | null>(null);
  const [hubSummary, setHubSummary] = useState<HubEngagementSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listLeadEmailHistory(leadId), getHubEngagementSummary(leadId)])
      .then(([h, hub]) => {
        if (cancelled) return;
        setHistory(h);
        setHubSummary(hub);
        setLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load email history");
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, refreshKey]);

  return (
    <Card title="Email history" subtitle="Every email sent to this lead, automated and manual, in one place.">
      {hubSummary && hubSummary.length > 0 && (
        <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
          <p className="label" style={{ marginBottom: "var(--space-2)" }}>
            Hub engagement
          </p>
          {hubSummary.map((hub) => (
            <p key={hub.hub_id} className="body-sm" style={{ color: "var(--ink-muted)" }}>
              {hub.status === "opened" ? `Opened ${hub.open_count} time${hub.open_count === 1 ? "" : "s"}` : "Not yet opened"}
              {hub.viewed_items.length > 0 && `, viewed ${hub.viewed_items.map((v) => `${v.target_type} (${v.count})`).join(", ")}`}
            </p>
          ))}
        </div>
      )}

      {loadError && (
        <Alert tone="danger" title="Could not load history">
          {loadError}
        </Alert>
      )}

      {history === null && !loadError ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          Loading
        </p>
      ) : history !== null && history.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          No emails yet.
        </p>
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {(history ?? []).map((entry) => (
            <div
              key={`${entry.kind}-${entry.id}`}
              className="flex items-center justify-between"
              style={{ gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}
            >
              <div style={{ minWidth: 0 }}>
                <p className="body-sm" style={{ margin: 0, overflowWrap: "anywhere" }}>
                  {entry.subject || "(no subject yet)"}
                </p>
                <p className="caption" style={{ margin: 0, color: "var(--ink-subtle)" }}>
                  {entryLabel(entry)} · {formatIST(entry.created_at)}
                </p>
              </div>
              <Badge tone={STATUS_TONE[entry.status] ?? "neutral"} dot={false}>
                {entry.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
