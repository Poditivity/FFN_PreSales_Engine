// Pure helpers behind the /admin dashboard: period windows, comparisons,
// number formatting and the plain-language summary. No I/O here, so every
// rule the dashboard shows is covered by metrics.test.ts.

import { BLOCK_LABELS } from "@/lib/hubs/types";
import type { AttentionKey, DashboardAttention, FormHealth, Kpis, PeriodId } from "./types";

export const PERIODS: { id: PeriodId; label: string; days: number | null }[] = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

export const DEFAULT_PERIOD: PeriodId = "30d";

export function parsePeriod(raw: unknown): PeriodId {
  return PERIODS.some((p) => p.id === raw) ? (raw as PeriodId) : DEFAULT_PERIOD;
}

export type DashboardTab = "overview" | "attention" | "activity";
export const DASHBOARD_TABS: DashboardTab[] = ["overview", "attention", "activity"];

export function parseTab(raw: unknown): DashboardTab {
  return DASHBOARD_TABS.includes(raw as DashboardTab) ? (raw as DashboardTab) : "overview";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The forms chosen in the filter, from a comma separated query value. Anything that is not a form id is dropped. */
export function parseForms(raw: unknown): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : typeof raw === "string" ? raw : "";
  return [...new Set(text.split(",").map((s) => s.trim().toLowerCase()).filter((s) => UUID.test(s)))];
}

/** /admin with only the non-default choices in the query string, so links stay short and shareable. */
export function dashboardHref(period: PeriodId, tab: DashboardTab, forms: string[] = []): string {
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  if (period !== DEFAULT_PERIOD) params.set("period", period);
  if (forms.length > 0) params.set("forms", forms.join(","));
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

export function periodLabel(id: PeriodId): string {
  return PERIODS.find((p) => p.id === id)?.label ?? "";
}

/** "in the last 30 days", or "since the first application" for all time. */
export function periodPhrase(id: PeriodId): string {
  const period = PERIODS.find((p) => p.id === id);
  return period?.days ? `in the last ${period.days} days` : "since the first application";
}

/** `from` is null for all time: the database starts at the first event. */
export function periodRange(id: PeriodId, now: Date): { from: Date | null; to: Date } {
  const days = PERIODS.find((p) => p.id === id)?.days ?? null;
  return { from: days === null ? null : new Date(now.getTime() - days * 86_400_000), to: now };
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export type Direction = "up" | "down" | "flat";

export interface Comparison {
  direction: Direction;
  /** Printed beside the arrow, e.g. "24%", "3 pts" or "New". Null hides the delta. */
  text: string | null;
}

/** Change in a count against the previous period of the same length. */
export function compareCounts(current: number, previous: number | null | undefined): Comparison {
  if (previous === null || previous === undefined) return { direction: "flat", text: null };
  if (current === previous) return { direction: "flat", text: "0%" };
  if (previous === 0) return { direction: "up", text: "New" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { direction: current > previous ? "up" : "down", text: `${Math.abs(pct)}%` };
}

/** Change in a rate, in percentage points, so 40% to 50% reads "10 pts", not "25%". */
export function compareRates(current: number | null, previous: number | null | undefined): Comparison {
  if (current === null || previous === null || previous === undefined) return { direction: "flat", text: null };
  const pts = Math.round((current - previous) * 100);
  if (pts === 0) return { direction: "flat", text: "0 pts" };
  return { direction: pts > 0 ? "up" : "down", text: `${Math.abs(pts)} pts` };
}

export function formatCount(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toLocaleString("en");
}

export function formatPercent(r: number | null | undefined): string {
  if (r === null || r === undefined) return "—";
  const pct = r * 100;
  return `${pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%`;
}

export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days < 1) return "Under a day";
  const rounded = Math.round(days * 10) / 10;
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

// Fixed month names: browsers disagree on "Sep" and "Sept" for en-GB.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Sep" from a Date, read in UTC or in the viewer's own zone. */
export function shortDate(date: Date, utc = false): string {
  return utc ? `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}` : `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function relativeTime(iso: string, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return shortDate(new Date(iso));
}

export function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

/** Trend buckets arrive as local calendar dates ("2026-09-14"). */
export function bucketLabel(bucket: string, kind: "day" | "week"): string {
  const [y, m, d] = bucket.split("-").map(Number);
  const text = shortDate(new Date(Date.UTC(y, m - 1, d)), true);
  return kind === "week" ? `Week of ${text}` : text;
}

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(fullName: string | null | undefined, email: string): string {
  const name = (fullName ?? "").trim();
  if (name) return name.split(/\s+/)[0];
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()).split(" ")[0] : "";
}

export function sectionLabel(section: string): string {
  return (BLOCK_LABELS as Record<string, string>)[section] ?? section.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// Highest first: a failed email means someone is waiting on a reply that
// never arrived; a warm hub cools within days; the rest are backlog.
export const ATTENTION_PRIORITY: AttentionKey[] = [
  "failed_emails",
  "warm_hubs",
  "no_hub",
  "draft_hubs",
  "stuck",
  "unreviewed",
];

export function attentionQueue(attention: DashboardAttention | null | undefined): AttentionKey[] {
  if (!attention) return [];
  return ATTENTION_PRIORITY.filter((key) => (attention[key]?.count ?? 0) > 0);
}

export function attentionTotal(attention: DashboardAttention | null | undefined): number {
  return attentionQueue(attention).length;
}

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/**
 * Up to three short sentences for the header, most useful first. Plain
 * logic on the numbers already on screen, in the FFN voice.
 */
export function buildSummary(input: {
  kpis: Kpis | null | undefined;
  period: PeriodId;
  attention: DashboardAttention | null | undefined;
  liveCount: number;
}): string {
  const sentences: string[] = [];
  const { kpis, period, attention, liveCount } = input;

  if (kpis) {
    sentences.push(
      kpis.applications === 0
        ? `No new applications ${periodPhrase(period)}.`
        : `${plural(kpis.applications, "new application", "new applications")} ${periodPhrase(period)}.`,
    );
  }
  if (liveCount > 0) {
    sentences.push(`${plural(liveCount, "person is", "people are")} reading a hub right now.`);
  }
  if (attention) {
    if (attention.failed_emails.count > 0) {
      sentences.push(`${plural(attention.failed_emails.count, "email", "emails")} failed to send.`);
    } else if (attention.warm_hubs.count > 0) {
      sentences.push(`${plural(attention.warm_hubs.count, "hub was", "hubs were")} opened in the last two days.`);
    } else if (attention.no_hub.count > 0) {
      sentences.push(`${plural(attention.no_hub.count, "qualified lead has", "qualified leads have")} no hub yet.`);
    }
  }
  return sentences.slice(0, 3).join(" ");
}

export interface FormFlag {
  tone: "warning" | "danger";
  text: string;
}

/** A completion rate below 60% over at least 10 starts is worth a look. */
export function formHealthFlag(form: FormHealth): FormFlag | null {
  if (form.starts < 10) return null;
  const rate = ratio(form.completes, form.starts) ?? 1;
  if (rate < 0.4) return { tone: "danger", text: "Most people leave" };
  if (rate < 0.6) return { tone: "warning", text: "High drop-off" };
  return null;
}
