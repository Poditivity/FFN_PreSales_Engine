// What the daily and weekly digests, and the escalation alert, say. Pure
// TypeScript: each builder takes numbers and returns the subject, the Google
// Chat text and the email HTML, so Vitest can read exactly what the team will.
//
// Voice follows the FFN design system: short, declarative, sentence case, no
// contractions, no em dashes, no emoji. A change is always a word ("up 3",
// "down 2", "no change"), never only a colour or a symbol.

import { escapeHtml, shell } from "./emailShell.ts";

// Stage labels. These mirror STAGES in src/components/ffn/StageBadge.tsx, the one
// place the labels are defined; an edge function cannot import a React file, so
// digest.test.ts fails if the two ever differ.
export const DIGEST_STAGES = [
  { id: "mql", label: "MQL" },
  { id: "sql", label: "SQL" },
  { id: "customer", label: "Customer" },
  { id: "advocate", label: "Advocate" },
  { id: "nurture", label: "Nurture" },
  { id: "dormant", label: "Dormant" },
  { id: "lost", label: "Lost" },
] as const;

// Mirrors CALL_OUTCOMES in src/lib/leads/calls.ts (checked by digest.test.ts).
export const DIGEST_CALL_OUTCOMES = [
  { id: "connected", label: "Connected" },
  { id: "no_answer", label: "No answer" },
  { id: "voicemail", label: "Voicemail" },
  { id: "busy", label: "Busy" },
  { id: "call_back_later", label: "Call back later" },
  { id: "wrong_number", label: "Wrong number" },
] as const;

// Mirrors the signals on the dashboard's Attention panel (checked by digest.test.ts).
export const ATTENTION_ITEMS = [
  { id: "unreviewed", label: "Applications not yet reviewed" },
  { id: "no_hub", label: "Qualified leads with no hub" },
  { id: "draft_hubs", label: "Hubs not yet sent" },
  { id: "warm_hubs", label: "Hubs opened in the last two days" },
  { id: "stuck", label: "Leads with no movement for 14 days" },
  { id: "failed_emails", label: "Emails that did not send" },
] as const;

export interface DigestMetrics {
  leads: number;
  stages: Record<string, number>;
  hubsSent: number;
  hubsOpened: number;
  calls: Record<string, number>;
}

export type AttentionCounts = Record<(typeof ATTENTION_ITEMS)[number]["id"], number>;

const count = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const countMap = (value: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = count(v);
  }
  return out;
};

/** The jsonb digest_metrics returns, with every missing count read as zero. */
export function normalizeMetrics(raw: unknown): DigestMetrics {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    leads: count(r.leads),
    stages: countMap(r.stages),
    hubsSent: count(r.hubs_sent),
    hubsOpened: count(r.hubs_opened),
    calls: countMap(r.calls),
  };
}

export function normalizeAttention(raw: unknown): AttentionCounts {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(ATTENTION_ITEMS.map((item) => [item.id, count(r[item.id])])) as AttentionCounts;
}

export const totalCalls = (m: DigestMetrics): number => Object.values(m.calls).reduce((sum, n) => sum + n, 0);

/** Opened hubs as a share of sent hubs, 0 to 100. Null when none were sent. */
export function openRate(m: DigestMetrics): number | null {
  return m.hubsSent > 0 ? Math.round((m.hubsOpened / m.hubsSent) * 1000) / 10 : null;
}

// ---------------------------------------------------------------- comparison

export interface Row {
  label: string;
  /** What the digest shows for this period, already formatted. */
  value: string;
  /** What changed against the period before, as words. Empty when nothing to compare. */
  change: string;
  direction: "up" | "down" | "flat" | "none";
  /** Indented under the row above it. */
  sub?: boolean;
}

export interface Section {
  title: string;
  rows: Row[];
}

function countRow(label: string, current: number, previous: number | null, sub = false): Row {
  if (previous === null) return { label, value: String(current), change: "", direction: "none", sub };
  const delta = current - previous;
  if (delta === 0) return { label, value: String(current), change: `no change from ${previous}`, direction: "flat", sub };
  const word = delta > 0 ? "up" : "down";
  return {
    label,
    value: String(current),
    change: `${word} ${Math.abs(delta)} from ${previous}`,
    direction: delta > 0 ? "up" : "down",
    sub,
  };
}

