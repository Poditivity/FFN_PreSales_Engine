import { describe, expect, it } from "vitest";
import {
  attentionQueue,
  bucketLabel,
  buildSummary,
  compareCounts,
  compareRates,
  dashboardHref,
  firstName,
  formatDays,
  formatPercent,
  formHealthFlag,
  parsePeriod,
  parseTab,
  periodRange,
  relativeTime,
  sectionLabel,
} from "./metrics";
import type { DashboardAttention, FormHealth, Kpis } from "./types";

const kpis: Kpis = {
  applications: 14,
  form_starts: 20,
  form_completes: 14,
  hubs_sent: 5,
  hubs_opened: 3,
  new_customers: 2,
  stage_moves: 9,
};

const signal = (count: number) => ({ count, items: [] });
const emptyAttention: DashboardAttention = {
  unreviewed: signal(0),
  no_hub: signal(0),
  draft_hubs: signal(0),
  warm_hubs: signal(0),
  stuck: signal(0),
  failed_emails: signal(0),
};

describe("periods", () => {
  it("falls back to 30 days for anything unknown", () => {
    expect(parsePeriod("7d")).toBe("7d");
    expect(parsePeriod("all")).toBe("all");
    expect(parsePeriod("365d")).toBe("30d");
    expect(parsePeriod(undefined)).toBe("30d");
  });

  it("opens all time at the start of the data, not at a guessed date", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(periodRange("7d", now).from?.toISOString()).toBe("2026-09-22T12:00:00.000Z");
    expect(periodRange("all", now).from).toBeNull();
  });
});

describe("tabs", () => {
  it("opens on the dashboard tab unless a known tab is asked for", () => {
    expect(parseTab("attention")).toBe("attention");
    expect(parseTab("activity")).toBe("activity");
    expect(parseTab("settings")).toBe("overview");
    expect(parseTab(undefined)).toBe("overview");
  });

  it("keeps only non-default choices in the URL", () => {
    expect(dashboardHref("30d", "overview")).toBe("/admin");
    expect(dashboardHref("7d", "overview")).toBe("/admin?period=7d");
    expect(dashboardHref("30d", "attention")).toBe("/admin?tab=attention");
    expect(dashboardHref("all", "activity")).toBe("/admin?tab=activity&period=all");
  });
});

describe("comparisons", () => {
  it("compares counts against the previous period", () => {
    expect(compareCounts(12, 10)).toEqual({ direction: "up", text: "20%" });
    expect(compareCounts(5, 10)).toEqual({ direction: "down", text: "50%" });
    expect(compareCounts(4, 4)).toEqual({ direction: "flat", text: "0%" });
  });

  it("does not invent a percentage when the previous period was zero", () => {
    expect(compareCounts(3, 0)).toEqual({ direction: "up", text: "New" });
    expect(compareCounts(0, 0)).toEqual({ direction: "flat", text: "0%" });
  });

  it("hides the delta when there is nothing to compare against", () => {
    expect(compareCounts(3, null)).toEqual({ direction: "flat", text: null });
    expect(compareRates(0.5, null)).toEqual({ direction: "flat", text: null });
    expect(compareRates(null, 0.5)).toEqual({ direction: "flat", text: null });
  });

  it("compares rates in percentage points", () => {
    expect(compareRates(0.5, 0.4)).toEqual({ direction: "up", text: "10 pts" });
    expect(compareRates(0.3, 0.45)).toEqual({ direction: "down", text: "15 pts" });
  });
});

describe("formatting", () => {
  it("formats percentages and days", () => {
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.034)).toBe("3.4%");
    expect(formatPercent(null)).toBe("—");
    expect(formatDays(0.2)).toBe("Under a day");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(3.46)).toBe("3.5 days");
  });

  it("says how long ago something happened", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(relativeTime("2026-09-29T11:59:30Z", now)).toBe("Just now");
    expect(relativeTime("2026-09-29T11:15:00Z", now)).toBe("45 min ago");
    expect(relativeTime("2026-09-29T07:00:00Z", now)).toBe("5 h ago");
    expect(relativeTime("2026-09-27T12:00:00Z", now)).toBe("2 days ago");
    expect(relativeTime("2026-09-01T12:00:00Z", now)).toBe("1 Sep");
  });

  it("labels trend buckets as calendar dates", () => {
    expect(bucketLabel("2026-09-14", "day")).toBe("14 Sep");
    expect(bucketLabel("2026-09-14", "week")).toBe("Week of 14 Sep");
  });

  it("uses the stored name, else the email", () => {
    expect(firstName("Ananya Rao", "a@x.co")).toBe("Ananya");
    expect(firstName(null, "ravi.kumar@ffn.network")).toBe("Ravi");
    expect(firstName("", "")).toBe("");
  });

  it("labels hub sections from the block list", () => {
    expect(sectionLabel("case_studies")).toBe("Case studies");
    expect(sectionLabel("mystery_block")).toBe("Mystery block");
  });
});

describe("attention", () => {
  it("orders the signals that have work, most urgent first", () => {
    const attention = { ...emptyAttention, unreviewed: signal(40), warm_hubs: signal(2), failed_emails: signal(1) };
    expect(attentionQueue(attention)).toEqual(["failed_emails", "warm_hubs", "unreviewed"]);
    expect(attentionQueue(emptyAttention)).toEqual([]);
    expect(attentionQueue(undefined)).toEqual([]);
  });
});

describe("summary", () => {
  it("leads with applications, then people reading, then the top signal", () => {
    const summary = buildSummary({
      kpis,
      period: "7d",
      attention: { ...emptyAttention, warm_hubs: signal(2), no_hub: signal(5) },
      liveCount: 1,
    });
    expect(summary).toBe(
      "14 new applications in the last 7 days. 1 person is reading a hub right now. 2 hubs were opened in the last two days.",
    );
  });

  it("puts a failed email ahead of every other signal", () => {
    const summary = buildSummary({
      kpis: { ...kpis, applications: 1 },
      period: "all",
      attention: { ...emptyAttention, failed_emails: signal(1), warm_hubs: signal(3) },
      liveCount: 0,
    });
    expect(summary).toBe("1 new application since the first application. 1 email failed to send.");
  });

  it("says plainly when nothing came in", () => {
    expect(buildSummary({ kpis: { ...kpis, applications: 0 }, period: "30d", attention: emptyAttention, liveCount: 0 })).toBe(
      "No new applications in the last 30 days.",
    );
  });

  it("never uses contractions or em dashes", () => {
    const summary = buildSummary({
      kpis,
      period: "7d",
      attention: { ...emptyAttention, no_hub: signal(3) },
      liveCount: 4,
    });
    expect(summary).not.toMatch(/—|n't|'s |'re /);
  });
});

describe("form health", () => {
  const form = (starts: number, completes: number): FormHealth => ({
    id: "f",
    title: "Apply",
    slug: "apply",
    status: "active",
    starts,
    completes,
    drops: starts - completes,
    applications: completes,
    median_seconds: 60,
    top_drop_field: null,
  });

  it("flags low completion only once there is enough traffic to judge", () => {
    expect(formHealthFlag(form(5, 1))).toBeNull();
    expect(formHealthFlag(form(20, 18))).toBeNull();
    expect(formHealthFlag(form(20, 10))).toEqual({ tone: "warning", text: "High drop-off" });
    expect(formHealthFlag(form(20, 4))).toEqual({ tone: "danger", text: "Most people leave" });
  });
});
