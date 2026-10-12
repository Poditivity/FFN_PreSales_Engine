// @vitest-environment node
import { describe, expect, it } from "vitest";
import { STAGES } from "../../../src/components/ffn/StageBadge";
import { CALL_OUTCOMES } from "../../../src/lib/leads/calls";
import {
  ATTENTION_ITEMS,
  buildDailyDigest,
  buildEscalation,
  buildWeeklyDigest,
  DIGEST_CALL_OUTCOMES,
  DIGEST_STAGES,
  formatDuration,
  normalizeAttention,
  normalizeMetrics,
  openRate,
  totalCalls,
} from "./digest";

const metrics = (over: Partial<ReturnType<typeof normalizeMetrics>> = {}) => ({ ...normalizeMetrics({}), ...over });

describe("labels stay in step with the app", () => {
  it("uses the stage labels the app defines", () => {
    for (const s of DIGEST_STAGES) expect(s.label).toBe(STAGES.find((x) => x.id === s.id)?.label);
    // Every exit and path stage after lead has a row in the weekly digest.
    expect(DIGEST_STAGES.map((s) => s.id)).toEqual(STAGES.filter((s) => s.id !== "lead").map((s) => s.id));
  });

  it("uses the call outcomes and labels the app defines", () => {
    expect(DIGEST_CALL_OUTCOMES.map((o) => [o.id, o.label])).toEqual(CALL_OUTCOMES.map((o) => [o.id, o.label]));
  });
});

describe("normalizeMetrics", () => {
  it("reads missing and odd values as zero", () => {
    expect(normalizeMetrics(null)).toEqual({ leads: 0, stages: {}, hubsSent: 0, hubsOpened: 0, calls: {} });
    expect(normalizeMetrics({ leads: "4", hubs_sent: -2, stages: { mql: 3, sql: "x" }, calls: { connected: 2 } })).toEqual({
      leads: 4,
      stages: { mql: 3, sql: 0 },
      hubsSent: 0,
      hubsOpened: 0,
      calls: { connected: 2 },
    });
  });

  it("totals calls and works out the hub open rate", () => {
    expect(totalCalls(metrics({ calls: { connected: 2, busy: 1 } }))).toBe(3);
    expect(openRate(metrics({ hubsSent: 8, hubsOpened: 3 }))).toBe(37.5);
    expect(openRate(metrics())).toBeNull();
  });

  it("reads every attention count, zero when absent", () => {
    const a = normalizeAttention({ no_hub: 3 });
    expect(a.no_hub).toBe(3);
    expect(Object.keys(a)).toEqual(ATTENTION_ITEMS.map((i) => i.id));
    expect(a.stuck).toBe(0);
  });
});

describe("daily digest", () => {
  const digest = buildDailyDigest({
    dateLabel: "Thu 1 Oct",
    untilLabel: "19:00 IST",
    metrics: metrics({ leads: 5, hubsSent: 3, calls: { connected: 4, no_answer: 2, voicemail: 1 } }),
    siteUrl: "https://app.example.com",
  });

  it("names the day and the cut-off", () => {
    expect(digest.subject).toBe("Daily summary: Thu 1 Oct");
    expect(digest.chatText).toContain("Counted from midnight to 19:00 IST.");
  });

  it("reports leads, hubs sent, total calls and each outcome", () => {
    expect(digest.chatText).toContain("• Leads received: 5");
    expect(digest.chatText).toContain("• Applicant hubs sent: 3");
    expect(digest.chatText).toContain("• Calls made: 7");
    for (const [label, n] of [["Connected", 4], ["No answer", 2], ["Voicemail", 1], ["Busy", 0], ["Call back later", 0], ["Wrong number", 0]] as const) {
      expect(digest.chatText).toContain(`• ${label}: ${n}`);
    }
  });

  it("links to the dashboard, in chat and in the email", () => {
    expect(digest.chatText).toContain("https://app.example.com/admin");
    expect(digest.html).toContain('href="https://app.example.com/admin"');
    expect(digest.html).toContain("Daily summary");
  });

  it("leaves the link out when the site address is not set", () => {
    const bare = buildDailyDigest({ dateLabel: "Thu 1 Oct", untilLabel: "19:00 IST", metrics: metrics(), siteUrl: "" });
    expect(bare.chatText).not.toContain("/admin");
    expect(bare.html).not.toContain("Open the dashboard");
  });
});

