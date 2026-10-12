// Export every lead, and how it moved through the stages, as an Excel workbook
// or a flat CSV. Unlike the on-screen board (which carries only what a card
// needs), this loads the full application, effort signals, source and stage
// history for each lead, so the file is the whole record.
//
// Sheets:
//   Summary        what was exported, and the breakdown by stage, form, effort and owner
//   Leads          one row per lead: identity, stage, owner, effort, source, every answer
//   Stage history  one row per stage change: who moved which lead, from where, when
//   Calls          one row per logged call: who called which lead, at which stage, and how it went

import { extractFields } from "@/lib/forms/flowModel";
import type { FormField } from "@/lib/forms/formLogic";
import {
  activeFlags,
  computeSubmissionInsights,
  EFFORT_BAND_LABEL,
  FLAG_LABEL,
  formatAnswer,
  orderedFields,
  resolveIdentity,
  type FieldTiming,
  type FlagKey,
  type SubmissionIdentity,
  type SubmissionInsights,
} from "@/lib/forms/insights";
import { utcToIST } from "@/lib/forms/ist";
import { EMPTY_SOURCE, type SubmissionSource } from "@/lib/forms/submissionAnalysis";
import { loadSources } from "@/lib/forms/submissionsData";
import { buildXlsx, downloadBlob, STYLE, type XlsxCell, type XlsxColumn, type XlsxRow, type XlsxSheet } from "@/lib/forms/xlsx";
import type { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { outcomeLabel, summarizeCalls, type CallOutcome } from "./calls";
import { ALL_LEAD_STAGES, type LeadStage } from "./schema";

export { downloadBlob };

type Supabase = ReturnType<typeof createBrowserSupabaseClient>;

const PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LeadHistoryRecord {
  from: LeadStage | null;
  to: LeadStage;
  changedAt: string;
  changedBy: string;
}

export interface LeadCallRecord {
  stage: LeadStage;
  outcome: CallOutcome;
  calledAt: string;
  calledBy: string;
  notes: string;
  followUpOn: string | null;
}

export interface LeadExportRecord {
  id: string;
  stage: LeadStage;
  createdAt: string;
  updatedAt: string;
  ownerEmail: string;
  formTitle: string;
  submissionStatus: string;
  rating: number | null;
  adminNotes: string;
  sessionId: string;
  answers: Record<string, unknown>;
  fields: FormField[];
  identity: SubmissionIdentity;
  insights: SubmissionInsights;
  flags: FlagKey[];
  source: SubmissionSource;
  history: LeadHistoryRecord[];
  calls: LeadCallRecord[];
}

interface CallQueryRow {
  lead_id: string;
  stage: LeadStage;
  outcome: CallOutcome;
  called_at: string;
  notes: string | null;
  follow_up_on: string | null;
  profiles: { email: string } | null;
}

interface LeadQueryRow {
  id: string;
  stage: LeadStage;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  form_submissions: {
    session_id: string;
    data: Record<string, unknown>;
    field_timings: Record<string, FieldTiming> | null;
    keystroke_counts: Record<string, number> | null;
    time_on_form_seconds: number | null;
    status: string | null;
    rating: number | null;
    admin_notes: string | null;
    forms: { title: string; schema: unknown };
  };
}

interface HistoryQueryRow {
  lead_id: string;
  from_stage: LeadStage | null;
  to_stage: LeadStage;
  changed_at: string;
  profiles: { email: string } | null;
}

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Loads every lead with everything the export needs. Pages past PostgREST's row cap. */
export async function loadLeadsForExport(supabase: Supabase): Promise<LeadExportRecord[]> {
  const leads = await fetchAll<LeadQueryRow>((from, to) =>
    supabase
      .from("leads")
      .select(
        "id, stage, owner_id, created_at, updated_at, form_submissions(session_id, data, field_timings, keystroke_counts, time_on_form_seconds, status, rating, admin_notes, forms(title, schema))",
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
      .returns<LeadQueryRow[]>(),
  );

  const history = await fetchAll<HistoryQueryRow>((from, to) =>
    supabase
      .from("lead_stage_history")
      .select("lead_id, from_stage, to_stage, changed_at, profiles(email)")
      .order("changed_at", { ascending: true })
      .order("id")
      .range(from, to)
      .returns<HistoryQueryRow[]>(),
  );

  const calls = await fetchAll<CallQueryRow>((from, to) =>
    supabase
      .from("lead_calls")
      .select("lead_id, stage, outcome, called_at, notes, follow_up_on, profiles(email)")
      .order("called_at", { ascending: true })
      .order("id")
      .range(from, to)
      .returns<CallQueryRow[]>(),
  );

  const ownerIds = [...new Set(leads.map((l) => l.owner_id).filter((id): id is string => !!id))];
  const owners = new Map<string, string>();
  if (ownerIds.length) {
    const { data } = await supabase.from("profiles").select("id, email").in("id", ownerIds);
    (data ?? []).forEach((p: { id: string; email: string }) => owners.set(p.id, p.email));
  }

  // Source is context, not content: loadSources never throws on a failed batch.
  const sources = await loadSources(
    supabase,
    leads.map((l) => l.form_submissions.session_id).filter(Boolean),
  );

  const historyByLead = new Map<string, LeadHistoryRecord[]>();
  history.forEach((h) => {
    const list = historyByLead.get(h.lead_id) ?? [];
    list.push({ from: h.from_stage, to: h.to_stage, changedAt: h.changed_at, changedBy: h.profiles?.email ?? "System" });
    historyByLead.set(h.lead_id, list);
  });

  const callsByLead = new Map<string, LeadCallRecord[]>();
  calls.forEach((c) => {
    const list = callsByLead.get(c.lead_id) ?? [];
    list.push({
      stage: c.stage,
      outcome: c.outcome,
      calledAt: c.called_at,
      calledBy: c.profiles?.email ?? "",
      notes: c.notes ?? "",
      followUpOn: c.follow_up_on,
    });
    callsByLead.set(c.lead_id, list);
  });

  const fieldsBySchema = new Map<unknown, FormField[]>();
  return leads.map((lead) => {
    const sub = lead.form_submissions;
    let fields = fieldsBySchema.get(sub.forms.schema);
    if (!fields) {
      fields = orderedFields(sub.forms.schema);
      if (fields.length === 0) fields = extractFields(sub.forms.schema);
      fieldsBySchema.set(sub.forms.schema, fields);
    }
    const insights = computeSubmissionInsights({
      fields,
      data: sub.data ?? {},
      fieldTimings: sub.field_timings ?? {},
      keystrokeCounts: sub.keystroke_counts ?? {},
      timeOnFormSeconds: sub.time_on_form_seconds,
    });
    return {
      id: lead.id,
      stage: lead.stage,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      ownerEmail: lead.owner_id ? (owners.get(lead.owner_id) ?? "") : "",
      formTitle: sub.forms.title,
      submissionStatus: sub.status ?? "",
      rating: sub.rating,
      adminNotes: sub.admin_notes ?? "",
      sessionId: sub.session_id ?? "",
      answers: sub.data ?? {},
      fields,
      identity: resolveIdentity(sub.data ?? {}, fields),
      insights,
      flags: activeFlags(insights),
      source: sources.get(sub.session_id) ?? EMPTY_SOURCE,
      history: historyByLead.get(lead.id) ?? [],
      calls: callsByLead.get(lead.id) ?? [],
    };
  });
}

// ---- Sheets ---------------------------------------------------------------

const stageLabel = (stage: string | null) => ALL_LEAD_STAGES.find((s) => s.id === stage)?.label ?? stage ?? "";

const istStamp = (iso: string | null | undefined) => {
  if (!iso) return "";
  const { date, time } = utcToIST(iso);
  return `${date} ${time}`;
};

const pct = (value: number | null | undefined): XlsxCell =>
  value === null || value === undefined ? "" : { v: value, style: STYLE.PERCENT };

const num = (value: number | null | undefined): XlsxCell =>
  value === null || value === undefined ? "" : { v: value, style: STYLE.NUMBER };

/** When the lead entered its current stage: its latest move into it, or creation. */
export function stageSince(record: Pick<LeadExportRecord, "stage" | "createdAt" | "history">): string {
  for (let i = record.history.length - 1; i >= 0; i--) {
    if (record.history[i].to === record.stage) return record.history[i].changedAt;
  }
  return record.createdAt;
}

const daysBetween = (fromIso: string, now: number) => Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / DAY_MS));

