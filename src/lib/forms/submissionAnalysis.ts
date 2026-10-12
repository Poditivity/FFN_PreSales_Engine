import type { FormField } from "./formLogic";
import {
  EFFORT_BAND_LABEL,
  type FlagKey,
  type SubmissionIdentity,
  type SubmissionInsights,
} from "./insights";
import { utcToIST } from "./ist";
import type { FormSubmissionRow } from "./schema";

// Ported from build-fellowship's app/src/lib/submissionInsights.js: the parts
// that work across a set of submissions rather than on one. Per-submission
// scoring stays in ./insights. Everything here is pure and derived, so the
// thresholds can change without a migration.

/** Where a submission came from, read from the analytics events of its session. */
export interface SubmissionSource {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  user_agent: string | null;
}

export const EMPTY_SOURCE: SubmissionSource = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  referrer: null,
  user_agent: null,
};

export interface SubmissionRow extends FormSubmissionRow {
  forms: { title: string; slug: string } | null;
  source: SubmissionSource;
}

export interface SubmissionEntry {
  row: SubmissionRow;
  fields: FormField[];
  identity: SubmissionIdentity;
  insights: SubmissionInsights;
  flags: FlagKey[];
}

/** Review states a submission moves through. These are not lead pipeline stages. */
export const SUBMISSION_STATUSES = ["new", "reviewed", "shortlisted", "rejected", "contacted"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// ---- Question-level analysis across a set -------------------------------

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

export type VerdictKey = "deep" | "friction" | "skipped" | "copied" | "quick";
export type SignalTone = "good" | "warn" | "neutral";

export const QUESTION_VERDICT: Record<VerdictKey, { label: string; tone: SignalTone; hint: string }> = {
  deep: {
    label: "Earns real answers",
    tone: "good",
    hint: "People spend time here and write something substantial. Keep it.",
  },
  friction: {
    label: "Friction point",
    tone: "warn",
    hint: "Takes the longest but gets little back, so people stall on it. Reword or simplify.",
  },
  skipped: {
    label: "Often skipped",
    tone: "warn",
    hint: "A large share leave it blank. Make it required, clearer, or drop it.",
  },
  copied: {
    label: "Mostly pasted",
    tone: "warn",
    hint: "Answers arrive faster than they could be typed. Largely copied in.",
  },
  quick: {
    label: "Answered easily",
    tone: "neutral",
    hint: "Fast and near-universally answered. Low friction, low signal.",
  },
};

export interface QuestionStat {
  id: string;
  label: string;
  type: string;
  formTitle: string;
  position: number;
  shown: number;
  answered: number;
  seconds: number[];
  words: number[];
  pasted: number;
  rushed: number;
  narrative: boolean;
  skipRate: number;
  avgSeconds: number;
  medianSeconds: number;
  avgWords: number;
  pasteRate: number;
  rushRate: number;
  timeShare: number;
  isSlow: boolean;
  verdict: VerdictKey;
}

/**
 * Per-question performance across a set of submissions: how long each question
 * held people, how many gave up on it, how much they wrote, and how often the
 * answer was pasted. Tells you which questions work and which cost you applicants.
 */
export function analyzeQuestions(entries: SubmissionEntry[]): { questions: QuestionStat[]; typicalSeconds: number } {
  const multiForm = new Set(entries.map((e) => e.row.form_id)).size > 1;
  type Draft = Omit<QuestionStat, "skipRate" | "avgSeconds" | "medianSeconds" | "avgWords" | "pasteRate" | "rushRate" | "timeShare" | "isSlow" | "verdict">;
  const drafts = new Map<string, Draft>();

  entries.forEach(({ row, insights }) => {
    insights.fields.forEach((stat, position) => {
      let q = drafts.get(stat.fieldId);
      if (!q) {
        q = {
          id: stat.fieldId,
          label: stat.label,
          type: stat.type,
          formTitle: multiForm ? row.forms?.title ?? "" : "",
          position,
          shown: 0,
          answered: 0,
          seconds: [],
          words: [],
          pasted: 0,
          rushed: 0,
          narrative: stat.narrative,
        };
        drafts.set(stat.fieldId, q);
      }
      q.shown += 1;
      if (stat.answered) {
        q.answered += 1;
        q.words.push(stat.words);
        if (stat.pasted) q.pasted += 1;
        if (stat.rushed) q.rushed += 1;
      }
      // A zero duration means the field was never focused, not "instant".
      if (stat.seconds > 0) q.seconds.push(stat.seconds);
      if (stat.narrative) q.narrative = true;
    });
  });

  const base = [...drafts.values()].map((q) => ({
    ...q,
    skipRate: q.shown ? 1 - q.answered / q.shown : 0,
    avgSeconds: Math.round(mean(q.seconds) * 10) / 10,
    medianSeconds: Math.round(median(q.seconds) * 10) / 10,
    avgWords: Math.round(mean(q.words) * 10) / 10,
    pasteRate: q.answered ? q.pasted / q.answered : 0,
    rushRate: q.answered ? q.rushed / q.answered : 0,
  }));

  // Thresholds are relative to this form's own questions: "slow" only means
  // something next to the other questions people just answered.
  const typicalSeconds = median(base.map((q) => q.avgSeconds).filter(Boolean)) || 1;
  const slowest = Math.max(...base.map((q) => q.avgSeconds), 1);

  const questions: QuestionStat[] = base.map((q) => {
    const isSlow = q.avgSeconds >= typicalSeconds * 1.8;
    let verdict: VerdictKey;
    if (q.skipRate >= 0.35) verdict = "skipped";
    else if (q.pasteRate >= 0.3) verdict = "copied";
    else if (q.narrative && isSlow && q.avgWords >= 20) verdict = "deep";
    else if (isSlow && (q.skipRate >= 0.15 || (q.narrative && q.avgWords < 12))) verdict = "friction";
    else if (q.narrative && q.avgWords >= 25) verdict = "deep";
    else verdict = "quick";
    return { ...q, timeShare: q.avgSeconds / slowest, isSlow, verdict };
  });

  return { questions, typicalSeconds };
}

// ---- Distributions -------------------------------------------------------

const TIME_BUCKETS = [
  { key: "under1", label: "Under 1 min", max: 60 },
  { key: "1to3", label: "1 to 3 min", max: 180 },
  { key: "3to10", label: "3 to 10 min", max: 600 },
  { key: "10to30", label: "10 to 30 min", max: 1800 },
  { key: "over30", label: "Over 30 min", max: Infinity },
];

export interface TallyItem {
  key: string;
  label: string;
  count: number;
}

function tally(counts: Map<string, number>, order?: { key: string; label: string }[]): TallyItem[] {
  if (order) return order.map((k) => ({ key: k.key, label: k.label, count: counts.get(k.key) ?? 0 }));
  return [...counts.entries()].map(([k, v]) => ({ key: k, label: k, count: v })).sort((a, b) => b.count - a.count);
}

const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);