function rateRow(label: string, current: number | null, previous: number | null): Row {
  const value = current === null ? "No hubs sent" : `${current}%`;
  if (current === null || previous === null) {
    return { label, value, change: previous === null && current !== null ? "no hubs sent the week before" : "", direction: "none" };
  }
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return { label, value, change: `no change from ${previous}%`, direction: "flat" };
  return {
    label,
    value,
    change: `${delta > 0 ? "up" : "down"} ${Math.abs(delta)} points from ${previous}%`,
    direction: delta > 0 ? "up" : "down",
  };
}

// ------------------------------------------------------------------ builders

export interface Digest {
  subject: string;
  chatText: string;
  html: string;
}

function chatSections(sections: Section[]): string {
  return sections
    .map((section) => {
      const lines = section.rows.map((row) => {
        const change = row.change ? ` (${row.change})` : "";
        return `${row.sub ? "      " : ""}• ${row.label}: ${row.value}${change}`;
      });
      return `*${section.title}*\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

function htmlSections(sections: Section[]): string {
  return sections
    .map(
      (section) => `
    <p style="margin:24px 0 8px;font-size:12px;color:#616978;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${escapeHtml(section.title)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${section.rows
        .map(
          (row) => `<tr>
        <td style="padding:8px 0 8px ${row.sub ? "16px" : "0"};border-bottom:1px solid #e3e6ec;font-size:14px;color:${row.sub ? "#616978" : "#0a0c12"};">${escapeHtml(row.label)}</td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #e3e6ec;font-size:14px;font-weight:600;color:#0a0c12;font-family:'IBM Plex Mono',Consolas,monospace;white-space:nowrap;">${escapeHtml(row.value)}</td>
        <td align="right" style="padding:8px 0 8px 16px;border-bottom:1px solid #e3e6ec;font-size:12px;color:#616978;white-space:nowrap;">${escapeHtml(row.change)}</td>
      </tr>`,
        )
        .join("")}
    </table>`,
    )
    .join("");
}

function dashboardLink(siteUrl: string): string {
  if (!siteUrl) return "";
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr><td style="background:#0a0c12;border-radius:10px;">
      <a href="${escapeHtml(siteUrl)}/admin" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open the dashboard</a>
    </td></tr></table>`;
}

function callSections(current: DigestMetrics, previous: DigestMetrics | null): Row[] {
  return [
    countRow("Calls made", totalCalls(current), previous ? totalCalls(previous) : null),
    ...DIGEST_CALL_OUTCOMES.map((o) => countRow(o.label, current.calls[o.id] ?? 0, previous ? (previous.calls[o.id] ?? 0) : null, true)),
  ];
}

export interface DailyInput {
  /** "Thu 1 Oct" */
  dateLabel: string;
  /** "19:00 IST" */
  untilLabel: string;
  metrics: DigestMetrics;
  siteUrl: string;
}

export function buildDailyDigest(input: DailyInput): Digest {
  const { metrics } = input;
  const sections: Section[] = [
    {
      title: "Today",
      rows: [countRow("Leads received", metrics.leads, null), countRow("Applicant hubs sent", metrics.hubsSent, null)],
    },
    { title: "Calls", rows: callSections(metrics, null) },
  ];
  const subject = `Daily summary: ${input.dateLabel}`;
  const intro = `Counted from midnight to ${input.untilLabel}.`;
  return {
    subject,
    chatText: `*${subject}*\n_${intro}_\n\n${chatSections(sections)}${input.siteUrl ? `\n\n${input.siteUrl}/admin` : ""}`,
    html: shell(`
    <p style="margin:0 0 4px;font-size:11px;color:#616978;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Daily summary</p>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:600;color:#0a0c12;line-height:1.25;">${escapeHtml(input.dateLabel)}</h1>
    <p style="margin:0;font-size:14px;color:#4e5566;line-height:1.6;">${escapeHtml(intro)}</p>
    ${htmlSections(sections)}
    ${dashboardLink(input.siteUrl)}`),
  };
}

export interface WeeklyInput {
  /** "Wed 23 Sep to Tue 29 Sep" */
  rangeLabel: string;
  current: DigestMetrics;
  previous: DigestMetrics;
  attention: AttentionCounts;
  /** Last week's Attention needed counts, when a weekly digest was sent before. */
  previousAttention: AttentionCounts | null;
  siteUrl: string;
}

export function buildWeeklyDigest(input: WeeklyInput): Digest {
  const { current, previous } = input;
  const sections: Section[] = [
    {
      title: "Leads",
      rows: [
        countRow("Leads received", current.leads, previous.leads),
        ...DIGEST_STAGES.map((s) => countRow(`Moved to ${s.label}`, current.stages[s.id] ?? 0, previous.stages[s.id] ?? 0)),
      ],
    },
    {
      title: "Applicant hubs",
      rows: [
        countRow("Applicant hubs sent", current.hubsSent, previous.hubsSent),
        rateRow("Hub open rate", openRate(current), openRate(previous)),
      ],
    },
    { title: "Calls", rows: callSections(current, previous) },
    {
      title: "Attention needed",
      rows: ATTENTION_ITEMS.map((item) =>
        countRow(item.label, input.attention[item.id], input.previousAttention ? input.previousAttention[item.id] : null),
      ),
    },
  ];
  const subject = `Weekly summary: ${input.rangeLabel}`;
  const intro = "Set against the seven days before. Attention needed counts are as they stand now.";
  return {
    subject,
    chatText: `*${subject}*\n_${intro}_\n\n${chatSections(sections)}${input.siteUrl ? `\n\n${input.siteUrl}/admin` : ""}`,
    html: shell(`
    <p style="margin:0 0 4px;font-size:11px;color:#616978;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Weekly summary</p>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:600;color:#0a0c12;line-height:1.25;">${escapeHtml(input.rangeLabel)}</h1>
    <p style="margin:0;font-size:14px;color:#4e5566;line-height:1.6;">${escapeHtml(intro)}</p>
    ${htmlSections(sections)}
    ${dashboardLink(input.siteUrl)}`),
  };
}

// ---------------------------------------------------------------- escalation

export interface EscalatedLead {
  name: string;
  email: string;
  program: string;
  stage: string;
  /** Minutes since the lead arrived. */
  waitedMinutes: number;
  /** Link to the lead in the admin, or empty when SITE_URL is not set. */
  url: string;
}

/** 30 -> "30 minutes", 120 -> "2 hours", 2880 -> "2 days", 90 -> "90 minutes". */
export function formatDuration(minutes: number): string {
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (minutes >= 1440 && minutes % 1440 === 0) return unit(minutes / 1440, "day");
  if (minutes >= 60 && minutes % 60 === 0) return unit(minutes / 60, "hour");
  if (minutes >= 120) return unit(Math.round(minutes / 60), "hour");
  return unit(Math.max(Math.round(minutes), 1), "minute");
}

const stageLabel = (id: string) => DIGEST_STAGES.find((s) => s.id === id)?.label ?? (id === "lead" ? "Lead" : id);

export function buildEscalation(input: { delayMinutes: number; leads: EscalatedLead[] }): Digest {
  const n = input.leads.length;
  const delay = formatDuration(input.delayMinutes);
  const subject =
    n === 1
      ? `1 lead has waited over ${delay} without a hub`
      : `${n} leads have waited over ${delay} without a hub`;
  const lead = (l: EscalatedLead) => l.name || l.email || "Unnamed lead";

  const chatLines = input.leads.map((l) => {
    const detail = [stageLabel(l.stage), l.program, `waiting ${formatDuration(l.waitedMinutes)}`].filter(Boolean).join(", ");
    return `• ${lead(l)} (${detail})${l.url ? `\n      ${l.url}` : ""}`;
  });

  const rows = input.leads
    .map((l) => {
      const detail = [stageLabel(l.stage), l.program].filter(Boolean).join(" · ");
      const name = l.url
        ? `<a href="${escapeHtml(l.url)}" style="color:#233ce6;text-decoration:none;font-weight:600;">${escapeHtml(lead(l))}</a>`
        : `<strong>${escapeHtml(lead(l))}</strong>`;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e3e6ec;font-size:14px;color:#0a0c12;">${name}<br><span style="font-size:12px;color:#616978;">${escapeHtml(detail)}${l.email ? ` · ${escapeHtml(l.email)}` : ""}</span></td>
        <td align="right" style="padding:10px 0 10px 16px;border-bottom:1px solid #e3e6ec;font-size:12px;color:#616978;white-space:nowrap;">waiting ${escapeHtml(formatDuration(l.waitedMinutes))}</td>
      </tr>`;
    })
    .join("");

  return {
    subject,
    chatText: `*${subject}*\nSend each one a personalised hub, or move them on.\n\n${chatLines.join("\n")}`,
    html: shell(`
    <p style="margin:0 0 4px;font-size:11px;color:#616978;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Needs attention</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0a0c12;line-height:1.3;">${escapeHtml(subject)}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#4e5566;line-height:1.6;">Send each one a personalised hub, or move them on.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`),
  };
}