/** "Lead → MQL → SQL": the path the lead actually took, oldest first. */
export function stageJourney(record: Pick<LeadExportRecord, "stage" | "history">): string {
  if (record.history.length === 0) return stageLabel(record.stage);
  const steps: string[] = [];
  record.history.forEach((h, i) => {
    if (i === 0 && h.from) steps.push(stageLabel(h.from));
    steps.push(stageLabel(h.to));
  });
  return steps.join(" → ");
}

const LEAD_COLUMNS: XlsxColumn[] = [
  { header: "#", width: 5, style: STYLE.NUMBER },
  { header: "Name", width: 24, style: STYLE.BOLD },
  { header: "Email", width: 30 },
  { header: "Phone", width: 16 },
  { header: "LinkedIn", width: 34 },
  { header: "Stage", width: 12, style: STYLE.BOLD },
  { header: "In stage since (IST)", width: 18 },
  { header: "Days in stage", width: 12, style: STYLE.NUMBER },
  { header: "Stage changes", width: 12, style: STYLE.NUMBER },
  { header: "Stage journey", width: 32, style: STYLE.WRAP },
  { header: "Total calls", width: 11, style: STYLE.NUMBER },
  { header: "Connected calls", width: 15, style: STYLE.NUMBER },
  { header: "Last call (IST)", width: 18 },
  { header: "Next follow-up", width: 14 },
  ...ALL_LEAD_STAGES.map((s) => ({ header: `Calls at ${s.label}`, width: 12, style: STYLE.NUMBER })),
  { header: "Owner", width: 28 },
  { header: "Form", width: 26 },
  { header: "Applied (IST)", width: 18 },
  { header: "Last updated (IST)", width: 18 },
  { header: "Effort score", width: 12, style: STYLE.NUMBER },
  { header: "Effort band", width: 13 },
  { header: "Signals", width: 30, style: STYLE.WRAP },
  { header: "Time on form (s)", width: 15, style: STYLE.NUMBER },
  { header: "Answered", width: 10, style: STYLE.NUMBER },
  { header: "Questions", width: 10, style: STYLE.NUMBER },
  { header: "Complete %", width: 11, style: STYLE.PERCENT },
  { header: "Words written", width: 13, style: STYLE.NUMBER },
  { header: "Typed ratio", width: 11, style: STYLE.PERCENT },
  { header: "Application status", width: 17 },
  { header: "Star rating", width: 11, style: STYLE.NUMBER },
  { header: "Team notes", width: 40, style: STYLE.WRAP },
  { header: "UTM source", width: 14 },
  { header: "UTM medium", width: 14 },
  { header: "UTM campaign", width: 16 },
  { header: "Referrer", width: 30 },
  { header: "Lead ID", width: 38, style: STYLE.MUTED },
];

