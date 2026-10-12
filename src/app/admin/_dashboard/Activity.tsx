"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ActivityTimeline, Card, stageDef, type ActivityItem } from "@/components/ffn";
import { relativeTime } from "@/lib/dashboard/metrics";
import type { LeadName } from "@/lib/dashboard/queries";
import type { ActivityEvent } from "@/lib/dashboard/types";
import { LinkButton, SectionError, Skeleton } from "./ui";

function Who({ event, names }: { event: ActivityEvent; names: Map<string, LeadName> }) {
  const lead = event.lead_id ? names.get(event.lead_id) : undefined;
  const label =
    lead?.name ||
    lead?.email ||
    (event.kind === "hub_created" || event.kind === "hub_opened" ? event.detail : null) ||
    "a lead";
  if (!event.lead_id) return <>{label}</>;
  return (
    <Link href={`/admin/leads/${event.lead_id}`} className="dash-link">
      {label}
    </Link>
  );
}

// An email subject is not the lead's own words, so it rides on the title
// line in muted text rather than in the timeline's quote box.
function Subject({ text }: { text: string | null }) {
  if (!text) return null;
  return <span style={{ color: "var(--ink-muted)" }}>{`: ${text}`}</span>;
}

// Title says what happened and who did it, in one line; tone marks the kind
// of event (brand for a stage move, success for a delivery, danger for a
// failure), per the ActivityTimeline rules.
function describe(event: ActivityEvent, names: Map<string, LeadName>): { title: ReactNode; tone?: ActivityItem["tone"] } {
  const who = <Who event={event} names={names} />;
  switch (event.kind) {
    case "application":
      return { title: <>{who} applied to {event.detail}</> };
    case "stage":
      return {
        tone: "brand",
        title: (
          <>
            {event.actor ? `${event.actor} moved ` : "Moved "}
            {who} from {stageDef(event.from_stage ?? "").label} to {stageDef(event.to_stage ?? "").label}
          </>
        ),
      };
    case "hub_created":
      return { title: <>{event.actor ? `${event.actor} created a hub for ` : "Hub created for "}{who}</> };
    case "hub_opened":
      return { tone: "success", title: <>{who} opened their hub for the first time</> };
    case "email_sent":
      return {
        tone: "success",
        title:
          event.extra === "stage_change" ? (
            <>
              Stage email sent to {who}
              <Subject text={event.detail} />
            </>
          ) : (
            <>
              {event.actor ?? "The team"} emailed {who}
              <Subject text={event.detail} />
            </>
          ),
      };
    case "email_failed":
      return {
        tone: "danger",
        title: (
          <>
            Email to {who} did not send
            <Subject text={event.detail} />
          </>
        ),
      };
  }
}

export function ActivityCard({
  activity,
  names,
  now,
  error,
}: {
  activity: ActivityEvent[] | undefined;
  names: Map<string, LeadName>;
  now: Date | null;
  error: Error | null;
}) {
  return (
    <Card
      title="Recent activity"
      subtitle="Every touch across the pipeline, newest first."
      actions={
        <LinkButton href="/admin/leads" size="sm" variant="ghost">
          All leads
        </LinkButton>
      }
    >
      {error ? (
        <SectionError message={error.message} />
      ) : !activity ? (
        <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height="var(--space-10)" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          Nothing has happened yet. Applications, stage moves, hubs and emails appear here as they happen.
        </p>
      ) : (
        <ActivityTimeline
          items={activity.map((event, i) => {
            const { title, tone } = describe(event, names);
            return {
              id: `${event.kind}-${event.at}-${i}`,
              title,
              tone,
              meta: now ? relativeTime(event.at, now) : undefined,
            };
          })}
        />
      )}
    </Card>
  );
}
