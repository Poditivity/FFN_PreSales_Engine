// Export the submissions currently on screen (the filtered set, in the order
// the reviewer is looking at) as a real .xlsx workbook or a flat CSV.
// Ported from build-fellowship's app/src/lib/exportSubmissions.js.
//
// The workbook has four sheets:
//   Summary            what was exported, and how the set breaks down
//   Submissions        one row per applicant: identity, review state, signal, answers
//   Question analysis  one row per question: time, skips, words, paste rate
//   Engagement         one row per answer: time spent, keystrokes, paste detection
//
// Callers pass the same entries the list renders, so the export can never
// drift from what the filters are showing.

import { EFFORT_BAND_LABEL, FLAG_LABEL, formatAnswer } from "./insights";
import { isAnswerKey } from "./consent";
import { utcToIST } from "./ist";
import {
  analyzeQuestions,
  QUESTION_VERDICT,
  type SubmissionEntry,
  type SubmissionStats,
} from "./submissionAnalysis";
import { buildXlsx, downloadBlob, STYLE, type XlsxCell, type XlsxColumn, type XlsxRow, type XlsxSheet } from "./xlsx";

export { downloadBlob };

const submittedIST = (iso: string | null | undefined) => {
  if (!iso) return "";
  const { date, time } = utcToIST(iso);
  return `${date} ${time}`;
};

const flagText = (entry: SubmissionEntry) => entry.flags.map((f) => FLAG_LABEL[f]).join(", ");

// A percentage as a 0 to 1 fraction so Excel's percent format renders it.
const pct = (value: number | null | undefined): XlsxCell =>
  value === null || value === undefined ? "" : { v: value, style: STYLE.PERCENT };

const num = (value: number | null | undefined): XlsxCell =>
  value === null || value === undefined ? "" : { v: value, style: STYLE.NUMBER };

interface QuestionColumn {
  id: string;
  header: string;
  type: string;
}

/**
 * Question columns for the export: every form present, in flow order, with the
 * form name prefixed only when the export spans more than one form, so a
 * single-form export reads as clean question headers.
 */
function questionColumns(entries: SubmissionEntry[]): QuestionColumn[] {
  const forms: { id: string; title: string }[] = [];
  const seenForms = new Set<string>();
  entries.forEach((e) => {
    if (seenForms.has(e.row.form_id)) return;
    seenForms.add(e.row.form_id);
    forms.push({ id: e.row.form_id, title: e.row.forms?.title || "Form" });
  });

  const multiForm = forms.length > 1;
  const columns: QuestionColumn[] = [];
  const seen = new Set<string>();
  forms.forEach((form) => {
    const sample = entries.find((e) => e.row.form_id === form.id);
    (sample?.fields ?? []).forEach((field) => {
      if (seen.has(field.id)) return;
      seen.add(field.id);
      const label = field.label || field.id;
      columns.push({ id: field.id, header: multiForm ? `${form.title}: ${label}` : label, type: field.type });
    });
  });

  // Answers whose question was deleted from the schema would otherwise vanish.
  entries.forEach((e) => {
    Object.keys(e.row.data ?? {}).forEach((fid) => {
      // Keys that start with two underscores are not answers (the privacy consent is one).
      if (!isAnswerKey(fid) || seen.has(fid)) return;
      seen.add(fid);
      columns.push({ id: fid, header: `(removed question) ${fid}`, type: "text" });
    });
  });

  return columns;
}

const META_COLUMNS: XlsxColumn[] = [
  { header: "#", width: 5, style: STYLE.NUMBER },
  { header: "Name", width: 24, style: STYLE.BOLD },
  { header: "Email", width: 30 },
  { header: "Phone", width: 16 },
  { header: "LinkedIn", width: 34 },
  { header: "Form", width: 26 },
  { header: "Submitted (IST)", width: 18 },
  { header: "Status", width: 13 },
  { header: "Star rating", width: 11, style: STYLE.NUMBER },
  { header: "Effort score", width: 12, style: STYLE.NUMBER },
  { header: "Effort band", width: 13 },
  { header: "Signals", width: 30, style: STYLE.WRAP },
  { header: "Time on form (s)", width: 15, style: STYLE.NUMBER },
  { header: "Sec / answer", width: 12, style: STYLE.NUMBER },
  { header: "Answered", width: 10, style: STYLE.NUMBER },
  { header: "Questions", width: 10, style: STYLE.NUMBER },
  { header: "Complete %", width: 11, style: STYLE.PERCENT },
  { header: "Words written", width: 13, style: STYLE.NUMBER },
  { header: "Typed ratio", width: 11, style: STYLE.PERCENT },
  { header: "Team notes", width: 40, style: STYLE.WRAP },
  { header: "UTM source", width: 14 },
  { header: "UTM medium", width: 14 },
  { header: "UTM campaign", width: 16 },
  { header: "Referrer", width: 30 },
  { header: "Session ID", width: 26, style: STYLE.MUTED },
];