function leadRow(r: LeadExportRecord, index: number, now: number): XlsxRow {
  const since = stageSince(r);
  const calls = summarizeCalls(r.calls.map((c) => ({ stage: c.stage, outcome: c.outcome, called_at: c.calledAt, follow_up_on: c.followUpOn })));
  return [
    index + 1,
    r.identity.name || "Unnamed",
    r.identity.email,
    r.identity.phone,
    r.identity.linkedin,
    stageLabel(r.stage),
    istStamp(since),
    daysBetween(since, now),
    r.history.length > 0 ? r.history.length - 1 : 0,
    stageJourney(r),
    calls.total,
    calls.connected,
    istStamp(calls.lastCalledAt),
    calls.nextFollowUpOn ?? "",
    ...ALL_LEAD_STAGES.map((st) => calls.byStage[st.id] ?? 0),
    r.ownerEmail || "Unassigned",
    r.formTitle,
    istStamp(r.createdAt),
    istStamp(r.updatedAt),
    r.insights.effortScore.total,
    EFFORT_BAND_LABEL[r.insights.effortBand],
    r.flags.map((f) => FLAG_LABEL[f]).join(", "),
    r.insights.timeOnForm ?? "",
    r.insights.answeredFields,
    r.insights.totalFields,
    pct(r.insights.completeness),
    r.insights.totalWords,
    pct(r.insights.typedRatio),
    r.submissionStatus,
    r.rating ?? "",
    r.adminNotes,
    r.source.utm_source ?? "",
    r.source.utm_medium ?? "",
    r.source.utm_campaign ?? "",
    r.source.referrer ?? "",
    r.id,
  ];
}

