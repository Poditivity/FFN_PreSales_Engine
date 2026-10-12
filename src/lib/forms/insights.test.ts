import { describe, expect, it } from "vitest";
import { computeSubmissionInsights } from "./insights";
import type { FormField } from "./formLogic";

// "narrative" is no longer an explicit field flag (the real source infers it
// from field type/content — see insights.ts): a textarea is always
// narrative, a "text" field only if its answer is long enough to be prose.
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

describe("computeSubmissionInsights — paste detection", () => {
  it("flags a field as pasted when content is long but keystrokes are far too few", () => {
    const longText = "a".repeat(80);
    const result = computeSubmissionInsights({
      fields: [field({ id: "bio", type: "textarea" })],
      data: { bio: longText },
      fieldTimings: { bio: { duration_ms: 20000 } },
      keystrokeCounts: { bio: 5 }, // 5 keys for 80 chars — clearly pasted
      timeOnFormSeconds: 30,
    });

    expect(result.fields[0].pasted).toBe(true);
    expect(result.flags.pasted).toBe(true);
  });

  it("does not flag a field as pasted when keystrokes roughly match content length", () => {
    const text = "a".repeat(80);
    const result = computeSubmissionInsights({
      fields: [field({ id: "bio", type: "textarea" })],
      data: { bio: text },
      fieldTimings: { bio: { duration_ms: 20000 } },
      keystrokeCounts: { bio: 80 }, // typed roughly 1:1
      timeOnFormSeconds: 30,
    });

    expect(result.fields[0].pasted).toBe(false);
  });

  it("does not flag short fields as pasted regardless of keystroke ratio", () => {
    const result = computeSubmissionInsights({
      fields: [field({ id: "name", type: "text" })],
      data: { name: "Jo" },
      fieldTimings: { name: { duration_ms: 500 } },
      keystrokeCounts: { name: 0 },
      timeOnFormSeconds: 10,
    });

    expect(result.fields[0].pasted).toBe(false);
  });

  it("does not flag non-typeable field types (e.g. select) as pasted", () => {
    const result = computeSubmissionInsights({
      fields: [field({ id: "plan", type: "select", options: ["a".repeat(50)] })],
      data: { plan: "a".repeat(50) },
      fieldTimings: { plan: { duration_ms: 1000 } },
      keystrokeCounts: { plan: 0 },
      timeOnFormSeconds: 10,
    });

    expect(result.fields[0].pasted).toBe(false);
  });
});

describe("computeSubmissionInsights — rush detection", () => {
  it("flags a narrative field answered with real content in under 5 seconds", () => {
    const result = computeSubmissionInsights({
      fields: [field({ id: "why", type: "textarea" })],
      data: { why: "b".repeat(60) },
      fieldTimings: { why: { duration_ms: 3000 } },
      keystrokeCounts: { why: 60 },
      timeOnFormSeconds: 10,
    });

    expect(result.fields[0].rushed).toBe(true);
    expect(result.flags.rushed).toBe(true);
  });

  it("does not flag non-narrative fields as rushed even if fast", () => {
    const result = computeSubmissionInsights({
      fields: [field({ id: "email", type: "email" })],
      data: { email: "person@example.com" },
      fieldTimings: { email: { duration_ms: 1000 } },
      keystrokeCounts: { email: 19 },
      timeOnFormSeconds: 5,
    });

    expect(result.fields[0].rushed).toBe(false);
  });
});