function metaRow(entry: SubmissionEntry, index: number): XlsxRow {
  const { row, identity, insights } = entry;
  return [
    index + 1,
    identity.name || "Unnamed",
    identity.email,
    identity.phone,
    identity.linkedin,
    row.forms?.title || "",
    submittedIST(row.created_at),
    row.status || "",
    row.rating || "",
    insights.effortScore.total,
    EFFORT_BAND_LABEL[insights.effortBand],
    flagText(entry),
    insights.timeOnForm ?? "",
    insights.secondsPerAnswer || "",
    insights.answeredFields,
    insights.totalFields,
    pct(insights.completeness),
    insights.totalWords,
    pct(insights.typedRatio),
    row.admin_notes || "",
    row.source.utm_source || "",
    row.source.utm_medium || "",
    row.source.utm_campaign || "",
    row.source.referrer || "",
    row.session_id || "",
  ];
}

function submissionsSheet(entries: SubmissionEntry[]): XlsxSheet {
  const questions = questionColumns(entries);
  const columns: XlsxColumn[] = [
    ...META_COLUMNS,
    ...questions.map((q) => ({
      header: q.header,
      width: q.type === "textarea" ? 52 : 24,
      style: q.type === "textarea" ? STYLE.WRAP : STYLE.DEFAULT,
    })),
  ];

  const rows = entries.map((entry, i) => [
    ...metaRow(entry, i),
    ...questions.map((q) => {
      const value = entry.row.data?.[q.id];
      return value === undefined || value === null || value === "" ? "" : formatAnswer(value);
    }),
  ]);

  return { name: "Submissions", columns, rows };
}

function engagementSheet(entries: SubmissionEntry[]): XlsxSheet {
  const columns: XlsxColumn[] = [
    { header: "Name", width: 22, style: STYLE.BOLD },
    { header: "Email", width: 28 },
    { header: "Form", width: 24 },
    { header: "Submitted (IST)", width: 18 },
    { header: "Question", width: 40, style: STYLE.WRAP },
    { header: "Answer", width: 52, style: STYLE.WRAP },
    { header: "Seconds on field", width: 15, style: STYLE.NUMBER },
    { header: "Keystrokes", width: 12, style: STYLE.NUMBER },
    { header: "Characters", width: 12, style: STYLE.NUMBER },
    { header: "Words", width: 9, style: STYLE.NUMBER },
    { header: "Typed ratio", width: 11, style: STYLE.PERCENT },
    { header: "Likely pasted", width: 13 },
    { header: "Rushed", width: 10 },
  ];

  const rows: XlsxRow[] = [];
  entries.forEach(({ row, identity, insights }) => {
    insights.fields.forEach((f) => {
      rows.push([
        identity.name || "Unnamed",
        identity.email,
        row.forms?.title || "",
        submittedIST(row.created_at),
        f.label,
        f.answered ? f.text : "",
        num(f.seconds),
        f.keys,
        f.chars,
        f.words,
        f.typedRatio === null ? "" : pct(f.typedRatio),
        f.pasted ? "Yes" : "",
        f.rushed ? "Yes" : "",
      ]);
    });
  });

  return { name: "Engagement", columns, rows };
}

