import { describe, expect, it } from "vitest";
import type { FormField } from "./formLogic";
import { activeFlags, computeSubmissionInsights, resolveIdentity } from "./insights";
import { utcToIST } from "./ist";
import {
  analyzeQuestions,
  distributions,
  EMPTY_SOURCE,
  summarize,
  type SubmissionEntry,
  type SubmissionRow,
} from "./submissionAnalysis";
import { buildSubmissionsCsv, buildSubmissionsWorkbook, exportFilename } from "./exportSubmissions";

function field(overrides: Partial<FormField> & Pick<FormField, "id" | "type">): FormField {
  return {
    label: overrides.id,
    placeholder: "",
    required: false,
    helpText: "",
    width: "full",
    validation: {},
    showIf: null,
    ...overrides,
  };
}

const fields: FormField[] = [
  field({ id: "name", type: "text", label: "Full name" }),
  field({ id: "email", type: "email", label: "Email" }),
  field({ id: "linkedin", type: "url", label: "LinkedIn profile" }),
  field({ id: "why", type: "textarea", label: "Why do you want to join?" }),
];

function entry(
  id: string,
  opts: {
    data: Record<string, unknown>;
    keys?: Record<string, number>;
    ms?: Record<string, number>;
    seconds?: number | null;
    rating?: number | null;
    status?: string | null;
    source?: Partial<SubmissionRow["source"]>;
    createdAt?: string;
  },
): SubmissionEntry {
  const row: SubmissionRow = {
    id,
    form_id: "11111111-1111-1111-1111-111111111111",
    session_id: `s-${id}`,
    data: opts.data,
    field_timings: Object.fromEntries(Object.entries(opts.ms ?? {}).map(([k, v]) => [k, { duration_ms: v }])),
    keystroke_counts: opts.keys ?? {},
    time_on_form_seconds: opts.seconds === undefined ? 120 : opts.seconds,
    partial: false,
    completed: true,
    status: opts.status ?? null,
    admin_notes: null,
    rating: opts.rating ?? null,
    confirmation_email_sent_at: null,
    created_at: opts.createdAt ?? "2026-09-20T20:00:00.000Z",
    updated_at: "2026-09-20T20:00:00.000Z",
    forms: { title: "Validation Lab", slug: "validation-lab" },
    source: { ...EMPTY_SOURCE, ...opts.source },
  };
  const insights = computeSubmissionInsights({
    fields,
    data: row.data,
    fieldTimings: row.field_timings as Record<string, { duration_ms?: number }>,
    keystrokeCounts: row.keystroke_counts,
    timeOnFormSeconds: row.time_on_form_seconds,
  });
  return { row, fields, identity: resolveIdentity(row.data, fields), insights, flags: activeFlags(insights) };
}

const prose = "I want to test my idea with real founders and learn what actually matters before I build. ".repeat(6);

const careful = entry("a", {
  data: { name: "Ananya Rao", email: "ananya@example.com", linkedin: "https://linkedin.com/in/ananya", why: prose },
  keys: { name: 10, email: 19, linkedin: 4, why: prose.length },
  ms: { name: 4000, email: 6000, linkedin: 3000, why: 90000 },
  seconds: 150,
  rating: 5,
  status: "shortlisted",
  source: { utm_source: "instagram", referrer: "https://instagram.com/" },
});

const pasted = entry("b", {
  data: { name: "Ravi", email: "ravi@example.com", why: prose },
  keys: { name: 4, email: 5, why: 3 },
  ms: { name: 1000, email: 1000, why: 2000 },
  seconds: 30,
  source: { referrer: "https://news.example.com/" },
  createdAt: "2026-09-21T02:00:00.000Z",
});

describe("identity", () => {
  it("resolves the LinkedIn profile from the label, or from any answer that is a LinkedIn URL", () => {
    expect(careful.identity.linkedin).toBe("https://linkedin.com/in/ananya");
    const anon = resolveIdentity({ x: "see https://www.linkedin.com/in/someone" }, []);
    expect(anon.linkedin).toContain("linkedin.com");
  });
});

describe("per-submission signals used by the review card", () => {
  it("scores a careful applicant higher than a pasted one, with the same bands as build-fellowship", () => {
    expect(careful.insights.effortScore.total).toBeGreaterThan(pasted.insights.effortScore.total);
    expect(careful.insights.effortBand).toBe("high");
    expect(pasted.insights.effortBand).not.toBe("high");
  });

  it("flags pasted and rushed prose and a form finished in under a minute", () => {
    expect(pasted.flags).toContain("pasted");
    expect(pasted.flags).toContain("rushed");
    expect(careful.flags).toEqual(expect.arrayContaining(["detailed", "complete"]));
    expect(careful.flags).not.toContain("pasted");
  });

  it("exposes totals for the metric tiles", () => {
    expect(careful.insights.totalWords).toBeGreaterThan(40);
    expect(careful.insights.typedRatio).toBeGreaterThan(0.8);
    expect(pasted.insights.typedRatio).toBeLessThan(0.2);
    expect(pasted.insights.pastedFields.length).toBeGreaterThan(0);
    expect(careful.insights.fields.find((f) => f.fieldId === "name")?.value).toBe("Ananya Rao");
  });

  it("does not treat a pasted profile URL as pasted writing", () => {
    const urlOnly = entry("c", {
      data: { name: "Mira", linkedin: "https://linkedin.com/in/mira-with-a-long-profile-slug-1234567" },
      keys: { name: 4, linkedin: 0 },
    });
    expect(urlOnly.flags).not.toContain("pasted");
  });
});