function questionColumns(records: LeadExportRecord[]) {
  const forms = [...new Set(records.map((r) => r.formTitle))];
  const multiForm = forms.length > 1;
  const columns: { id: string; header: string; type: string }[] = [];
  const seen = new Set<string>();
  forms.forEach((title) => {
    const sample = records.find((r) => r.formTitle === title);
    (sample?.fields ?? []).forEach((f) => {
      if (seen.has(f.id)) return;
      seen.add(f.id);
      const label = f.label || f.id;
      columns.push({ id: f.id, header: multiForm ? `${title}: ${label}` : label, type: f.type });
    });
  });
  records.forEach((r) =>
    Object.keys(r.answers).forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      columns.push({ id, header: `(removed question) ${id}`, type: "text" });
    }),
  );
  return columns;
}

export function leadsSheet(records: LeadExportRecord[], now = Date.now()): XlsxSheet {
  const questions = questionColumns(records);
  const columns: XlsxColumn[] = [
    ...LEAD_COLUMNS,
    ...questions.map((q) => ({
      header: q.header,
      width: q.type === "textarea" ? 52 : 24,
      style: q.type === "textarea" ? STYLE.WRAP : STYLE.DEFAULT,
    })),
  ];
  const rows = records.map((r, i) => [
    ...leadRow(r, i, now),
    ...questions.map((q) => {
      const v = r.answers[q.id];
      return v === undefined || v === null || v === "" ? "" : formatAnswer(v);
    }),
  ]);
  return { name: "Leads", columns, rows };
}

export function historySheet(records: LeadExportRecord[]): XlsxSheet {
  const columns: XlsxColumn[] = [
    { header: "Name", width: 24, style: STYLE.BOLD },
    { header: "Email", width: 30 },
    { header: "Form", width: 26 },
    { header: "From stage", width: 13 },
    { header: "To stage", width: 13, style: STYLE.BOLD },
    { header: "Changed (IST)", width: 18 },
    { header: "Changed by", width: 30 },
    { header: "Lead ID", width: 38, style: STYLE.MUTED },
  ];
  const rows: XlsxRow[] = [];
  records.forEach((r) =>
    r.history.forEach((h) =>
      rows.push([
        r.identity.name || "Unnamed",
        r.identity.email,
        r.formTitle,
        h.from ? stageLabel(h.from) : "Created",
        stageLabel(h.to),
        istStamp(h.changedAt),
        h.changedBy,
        r.id,
      ]),
    ),
  );
  rows.sort((a, b) => String(b[5]).localeCompare(String(a[5])));
  return { name: "Stage history", columns, rows };
}