describe("computeSubmissionInsights — submission-level flags", () => {
  it("flags speedrun when under 60s with at least 6 fields", () => {
    const fields = Array.from({ length: 6 }, (_, i) => field({ id: `f${i}`, type: "text" }));
    const result = computeSubmissionInsights({
      fields,
      data: Object.fromEntries(fields.map((f) => [f.id, "ok"])),
      fieldTimings: {},
      keystrokeCounts: {},
      timeOnFormSeconds: 45,
    });

    expect(result.flags.speedrun).toBe(true);
  });

  it("does not flag speedrun with fewer than 6 fields even if fast", () => {
    const fields = [field({ id: "a", type: "text" }), field({ id: "b", type: "text" })];
    const result = computeSubmissionInsights({
      fields,
      data: { a: "ok", b: "ok" },
      fieldTimings: {},
      keystrokeCounts: {},
      timeOnFormSeconds: 10,
    });

    expect(result.flags.speedrun).toBe(false);
  });

  it("flags detailed when narrative words reach 100", () => {
    const words = Array.from({ length: 100 }, () => "word").join(" ");
    const result = computeSubmissionInsights({
      fields: [field({ id: "essay", type: "textarea" })],
      data: { essay: words },
      fieldTimings: { essay: { duration_ms: 60000 } },
      keystrokeCounts: { essay: words.length },
      timeOnFormSeconds: 60,
    });

    expect(result.flags.detailed).toBe(true);
    expect(result.narrativeWords).toBe(100);
  });

  it("flags complete only when every field is answered", () => {
    const fields = [field({ id: "a", type: "text" }), field({ id: "b", type: "text" })];
    const partial = computeSubmissionInsights({
      fields,
      data: { a: "ok" },
      fieldTimings: {},
      keystrokeCounts: {},
      timeOnFormSeconds: 5,
    });
    const complete = computeSubmissionInsights({
      fields,
      data: { a: "ok", b: "ok" },
      fieldTimings: {},
      keystrokeCounts: {},
      timeOnFormSeconds: 5,
    });

    expect(partial.flags.complete).toBe(false);
    expect(complete.flags.complete).toBe(true);
  });
});

describe("computeSubmissionInsights — effort score", () => {
  it("scores a thorough, deliberate, typed, complete submission highly", () => {
    const words = Array.from({ length: 120 }, () => "thoughtful").join(" ");
    const fields = [field({ id: "essay", type: "textarea" }), field({ id: "email", type: "email" })];
    const result = computeSubmissionInsights({
      fields,
      data: { essay: words, email: "person@example.com" },
      fieldTimings: {
        essay: { duration_ms: 90000 },
        email: { duration_ms: 5000 },
      },
      keystrokeCounts: { essay: words.length, email: 19 },
      timeOnFormSeconds: 95,
    });

    expect(result.effortScore.total).toBeGreaterThan(80);
    expect(result.effortScore.total).toBeLessThanOrEqual(100);
  });

  it("scores an empty submission with only the unconditional authenticity credit", () => {
    // Authenticity is neutral (15) whenever there isn't enough prose to
    // judge typed-vs-pasted, unconditionally — even on a wholly untouched
    // submission. That matches the real source's algorithm exactly (see
    // build-fellowship's submissionInsights.js): only depth, deliberation
    // and completeness fall to zero here.
    const fields = [field({ id: "a", type: "text" })];
    const result = computeSubmissionInsights({
      fields,
      data: {},
      fieldTimings: {},
      keystrokeCounts: {},
      timeOnFormSeconds: 0,
    });

    expect(result.effortScore.total).toBe(15);
    expect(result.effortScore.depth).toBe(0);
    expect(result.effortScore.deliberation).toBe(0);
    expect(result.effortScore.completeness).toBe(0);
  });

  it("gives the neutral authenticity credit when there isn't enough prose to judge", () => {
    const fields = [field({ id: "name", type: "text" })];
    const result = computeSubmissionInsights({
      fields,
      data: { name: "Jo" },
      fieldTimings: { name: { duration_ms: 1000 } },
      keystrokeCounts: { name: 2 },
      timeOnFormSeconds: 5,
    });

    expect(result.effortScore.authenticity).toBe(15);
  });

  it("gives low authenticity for a long pasted narrative answer", () => {
    const pasted = "x".repeat(200);
    const fields = [field({ id: "essay", type: "textarea" })];
    const result = computeSubmissionInsights({
      fields,
      data: { essay: pasted },
      fieldTimings: { essay: { duration_ms: 5000 } },
      keystrokeCounts: { essay: 2 }, // almost certainly pasted
      timeOnFormSeconds: 10,
    });

    expect(result.effortScore.authenticity).toBeLessThan(5);
  });
});