describe("summarize", () => {
  it("returns zeros for an empty set", () => {
    expect(summarize([])).toEqual({ total: 0, rated: 0, avgRating: null, avgScore: null, avgTime: null, highEffort: 0, flagged: 0 });
  });

  it("counts rated, high effort and flagged submissions", () => {
    const stats = summarize([careful, pasted]);
    expect(stats.total).toBe(2);
    expect(stats.rated).toBe(1);
    expect(stats.avgRating).toBe(5);
    expect(stats.highEffort).toBe(1);
    expect(stats.flagged).toBe(1);
    expect(stats.avgTime).toBe(90);
  });
});

describe("distributions", () => {
  it("buckets bands, ratings, time, source and IST day", () => {
    const d = distributions([careful, pasted]);
    expect(d.bands.find((b) => b.key === "high")?.count).toBe(1);
    expect(d.ratings.find((r) => r.key === "5")?.count).toBe(1);
    expect(d.ratings.find((r) => r.key === "unrated")?.count).toBe(1);
    expect(d.times.find((t) => t.key === "1to3")?.count).toBe(1);
    expect(d.times.find((t) => t.key === "under1")?.count).toBe(1);
    const labels = d.sources.map((s) => s.label);
    expect(labels).toEqual(expect.arrayContaining(["instagram", "referral"]));
    // 20:00 UTC and 02:00 UTC the next day are the same IST day (01:30 and 07:30 on 21 Sep).
    expect(d.days).toEqual([{ key: "2026-09-21", count: 2 }]);
  });

  it("falls back to direct when there is neither a UTM source nor a referrer", () => {
    const d = distributions([entry("d", { data: { name: "Dev" } })]);
    expect(d.sources).toEqual([{ key: "direct", label: "direct", count: 1 }]);
  });
});

describe("analyzeQuestions", () => {
  it("measures each question and gives it a verdict", () => {
    const { questions } = analyzeQuestions([careful, pasted]);
    const why = questions.find((q) => q.id === "why")!;
    expect(why.shown).toBe(2);
    expect(why.answered).toBe(2);
    expect(why.pasteRate).toBe(0.5);
    expect(why.avgSeconds).toBe(46);
    expect(["deep", "copied", "quick", "friction", "skipped"]).toContain(why.verdict);
    const linkedin = questions.find((q) => q.id === "linkedin")!;
    expect(linkedin.shown).toBe(2);
    expect(linkedin.answered).toBe(1);
    expect(linkedin.skipRate).toBe(0.5);
    expect(linkedin.verdict).toBe("skipped");
  });
});

describe("utcToIST", () => {
  it("shifts by +05:30 across midnight", () => {
    expect(utcToIST("2026-09-20T20:00:00.000Z")).toEqual({ date: "2026-09-21", time: "01:30" });
  });
});

describe("export", () => {
  const meta = { filters: [{ label: "Form", value: "All forms" }], stats: summarize([careful, pasted]) };

  it("writes a CSV with one row per submission and RFC 4180 quoting", () => {
    const withComma = entry("e", { data: { name: 'Sam "the man", Jr', email: "sam@example.com" } });
    const csv = buildSubmissionsCsv([careful, withComma]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Effort score");
    expect(lines[0]).toContain("Why do you want to join?");
    expect(lines[2]).toContain('"Sam ""the man"", Jr"');
    expect(lines[1]).toContain("Ananya Rao");
    expect(lines[1]).toContain("instagram");
  });

  it("builds a valid xlsx zip with four sheets", async () => {
    const blob = buildSubmissionsWorkbook([careful, pasted], meta);
    expect(blob.type).toContain("spreadsheetml.sheet");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // ZIP local file header signature, then the end-of-central-directory record.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(bytes);
    for (const name of ["Summary", "Submissions", "Question analysis", "Engagement"]) {
      expect(text).toContain(`<sheet name="${name}"`);
    }
    expect(text).toContain("Ananya Rao");
    expect(text).toContain("xl/worksheets/sheet4.xml");
  });

  it("names the file after the form and the IST date", () => {
    expect(exportFilename("Validation Lab!", "csv")).toMatch(/^submissions-validation-lab-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(exportFilename(null, "xlsx")).toMatch(/^submissions-all-forms-/);
  });
});