function questionsSheet(entries: SubmissionEntry[]): XlsxSheet {
  const columns: XlsxColumn[] = [
    { header: "#", width: 5, style: STYLE.NUMBER },
    { header: "Question", width: 46, style: STYLE.WRAP },
    { header: "Type", width: 12, style: STYLE.MUTED },
    { header: "Form", width: 24 },
    { header: "Shown to", width: 10, style: STYLE.NUMBER },
    { header: "Answered", width: 10, style: STYLE.NUMBER },
    { header: "Answer rate", width: 12, style: STYLE.PERCENT },
    { header: "Skip rate", width: 11, style: STYLE.PERCENT },
    { header: "Avg seconds", width: 12, style: STYLE.NUMBER },
    { header: "Median seconds", width: 14, style: STYLE.NUMBER },
    { header: "Avg words", width: 11, style: STYLE.NUMBER },
    { header: "Pasted rate", width: 12, style: STYLE.PERCENT },
    { header: "Rushed rate", width: 12, style: STYLE.PERCENT },
    { header: "Verdict", width: 20 },
    { header: "What it means", width: 60, style: STYLE.WRAP },
  ];

  const { questions } = analyzeQuestions(entries);
  const rows: XlsxRow[] = questions.map((q, i) => [
    i + 1,
    q.label,
    q.type,
    q.formTitle || entries.find((e) => e.insights.fields.some((f) => f.fieldId === q.id))?.row.forms?.title || "",
    q.shown,
    q.answered,
    pct(q.shown ? q.answered / q.shown : 0),
    pct(q.skipRate),
    num(q.avgSeconds),
    num(q.medianSeconds),
    num(q.avgWords),
    pct(q.pasteRate),
    pct(q.rushRate),
    QUESTION_VERDICT[q.verdict].label,
    QUESTION_VERDICT[q.verdict].hint,
  ]);

  return { name: "Question analysis", columns, rows };
}

function tally(entries: SubmissionEntry[], keyFn: (e: SubmissionEntry) => string): [string, number][] {
  const counts = new Map<string, number>();
  entries.forEach((e) => {
    const key = keyFn(e);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export interface ExportMeta {
  filters: { label: string; value: string }[];
  stats: SubmissionStats;
}

function summarySheet(entries: SubmissionEntry[], meta: ExportMeta): XlsxSheet {
  const columns: XlsxColumn[] = [
    { header: "Metric", width: 34, style: STYLE.BOLD },
    { header: "Value", width: 30 },
    { header: "Count", width: 12, style: STYLE.NUMBER },
  ];

  const rows: XlsxRow[] = [];
  const section = (title: string) => rows.push([title, "", ""]);
  const line = (label: string, value?: string | number | null, count?: number | null) =>
    rows.push([label, value ?? "", count ?? ""]);

  section("Export");
  line("Generated (IST)", submittedIST(new Date().toISOString()));
  line("Submissions exported", "", entries.length);
  meta.filters.forEach((f) => line(f.label, f.value));

  if (entries.length) {
    const s = meta.stats;
    section("");
    section("At a glance");
    line("Average effort score", "", s.avgScore);
    line("Average time on form (s)", "", s.avgTime);
    line("Rated submissions", "", s.rated);
    line("Average star rating", "", s.avgRating);
    line("High effort", "", s.highEffort);
    line("Flagged (pasted or rushed)", "", s.flagged);

    section("");
    section("By form");
    tally(entries, (e) => e.row.forms?.title || "Unknown").forEach(([k, n]) => line("", k, n));

    section("");
    section("By status");
    tally(entries, (e) => e.row.status || "new").forEach(([k, n]) => line("", k, n));

    section("");
    section("By star rating");
    tally(entries, (e) => (e.row.rating ? `${e.row.rating} star` : "Unrated")).forEach(([k, n]) => line("", k, n));

    section("");
    section("By effort band");
    tally(entries, (e) => EFFORT_BAND_LABEL[e.insights.effortBand]).forEach(([k, n]) => line("", k, n));
  }

  return { name: "Summary", columns, rows };
}

/** @param entries already filtered and sorted, exactly as the list shows them */
export function buildSubmissionsWorkbook(entries: SubmissionEntry[], meta: ExportMeta): Blob {
  return buildXlsx([summarySheet(entries, meta), submissionsSheet(entries), questionsSheet(entries), engagementSheet(entries)]);
}

// ---- CSV -----------------------------------------------------------------

// Escape a single CSV cell per RFC 4180: wrap in quotes, double internal quotes.
function cell(value: XlsxCell): string {
  if (value === null || value === undefined) return "";
  const unwrapped = typeof value === "object" ? value.v : value;
  if (unwrapped === null || unwrapped === undefined) return "";
  const str = String(unwrapped);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** The Submissions sheet as a flat CSV. Same columns and same order as the workbook. */
export function buildSubmissionsCsv(entries: SubmissionEntry[]): string {
  const { columns, rows } = submissionsSheet(entries);
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  rows.forEach((row) => lines.push(row.map(cell).join(",")));
  // A byte order mark makes Excel read the file as UTF-8, so accents survive.
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(csv: string, filename: string) {
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function exportFilename(formTitle: string | null | undefined, extension: string): string {
  const stamp = utcToIST(new Date().toISOString()).date;
  const safe = (formTitle || "all-forms")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `submissions-${safe || "all-forms"}-${stamp}.${extension}`;
}