describe("weekly digest", () => {
  const current = metrics({
    leads: 12,
    stages: { mql: 5, sql: 2, customer: 1 },
    hubsSent: 8,
    hubsOpened: 4,
    calls: { connected: 6, no_answer: 3 },
  });
  const previous = metrics({
    leads: 8,
    stages: { mql: 5, sql: 3, lost: 1 },
    hubsSent: 8,
    hubsOpened: 6,
    calls: { connected: 6 },
  });
  const attention = normalizeAttention({ unreviewed: 4, no_hub: 2, stuck: 1 });
  const lastAttention = normalizeAttention({ unreviewed: 6, no_hub: 2 });
  const digest = buildWeeklyDigest({ rangeLabel: "Mon 21 Sep to Sun 27 Sep", current, previous, attention, previousAttention: lastAttention, siteUrl: "" });

  it("covers every metric the team asked for", () => {
    expect(digest.subject).toBe("Weekly summary: Mon 21 Sep to Sun 27 Sep");
    for (const label of [
      "Leads received",
      "Moved to MQL",
      "Moved to SQL",
      "Moved to Customer",
      "Moved to Advocate",
      "Moved to Dormant",
      "Moved to Lost",
      "Applicant hubs sent",
      "Hub open rate",
      "Calls made",
      "Connected",
      "No answer",
      "Voicemail",
      "Busy",
      "Call back later",
      "Wrong number",
      "Applications not yet reviewed",
      "Qualified leads with no hub",
    ]) {
      expect(digest.chatText).toContain(label);
      expect(digest.html).toContain(label);
    }
  });

  it("says in words whether each figure went up, down or stayed", () => {
    expect(digest.chatText).toContain("• Leads received: 12 (up 4 from 8)");
    expect(digest.chatText).toContain("• Moved to SQL: 2 (down 1 from 3)");
    expect(digest.chatText).toContain("• Moved to MQL: 5 (no change from 5)");
    expect(digest.chatText).toContain("• Moved to Customer: 1 (up 1 from 0)");
    expect(digest.chatText).toContain("• Calls made: 9 (up 3 from 6)");
  });

  it("compares the hub open rate in points", () => {
    expect(digest.chatText).toContain("• Hub open rate: 50% (down 25 points from 75%)");
  });

  it("compares Attention needed with the last weekly digest", () => {
    expect(digest.chatText).toContain("• Applications not yet reviewed: 4 (down 2 from 6)");
    expect(digest.chatText).toContain("• Leads with no movement for 14 days: 1 (up 1 from 0)");
  });

  it("shows plain counts on the first weekly digest, with nothing to compare", () => {
    const first = buildWeeklyDigest({ rangeLabel: "x", current, previous, attention, previousAttention: null, siteUrl: "" });
    expect(first.chatText).toContain("• Applications not yet reviewed: 4\n");
  });

  it("says so when no hubs were sent", () => {
    const none = buildWeeklyDigest({ rangeLabel: "x", current: metrics(), previous: metrics(), attention, previousAttention: null, siteUrl: "" });
    expect(none.chatText).toContain("• Hub open rate: No hubs sent");
  });

  it("follows the FFN voice: no em dashes, no contractions, no emoji", () => {
    const all = [digest.chatText, digest.html].join("\n");
    expect(all).not.toContain("—");
    expect(all).not.toMatch(/\b(don't|can't|won't|it's|isn't|you're|didn't)\b/i);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("escalation", () => {
  const leads = [
    { name: "Ananya Rao", email: "ananya@example.com", program: "Validation Lab", stage: "mql", waitedMinutes: 300, url: "https://app.example.com/admin/leads/1" },
    { name: "", email: "x@y.co", program: "Startup Lab", stage: "lead", waitedMinutes: 125, url: "" },
  ];

  it("counts the leads and names the delay", () => {
    const one = buildEscalation({ delayMinutes: 240, leads: leads.slice(0, 1) });
    expect(one.subject).toBe("1 lead has waited over 4 hours without a hub");
    const two = buildEscalation({ delayMinutes: 240, leads });
    expect(two.subject).toBe("2 leads have waited over 4 hours without a hub");
  });

  it("lists each lead with stage, program, wait and link, falling back to the email", () => {
    const { chatText, html } = buildEscalation({ delayMinutes: 240, leads });
    expect(chatText).toContain("• Ananya Rao (MQL, Validation Lab, waiting 5 hours)");
    expect(chatText).toContain("https://app.example.com/admin/leads/1");
    expect(chatText).toContain("• x@y.co (Lead, Startup Lab, waiting 2 hours)");
    expect(html).toContain('href="https://app.example.com/admin/leads/1"');
  });

  it("escapes what applicants typed", () => {
    const { html } = buildEscalation({
      delayMinutes: 60,
      leads: [{ name: "<script>alert(1)</script>", email: "", program: "", stage: "lead", waitedMinutes: 60, url: "" }],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("writes durations in the largest even unit", () => {
    expect(formatDuration(30)).toBe("30 minutes");
    expect(formatDuration(1)).toBe("1 minute");
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(120)).toBe("2 hours");
    expect(formatDuration(90)).toBe("90 minutes");
    expect(formatDuration(150)).toBe("3 hours");
    expect(formatDuration(1440)).toBe("1 day");
    expect(formatDuration(2880)).toBe("2 days");
  });
});