export function callsSheet(records: LeadExportRecord[]): XlsxSheet {
  const columns: XlsxColumn[] = [
    { header: "Name", width: 24, style: STYLE.BOLD },
    { header: "Email", width: 30 },
    { header: "Phone", width: 16 },
    { header: "Form", width: 26 },
    { header: "Called (IST)", width: 18 },
    { header: "Stage at the call", width: 16, style: STYLE.BOLD },
    { header: "Lead's stage now", width: 16 },
    { header: "Outcome", width: 16 },
    { header: "Called by", width: 30 },
    { header: "Notes", width: 50, style: STYLE.WRAP },
    { header: "Follow up on", width: 13 },
    { header: "Lead ID", width: 38, style: STYLE.MUTED },
  ];
  const rows: XlsxRow[] = [];
  records.forEach((r) =>
    r.calls.forEach((c) =>
      rows.push([
        r.identity.name || "Unnamed",
        r.identity.email,
        r.identity.phone,
        r.formTitle,
        istStamp(c.calledAt),
        stageLabel(c.stage),
        stageLabel(r.stage),
        outcomeLabel(c.outcome),
        c.calledBy || "Unknown",
        c.notes,
        c.followUpOn ?? "",
        r.id,
      ]),
    ),
  );
  rows.sort((a, b) => String(b[4]).localeCompare(String(a[4])));
  return { name: "Calls", columns, rows };
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export function summarySheet(records: LeadExportRecord[], filterNote: string, now = Date.now()): XlsxSheet {
  const columns: XlsxColumn[] = [
    { header: "Metric", width: 34, style: STYLE.BOLD },
    { header: "Value", width: 30 },
    { header: "Leads", width: 12, style: STYLE.NUMBER },
    { header: "Share", width: 10, style: STYLE.PERCENT },
    { header: "Avg effort score", width: 16, style: STYLE.NUMBER },
    { header: "Avg days in stage", width: 17, style: STYLE.NUMBER },
  ];
  const rows: XlsxRow[] = [];
  const total = records.length;
  const section = (title: string) => rows.push([title, "", "", "", "", ""]);
  const line = (label: string, value: string | number | null, group?: LeadExportRecord[]) =>
    rows.push([
      label,
      value ?? "",
      group ? group.length : "",
      group && total ? pct(group.length / total) : "",
      group ? num(round1(mean(group.map((r) => r.insights.effortScore.total)))) : "",
      group ? num(round1(mean(group.map((r) => daysBetween(stageSince(r), now))))) : "",
    ]);

  section("Export");
  line("Generated (IST)", istStamp(new Date(now).toISOString()));
  line("Scope", filterNote);
  line("Leads exported", total);

  section("");
  section("By stage");
  ALL_LEAD_STAGES.forEach((s) => line(s.label, s.hint, records.filter((r) => r.stage === s.id)));

  const group = (key: (r: LeadExportRecord) => string) => {
    const map = new Map<string, LeadExportRecord[]>();
    records.forEach((r) => map.set(key(r), [...(map.get(key(r)) ?? []), r]));
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  };

  const allCalls = records.flatMap((r) => r.calls);
  section("");
  section("Calls");
  line("Total calls", allCalls.length);
  line("Leads called", `${records.filter((r) => r.calls.length > 0).length} of ${total}`);
  line("Leads not called yet", records.filter((r) => r.calls.length === 0).length);
  ALL_LEAD_STAGES.forEach((s) => {
    const n = allCalls.filter((c) => c.stage === s.id).length;
    if (n) line(`Calls made at ${s.label}`, n);
  });

  section("");
  section("By form");
  group((r) => r.formTitle).forEach(([k, g]) => line(k, "", g));

  section("");
  section("By effort band");
  group((r) => EFFORT_BAND_LABEL[r.insights.effortBand]).forEach(([k, g]) => line(k, "", g));

  section("");
  section("By owner");
  group((r) => r.ownerEmail || "Unassigned").forEach(([k, g]) => line(k, "", g));

  return { name: "Summary", columns, rows };
}

export function buildLeadsWorkbook(records: LeadExportRecord[], filterNote = "All leads", now = Date.now()): Blob {
  return buildXlsx([summarySheet(records, filterNote, now), leadsSheet(records, now), historySheet(records), callsSheet(records)]);
}

// ---- CSV ------------------------------------------------------------------

function csvCell(value: XlsxCell): string {
  if (value === null || value === undefined) return "";
  const unwrapped = typeof value === "object" ? value.v : value;
  if (unwrapped === null || unwrapped === undefined) return "";
  const str = String(unwrapped);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** The Leads sheet as a flat CSV, same columns and order as the workbook. */
export function buildLeadsCsv(records: LeadExportRecord[], now = Date.now()): string {
  const { columns, rows } = leadsSheet(records, now);
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  rows.forEach((row) => lines.push(row.map(csvCell).join(",")));
  // A byte order mark makes Excel read the file as UTF-8, so accents survive.
  return "﻿" + lines.join("\r\n");
}

export function leadsExportFilename(scope: string, extension: string): string {
  const stamp = utcToIST(new Date().toISOString()).date;
  const safe = scope.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "all";
  return `leads-${safe}-${stamp}.${extension}`;
}