/** How interested people are, how long they stayed, how they got here and when they applied. */
export function distributions(entries: SubmissionEntry[]) {
  const bands = new Map<string, number>();
  const ratings = new Map<string, number>();
  const times = new Map<string, number>();
  const sources = new Map<string, number>();
  const days = new Map<string, number>();

  entries.forEach(({ row, insights }) => {
    bump(bands, insights.effortBand);
    bump(ratings, row.rating ? String(row.rating) : "unrated");

    if (insights.timeOnForm !== null) {
      const bucket = TIME_BUCKETS.find((b) => insights.timeOnForm! < b.max) ?? TIME_BUCKETS[TIME_BUCKETS.length - 1];
      bump(times, bucket.key);
    }

    const source = (row.source.utm_source ?? "").trim() || (row.source.referrer ? "referral" : "direct");
    bump(sources, source);

    if (row.created_at) bump(days, utcToIST(row.created_at).date);
  });

  return {
    bands: tally(bands, [
      { key: "high", label: EFFORT_BAND_LABEL.high },
      { key: "medium", label: EFFORT_BAND_LABEL.medium },
      { key: "low", label: EFFORT_BAND_LABEL.low },
    ]),
    ratings: tally(ratings, [
      { key: "5", label: "5 stars" },
      { key: "4", label: "4 stars" },
      { key: "3", label: "3 stars" },
      { key: "2", label: "2 stars" },
      { key: "1", label: "1 star" },
      { key: "unrated", label: "Not rated" },
    ]),
    times: tally(times, TIME_BUCKETS),
    sources: tally(sources).slice(0, 8),
    days: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, count]) => ({ key, count })),
  };
}

// ---- Aggregates ----------------------------------------------------------

export interface SubmissionStats {
  total: number;
  rated: number;
  avgRating: number | null;
  avgScore: number | null;
  avgTime: number | null;
  highEffort: number;
  flagged: number;
}

export function summarize(entries: SubmissionEntry[]): SubmissionStats {
  const total = entries.length;
  if (!total) {
    return { total: 0, rated: 0, avgRating: null, avgScore: null, avgTime: null, highEffort: 0, flagged: 0 };
  }
  const rated = entries.filter((e) => e.row.rating);
  const withTime = entries.filter((e) => e.insights.timeOnForm !== null);
  const sum = (list: SubmissionEntry[], fn: (e: SubmissionEntry) => number) => list.reduce((n, e) => n + fn(e), 0);

  return {
    total,
    rated: rated.length,
    avgRating: rated.length ? Math.round((sum(rated, (e) => e.row.rating ?? 0) / rated.length) * 10) / 10 : null,
    avgScore: Math.round(sum(entries, (e) => e.insights.effortScore.total) / total),
    avgTime: withTime.length ? Math.round(sum(withTime, (e) => e.insights.timeOnForm ?? 0) / withTime.length) : null,
    highEffort: entries.filter((e) => e.insights.effortBand === "high").length,
    flagged: entries.filter((e) => e.insights.pastedFields.length || e.insights.rushedFields.length).length,
  };
}
