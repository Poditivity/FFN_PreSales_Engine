"use client";

import Link from "next/link";
import { CheckCircle2, Clock, Eye, Inbox, Link2, MailWarning, Send, type LucideIcon } from "lucide-react";
import { Card, EmptyState, stageDef } from "@/components/ffn";
import { attentionQueue, daysSince, formatCount, relativeTime } from "@/lib/dashboard/metrics";
import type { LeadName } from "@/lib/dashboard/queries";
import type { AttentionKey, DashboardAttention } from "@/lib/dashboard/types";
import { LinkButton, SectionError, Skeleton } from "./ui";

type Tone = "danger" | "warning" | "brand" | "neutral";

interface ChipItem {
  key: string;
  href: string;
  name: string;
  meta: string;
}

interface SignalView {
  title: string;
  body: string;
  tone: Tone;
  icon: LucideIcon;
  action: { label: string; href: string };
  chips: ChipItem[];
}

const leadHref = (id: string | null) => (id ? `/admin/leads/${id}` : "/admin/leads");
const hubHref = (leadId: string | null) => (leadId ? `/admin/leads/${leadId}` : "/admin/hubs");

function nameOf(leadId: string | null, names: Map<string, LeadName>, fallback?: string | null) {
  const lead = leadId ? names.get(leadId) : undefined;
  return lead?.name || lead?.email || fallback || "Unnamed lead";
}

function buildSignal(
  key: AttentionKey,
  attention: DashboardAttention,
  names: Map<string, LeadName>,
  now: Date | null,
): SignalView {
  const when = (iso: string) => (now ? relativeTime(iso, now) : "");
  switch (key) {
    case "failed_emails":
      return {
        title: "Emails that did not send",
        body: "Open the thread to read the error and send it again.",
        tone: "danger",
        icon: MailWarning,
        action: { label: "Open first thread", href: leadHref(attention.failed_emails.items[0]?.lead_id ?? null) },
        chips: attention.failed_emails.items.map((i) => ({
          key: i.message_id,
          href: leadHref(i.lead_id),
          name: nameOf(i.lead_id, names),
          meta: i.subject || when(i.at),
        })),
      };
    case "warm_hubs":
      return {
        title: "Hubs opened in the last two days",
        body: "These applicants looked at their proof recently. Follow up while it is fresh.",
        tone: "brand",
        icon: Eye,
        action: { label: "Follow up", href: hubHref(attention.warm_hubs.items[0]?.lead_id ?? null) },
        chips: attention.warm_hubs.items.map((i) => ({
          key: i.hub_id,
          href: hubHref(i.lead_id),
          name: nameOf(i.lead_id, names, i.applicant_name),
          meta: `${i.open_count} ${i.open_count === 1 ? "open" : "opens"} · ${when(i.at)}`,
        })),
      };
    case "no_hub":
      return {
        title: "Qualified leads with no hub",
        body: "MQL and SQL leads who have not been sent a proof hub yet.",
        tone: "brand",
        icon: Link2,
        action: { label: "Create a hub", href: "/admin/hubs" },
        chips: attention.no_hub.items.map((i) => ({
          key: i.lead_id,
          href: leadHref(i.lead_id),
          name: nameOf(i.lead_id, names),
          meta: stageDef(i.stage).label,
        })),
      };
    case "draft_hubs":
      return {
        title: "Hubs not sent yet",
        body: "A draft hub stays hidden from the applicant until you send it.",
        tone: "warning",
        icon: Send,
        action: { label: "Review drafts", href: "/admin/hubs" },
        chips: attention.draft_hubs.items.map((i) => ({
          key: i.hub_id,
          href: hubHref(i.lead_id),
          name: nameOf(i.lead_id, names, i.applicant_name),
          meta: `Created ${when(i.at)}`,
        })),
      };
    case "stuck":
      return {
        title: "Leads with no stage change in 14 days",
        body: "Move them forward, or note on the record why they are waiting.",
        tone: "warning",
        icon: Clock,
        action: { label: "Open leads board", href: "/admin/leads" },
        chips: attention.stuck.items.map((i) => ({
          key: i.lead_id,
          href: leadHref(i.lead_id),
          name: nameOf(i.lead_id, names),
          meta: now ? `${stageDef(i.stage).label} · ${daysSince(i.at, now)} days` : stageDef(i.stage).label,
        })),
      };
    case "unreviewed": {
      const formId = attention.unreviewed.items[0]?.form_id;
      return {
        title: "Applications not rated yet",
        body: "Rate each one so the team knows who to call first.",
        tone: "neutral",
        icon: Inbox,
        action: {
          label: "Start reviewing",
          href: formId ? `/admin/submissions?form=${formId}&rating=unrated` : "/admin/submissions?rating=unrated",
        },
        chips: attention.unreviewed.items.map((i) => ({
          key: i.submission_id,
          href: leadHref(i.lead_id),
          name: nameOf(i.lead_id, names),
          meta: when(i.at),
        })),
      };
    }
  }
}

export function AttentionPanel({
  attention,
  names,
  now,
  error,
}: {
  attention: DashboardAttention | undefined;
  names: Map<string, LeadName>;
  now: Date | null;
  error: Error | null;
}) {
  const queue = attentionQueue(attention);

  return (
    <Card
      title="Needs your attention"
      subtitle={attention ? (queue.length ? "Most urgent first. Each list shows the first five." : undefined) : undefined}
      flush
    >
      {error ? (
        <div style={{ padding: "var(--space-6)" }}>
          <SectionError message={error.message} />
        </div>
      ) : !attention ? (
        <div className="flex flex-col" style={{ gap: "var(--space-4)", padding: "var(--space-6)" }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height="var(--control-lg)" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={20} strokeWidth={1.75} />} title="Nothing is waiting on you">
          No failed emails, drafts or stalled leads right now.
        </EmptyState>
      ) : (
        <div>
          {queue.map((key) => {
            const signal = buildSignal(key, attention, names, now);
            const Icon = signal.icon;
            const count = attention[key].count;
            return (
              <div key={key} className="dash-attn__row" data-testid={`attention-${key}`}>
                <span className={`dash-attn__icon dash-attn__icon--${signal.tone}`} aria-hidden>
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div className="ffn-grow">
                  <div className="flex items-baseline flex-wrap" style={{ gap: "var(--space-2)" }}>
                    <span className="data" style={{ color: "var(--ink)" }}>
                      {formatCount(count)}
                    </span>
                    <h4 className="h4" style={{ margin: 0 }}>
                      {signal.title}
                    </h4>
                  </div>
                  <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 0" }}>
                    {signal.body}
                  </p>
                  {signal.chips.length > 0 && (
                    <ul className="dash-chips">
                      {signal.chips.slice(0, 5).map((chip) => (
                        <li key={chip.key} style={{ maxWidth: "100%" }}>
                          <Link href={chip.href} className="dash-chip">
                            <span className="label-sm ffn-truncate">{chip.name}</span>
                            {chip.meta && (
                              <span className="caption ffn-truncate" style={{ color: "var(--ink-subtle)" }}>
                                {chip.meta}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="sm:hidden" style={{ marginTop: "var(--space-3)" }}>
                    <LinkButton href={signal.action.href} size="sm">
                      {signal.action.label}
                    </LinkButton>
                  </div>
                </div>
                <div className="hidden sm:flex items-start" style={{ flex: "none" }}>
                  <LinkButton href={signal.action.href} size="sm">
                    {signal.action.label}
                  </LinkButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
