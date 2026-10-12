"use client";

import {
  CircleDot,
  FileText,
  HelpCircle,
  Link2,
  LogIn,
  MessageSquareQuote,
  MousePointerClick,
  Package,
  PhoneCall,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ffn";
import { utcToIST } from "@/lib/forms/ist";
import { formatDuration, type Interest, type TimelineIcon, type TimelineVisit } from "@/lib/hubs/engagement";
import { sectionLabel } from "@/lib/hubs/types";

// The two views of a hub's engagement that build-fellowship shows on a hub:
// the summary with time by section, and the per-visit activity timeline. Shared
// by the hub detail page and the Hub activity dialog so they can never drift.

const TIMELINE_ICONS: Record<TimelineIcon, LucideIcon> = {
  open: LogIn,
  call: PhoneCall,
  link: Link2,
  cta: MousePointerClick,
  founders: UserRound,
  mentors: UserRound,
  case_studies: FileText,
  testimonials: MessageSquareQuote,
  programs: Package,
  faqs: HelpCircle,
  dot: CircleDot,
};

function visitWhen(iso: string): string {
  const { date, time } = utcToIST(iso);
  const today = utcToIST(new Date().toISOString()).date;
  const yesterday = utcToIST(new Date(Date.now() - 86_400_000).toISOString()).date;
  const day = date === today ? "Today" : date === yesterday ? "Yesterday" : date;
  return `${day}, ${time} IST`;
}

export function EngagementSummary({ interest }: { interest: Interest }) {
  const max = interest.sections[0]?.seconds || 1;
  return (
    <>
      <ul className="flex flex-col" style={{ margin: 0, paddingLeft: "var(--space-5)", gap: "var(--space-2)" }}>
        {interest.sentences.map((s, i) => (
          <li key={i} className="body">
            {s}
          </li>
        ))}
      </ul>
      {interest.sections.length > 0 && (
        <div className="flex flex-col" style={{ marginTop: "var(--space-5)", gap: "var(--space-2)" }}>
          <div className="eyebrow" style={{ color: "var(--ink-subtle)", textTransform: "uppercase" }}>
            Time by section
          </div>
          {interest.sections.slice(0, 6).map((s) => (
            <div key={s.section} className="flex items-center" style={{ gap: "var(--space-3)" }}>
              <span className="body-sm" style={{ width: "calc(var(--space-16) * 2)", flexShrink: 0 }}>
                {sectionLabel(s.section)}
              </span>
              <div className="subs-track">
                <span className="subs-fill" style={{ width: `${Math.round((s.seconds / max) * 100)}%` }} />
              </div>
              <span className="data-sm" style={{ color: "var(--ink-muted)", width: "var(--space-12)", textAlign: "right" }}>
                {formatDuration(s.seconds)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function VisitTimeline({ visits }: { visits: TimelineVisit[] }) {
  if (visits.length === 0) return <EmptyState title="No activity recorded yet" />;
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      {visits.map((visit) => (
        <div key={visit.sessionId}>
          <div className="flex items-baseline flex-wrap" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <span className="label">{visitWhen(visit.start)}</span>
            {visit.spanSeconds >= 5 && (
              <span className="data-sm" style={{ color: "var(--ink-muted)" }}>
                on the page for {formatDuration(Math.round(visit.spanSeconds))}
              </span>
            )}
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {visit.items.map((it, i) => {
              const Icon = TIMELINE_ICONS[it.icon] ?? CircleDot;
              const last = i === visit.items.length - 1;
              return (
                <li key={it.id} className="flex" style={{ gap: "var(--space-3)" }}>
                  <span className="flex flex-col items-center" style={{ flexShrink: 0 }} aria-hidden="true">
                    <span className="hub-tl__icon">
                      <Icon size={14} strokeWidth={1.75} />
                    </span>
                    {!last && <span className="hub-tl__line" />}
                  </span>
                  <div style={{ paddingBottom: last ? 0 : "var(--space-3)", minWidth: 0 }}>
                    <div className="body">{it.text}</div>
                    <div className="data-sm" style={{ color: "var(--ink-subtle)" }}>
                      {utcToIST(it.time).time}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
