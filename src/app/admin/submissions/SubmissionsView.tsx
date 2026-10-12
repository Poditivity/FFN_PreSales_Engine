"use client";

// Every completed application across every form, in three views: a list, a
// one-at-a-time review card, and cohort insights. Ported from build-fellowship's
// FormSubmissions page so the two products score, filter and export the same way.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Download, FileSpreadsheet, FileText, LayoutGrid, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Select, StatCard } from "@/components/ffn";
import { EFFORT_BAND_LABEL, FLAG_LABEL, formatDuration, orderedFields, resolveIdentity, computeSubmissionInsights, activeFlags, type FieldTiming, type FlagKey } from "@/lib/forms/insights";
import type { FormField } from "@/lib/forms/formLogic";
import { utcToIST } from "@/lib/forms/ist";
import { buildSubmissionsCsv, buildSubmissionsWorkbook, downloadBlob, downloadCsv, exportFilename } from "@/lib/forms/exportSubmissions";
import { SUBMISSION_STATUSES, summarize, type SubmissionEntry, type SubmissionRow } from "@/lib/forms/submissionAnalysis";
import { FETCH_LIMIT, loadSubmissions, resendConfirmationEmail, updateSubmission } from "@/lib/forms/submissionsData";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { InsightsPanel } from "./InsightsPanel";
import { ReviewCard } from "./ReviewCard";
import { ScorePill, SignalChip, StarRating, statusLabel, SubmissionStatusBadge } from "./parts";

export interface SubmissionForm {
  id: string;
  title: string;
  schema: unknown;
}

type View = "table" | "cards" | "insights";
type Patch = Partial<Pick<SubmissionRow, "rating" | "status" | "admin_notes">>;

const RATING_FILTERS = [
  { value: "", label: "Any rating" },
  { value: "unrated", label: "Not yet rated" },
  { value: "rated", label: "Rated (any)" },
  { value: "gte5", label: "5 stars" },
  { value: "gte4", label: "4 stars and up" },
  { value: "gte3", label: "3 stars and up" },
  { value: "gte2", label: "2 stars and up" },
  { value: "lte2", label: "2 stars and below" },
];

const BAND_FILTERS = [
  { value: "", label: "Any effort" },
  { value: "high", label: "High effort" },
  { value: "medium", label: "Moderate effort" },
  { value: "low", label: "Low effort" },
];

const FLAG_FILTERS: FlagKey[] = ["pasted", "rushed", "speedrun", "detailed", "complete"];

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "rating_desc", label: "Highest rated" },
  { value: "rating_asc", label: "Lowest rated" },
  { value: "score_desc", label: "Highest effort score" },
  { value: "score_asc", label: "Lowest effort score" },
  { value: "time_desc", label: "Longest time on form" },
  { value: "name_asc", label: "Name, A to Z" },
];

interface Filters {
  formId: string;
  status: string;
  rating: string;
  band: string;
  flags: FlagKey[];
  search: string;
  sort: string;
}

function matchesRating(rating: number | null, filter: string): boolean {
  if (!filter) return true;
  if (filter === "unrated") return !rating;
  if (filter === "rated") return !!rating;
  if (filter.startsWith("gte")) return !!rating && rating >= Number(filter.slice(3));
  if (filter.startsWith("lte")) return !!rating && rating <= Number(filter.slice(3));
  return true;
}

const asText = (v: unknown) => (Array.isArray(v) ? v.join(" ") : String(v ?? ""));

export function SubmissionsView({
  forms,
  initialFormId,
  initialRating,
}: {
  forms: SubmissionForm[];
  initialFormId: string;
  /** "unrated" when arriving from the dashboard's review action. */
  initialRating: "" | "unrated" | "rated";
}) {
  const [filters, setFilters] = useState<Filters>({
    formId: forms.some((f) => f.id === initialFormId) ? initialFormId : "",
    status: "",
    rating: initialRating,
    band: "",
    flags: [],
    search: "",
    sort: "newest",
  });
  const [view, setView] = useState<View>("table");
  const [cursor, setCursor] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [notice, setNotice] = useState("");
  // Rating and status are set repeatedly while paging through the queue, so
  // they show at once and are dropped again only if the write fails.
  const [patches, setPatches] = useState<Record<string, Patch>>({});
  const listTopRef = useRef<HTMLDivElement>(null);

  const [supabase] = useState(() => createBrowserSupabaseClient());
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["submissions", filters.formId, filters.status] as const, [filters.formId, filters.status]);

  const setFilter = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const query = useQuery({
    queryKey,
    queryFn: () => loadSubmissions(supabase, { formId: filters.formId || null, status: filters.status || null }),
    // A row that moves while a reviewer is reading it costs more than the
    // freshness gains, so the list only reloads when a filter changes.
    refetchOnWindowFocus: false,
  });

  const loading = query.isPending;
  const total = query.data?.total ?? 0;
  const error = notice || (query.error instanceof Error ? query.error.message : "");

  const rows = useMemo<SubmissionRow[]>(
    () => (query.data?.rows ?? []).map((r) => (patches[r.id] ? { ...r, ...patches[r.id] } : r)),
    [query.data, patches],
  );

  // Question fields per form, derived once: resolving identity and insights
  // for every row needs them and re-walking each schema per row is wasteful.
  const fieldsByForm = useMemo(() => {
    const map = new Map<string, FormField[]>();
    forms.forEach((f) => map.set(f.id, orderedFields(f.schema)));
    return map;
  }, [forms]);

  const entries = useMemo<SubmissionEntry[]>(
    () =>
      rows.map((row) => {
        const fields = fieldsByForm.get(row.form_id) ?? [];
        const insights = computeSubmissionInsights({
          fields,
          data: row.data,
          fieldTimings: row.field_timings as Record<string, FieldTiming>,
          keystrokeCounts: row.keystroke_counts,
          timeOnFormSeconds: row.time_on_form_seconds,
        });
        return { row, fields, identity: resolveIdentity(row.data, fields), insights, flags: activeFlags(insights) };
      }),
    [rows, fieldsByForm],
  );

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const list = entries.filter(({ row, identity, insights, flags }) => {
      if (!matchesRating(row.rating, filters.rating)) return false;
      if (filters.band && insights.effortBand !== filters.band) return false;
      if (filters.flags.length && !filters.flags.every((f) => flags.includes(f))) return false;
      if (term) {
        const haystack = [
          identity.name,
          identity.email,
          identity.phone,
          identity.linkedin,
          row.admin_notes,
          row.forms?.title,
          ...Object.values(row.data ?? {}).map(asText),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const time = (e: SubmissionEntry) => new Date(e.row.created_at).getTime();
    const sorters: Record<string, (a: SubmissionEntry, b: SubmissionEntry) => number> = {
      newest: (a, b) => time(b) - time(a),
      oldest: (a, b) => time(a) - time(b),
      rating_desc: (a, b) => (b.row.rating || 0) - (a.row.rating || 0) || time(b) - time(a),
      rating_asc: (a, b) => (a.row.rating || 0) - (b.row.rating || 0) || time(b) - time(a),
      score_desc: (a, b) => b.insights.effortScore.total - a.insights.effortScore.total,
      score_asc: (a, b) => a.insights.effortScore.total - b.insights.effortScore.total,
      time_desc: (a, b) => (b.insights.timeOnForm || 0) - (a.insights.timeOnForm || 0),
      name_asc: (a, b) => (a.identity.name || "~").localeCompare(b.identity.name || "~"),
    };
    return [...list].sort(sorters[filters.sort] ?? sorters.newest);
  }, [entries, filters]);

  const stats = useMemo(() => summarize(filtered), [filtered]);

  // Keep the review card pointed at a real submission when filters change.
  const position = filtered.length === 0 ? 0 : Math.min(cursor, filtered.length - 1);
  const current = filtered[position];

  const activeFilterCount =
    (filters.rating ? 1 : 0) +
    (filters.band ? 1 : 0) +
    filters.flags.length +
    (filters.search.trim() ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.formId ? 1 : 0);

  // ---- Mutations ---------------------------------------------------------

  const withSave = useCallback(
    async (id: string, patch: Patch) => {
      setNotice("");
      setPatches((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
      const dropPatch = () =>
        setPatches((p) => {
          const next = { ...(p[id] ?? {}) };
          Object.keys(patch).forEach((k) => delete next[k as keyof Patch]);
          return { ...p, [id]: next };
        });
      try {
        await updateSubmission(supabase, id, patch);
        // Fold the saved value into the cache so a later failed save rolls back
        // to it rather than to the value from before this session.
        queryClient.setQueryData(queryKey, (old: typeof query.data) =>
          old ? { ...old, rows: old.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : old,
        );
        dropPatch();
      } catch (e) {
        dropPatch();
        setNotice(e instanceof Error ? e.message : "Could not save your change.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase, queryClient, queryKey],
  );

  const rate = useCallback((id: string, value: number | null) => withSave(id, { rating: value }), [withSave]);
  const changeStatus = useCallback((id: string, value: string) => withSave(id, { status: value }), [withSave]);
  const saveNotes = useCallback((id: string, value: string) => withSave(id, { admin_notes: value }), [withSave]);
  const resend = useCallback((id: string) => resendConfirmationEmail(supabase, id), [supabase]);

  const openCard = (index: number) => {
    setCursor(index);
    setView("cards");
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  const step = useCallback(
    (delta: number) => setCursor(() => (filtered.length ? (position + delta + filtered.length) % filtered.length : 0)),
    [filtered.length, position],
  );
  const closeCard = useCallback(() => setView("table"), []);

  // ---- Export ------------------------------------------------------------

  useEffect(() => {
    if (!exportOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExportOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportOpen]);

  const formTitle = filters.formId ? forms.find((f) => f.id === filters.formId)?.title : null;

  const filterSummary = () => [
    { label: "Form", value: formTitle || "All forms" },
    { label: "Status", value: filters.status ? statusLabel(filters.status) : "All statuses" },
    { label: "Rating filter", value: RATING_FILTERS.find((r) => r.value === filters.rating)?.label ?? "Any rating" },
    { label: "Effort filter", value: filters.band ? EFFORT_BAND_LABEL[filters.band as keyof typeof EFFORT_BAND_LABEL] : "Any effort" },
    { label: "Signal filters", value: filters.flags.map((f) => FLAG_LABEL[f]).join(", ") || "None" },
    { label: "Search", value: filters.search.trim() || "None" },
    { label: "Sorted by", value: SORTS.find((s) => s.value === filters.sort)?.label ?? "" },
  ];

  const runExport = (kind: "xlsx" | "csv") => {
    setExportOpen(false);
    setNotice("");
    if (filtered.length === 0) {
      setNotice("Nothing to export. No submissions match these filters.");
      return;
    }
    setExporting(true);
    try {
      if (kind === "csv") {
        downloadCsv(buildSubmissionsCsv(filtered), exportFilename(formTitle, "csv"));
      } else {
        downloadBlob(buildSubmissionsWorkbook(filtered, { filters: filterSummary(), stats }), exportFilename(formTitle, "xlsx"));
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  // ---- Render ------------------------------------------------------------

  const truncated = total > rows.length;
  const toggleFlag = (flag: FlagKey) =>
    setFilter({ flags: filters.flags.includes(flag) ? filters.flags.filter((f) => f !== flag) : [...filters.flags, flag] });

  const VIEWS = [
    { key: "table", icon: Rows3, label: "List" },
    { key: "cards", icon: LayoutGrid, label: "Review" },
    { key: "insights", icon: BarChart3, label: "Insights" },
  ] as const;

  const subtitle = loading
    ? "Loading"
    : `${filtered.length} ${filtered.length === 1 ? "submission" : "submissions"}` +
      (filtered.length !== entries.length ? ` of ${entries.length} loaded` : "") +
      (truncated ? `, ${total} in total` : "");

  return (
    <div ref={listTopRef}>
      <div className="flex items-start justify-between flex-wrap" style={{ gap: "var(--space-4)" }}>
        <div>
          <h1 className="h1">Submissions</h1>
          <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }} aria-live="polite">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: "var(--space-3)" }}>
          <div className="dash-segment" role="group" aria-label="View">
            {VIEWS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                className="dash-segment__btn label-sm flex items-center"
                style={{ gap: "var(--space-2)" }}
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <Button
              iconLeft={<Download size={16} />}
              loading={exporting}
              disabled={loading}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((v) => !v)}
            >
              {`Export${filtered.length ? ` (${filtered.length})` : ""}`}
            </Button>
            {exportOpen && (
              <>
                <div className="subs-scrim" onClick={() => setExportOpen(false)} />
                <div className="subs-menu" role="menu">
                  <p className="caption subs-hint" style={{ padding: "var(--space-2) var(--space-3)", margin: 0 }}>
                    Exports the {filtered.length} submission{filtered.length === 1 ? "" : "s"} matching your current filters.
                  </p>
                  {[
                    { kind: "xlsx", icon: FileSpreadsheet, title: "Excel workbook (.xlsx)", hint: "Summary, Submissions, Question analysis and Engagement sheets" },
                    { kind: "csv", icon: FileText, title: "CSV", hint: "Flat single-table file" },
                  ].map(({ kind, icon: Icon, title, hint }) => (
                    <button key={kind} type="button" role="menuitem" className="subs-menuitem" onClick={() => runExport(kind as "xlsx" | "csv")}>
                      <Icon size={16} strokeWidth={1.75} aria-hidden style={{ marginTop: "var(--space-0\\.5)", flexShrink: 0 }} />
                      <span>
                        <span className="body" style={{ display: "block" }}>{title}</span>
                        <span className="caption subs-hint" style={{ display: "block" }}>{hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-end flex-wrap" style={{ gap: "var(--space-3)", marginTop: "var(--space-6)" }}>
        <div style={{ flex: "1 1 calc(var(--space-16) * 3.5)", minWidth: "calc(var(--space-16) * 3)", position: "relative" }}>
          <Input
            size="sm"
            label="Search"
            placeholder="Name, email, answers, notes…"
            value={filters.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            style={{ paddingLeft: "var(--space-8)" }}
          />
          <Search
            size={14}
            strokeWidth={1.75}
            aria-hidden
            style={{ position: "absolute", left: "var(--space-3)", bottom: "var(--space-2)", color: "var(--ink-subtle)", pointerEvents: "none" }}
          />
        </div>

        <Select
          size="sm"
          label="Form"
          value={filters.formId}
          options={[{ value: "", label: "All forms" }, ...forms.map((f) => ({ value: f.id, label: f.title }))]}
          onChange={(e) => setFilter({ formId: e.target.value })}
        />
        <Select size="sm" label="Sort" value={filters.sort} options={SORTS} onChange={(e) => setFilter({ sort: e.target.value })} />

        <Button
          variant="secondary"
          size="sm"
          iconLeft={<SlidersHorizontal size={14} />}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="data-sm" style={{ marginLeft: "var(--space-2)" }}>
              {activeFilterCount}
            </span>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<X size={14} />}
            onClick={() => setFilters({ formId: "", status: "", rating: "", band: "", flags: [], search: "", sort: filters.sort })}
          >
            Clear
          </Button>
        )}
      </div>

      {showFilters && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <Card>
            <div className="flex flex-wrap" style={{ gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              <Select
                size="sm"
                label="Status"
                value={filters.status}
                options={[{ value: "", label: "All statuses" }, ...SUBMISSION_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))]}
                onChange={(e) => setFilter({ status: e.target.value })}
              />
              <Select size="sm" label="Rating" value={filters.rating} options={RATING_FILTERS} onChange={(e) => setFilter({ rating: e.target.value })} />
              <Select size="sm" label="Effort" value={filters.band} options={BAND_FILTERS} onChange={(e) => setFilter({ band: e.target.value })} />
            </div>

            <div className="eyebrow" style={{ color: "var(--ink-subtle)", textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
              Engagement signals
            </div>
            <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }} role="group" aria-label="Engagement signals">
              {FLAG_FILTERS.map((flag) => (
                <button
                  key={flag}
                  type="button"
                  className="subs-toggle label-sm"
                  aria-pressed={filters.flags.includes(flag)}
                  onClick={() => toggleFlag(flag)}
                >
                  {FLAG_LABEL[flag]}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Stat strip */}
      {!loading && entries.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(calc(var(--space-16) * 2.5), 1fr))",
            gap: "var(--space-3)",
            marginTop: "var(--space-4)",
          }}
        >
          <StatCard label="Showing" value={stats.total} note={`of ${entries.length} loaded`} />
          <StatCard label="Rated" value={stats.rated} note={stats.avgRating ? `average ${stats.avgRating} stars` : "none yet"} />
          <StatCard label="Average effort" value={stats.avgScore ?? "—"} note={`${stats.highEffort} high effort`} />
          <StatCard label="Average time" value={formatDuration(stats.avgTime)} note="on form" />
          <StatCard label="Flagged" value={stats.flagged} note="pasted or rushed" />
        </div>
      )}

      {error && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {truncated && !loading && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <Alert tone="warning" title="This list is truncated">
            Showing the {rows.length} most recent of {total}. Narrow by form to review the rest. The limit is {FETCH_LIMIT} per load.
          </Alert>
        </div>
      )}

      <div style={{ marginTop: "var(--space-4)" }}>
        {loading ? (
          <Card>
            <div className="flex items-center justify-center" style={{ gap: "var(--space-3)", padding: "var(--space-8)" }} role="status">
              <span className="ffn-spinner" aria-hidden />
              <span className="body-sm" style={{ color: "var(--ink-muted)" }}>Loading submissions</span>
            </div>
          </Card>
        ) : view === "insights" ? (
          <InsightsPanel entries={filtered} stats={stats} />
        ) : filtered.length === 0 ? (
          <EmptyState title={entries.length === 0 ? "No submissions yet" : "No submissions match these filters"}>
            {entries.length === 0
              ? "Completed applications appear here once a form is live."
              : "Clear a filter to see more."}
          </EmptyState>
        ) : view === "cards" && current ? (
          <ReviewCard
            key={current.row.id}
            entry={current}
            index={position}
            total={filtered.length}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onRate={rate}
            onStatusChange={changeStatus}
            onNotesSave={saveNotes}
            onResend={resend}
            onClose={closeCard}
          />
        ) : (
          <div className="ffn-table-wrap" style={{ overflowX: "auto" }}>
            <table className="ffn-table">
              <caption className="ffn-sr">Submissions matching the current filters</caption>
              <thead>
                <tr>
                  <th className="max-md:hidden" style={{ width: "var(--space-12)" }}>#</th>
                  <th>Name</th>
                  <th className="max-md:hidden">Email</th>
                  <th className="max-md:hidden">Form</th>
                  <th className="max-md:hidden">Rating</th>
                  <th style={{ textAlign: "center" }}>Effort</th>
                  <th className="max-md:hidden" style={{ textAlign: "right" }}>Time</th>
                  <th className="max-md:hidden">Signals</th>
                  <th className="max-md:hidden">Status</th>
                  <th className="max-md:hidden">Submitted (IST)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ row, identity, insights, flags }, i) => {
                  const { date, time } = row.created_at ? utcToIST(row.created_at) : { date: "—", time: "" };
                  return (
                    <tr key={row.id} className="subs-row" onClick={() => openCard(i)}>
                      <td className="ffn-table__num max-md:hidden" style={{ color: "var(--ink-subtle)" }}>{i + 1}</td>
                      <td>
                        <button type="button" className="subs-rowbtn label" style={{ whiteSpace: "nowrap" }} onClick={(e) => { e.stopPropagation(); openCard(i); }}>
                          {identity.name || <span style={{ color: "var(--ink-subtle)" }}>Unnamed</span>}
                        </button>
                      </td>
                      <td className="body-sm max-md:hidden">{identity.email || "—"}</td>
                      <td className="body-sm max-md:hidden" style={{ whiteSpace: "nowrap" }}>{row.forms?.title || "—"}</td>
                      <td className="max-md:hidden" onClick={(e) => e.stopPropagation()}>
                        <StarRating value={row.rating} onChange={(n) => rate(row.id, n)} size={16} />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <ScorePill score={insights.effortScore.total} band={insights.effortBand} />
                      </td>
                      <td className="ffn-table__num max-md:hidden" style={{ whiteSpace: "nowrap" }}>{formatDuration(insights.timeOnForm)}</td>
                      <td className="max-md:hidden">
                        <div className="flex flex-wrap" style={{ gap: "var(--space-1)" }}>
                          {flags.slice(0, 2).map((f) => (
                            <SignalChip key={f} tone={f === "detailed" || f === "complete" ? "good" : "warn"}>
                              {FLAG_LABEL[f]}
                            </SignalChip>
                          ))}
                          {flags.length === 0 && <Badge dot={false}>None</Badge>}
                        </div>
                      </td>
                      <td className="max-md:hidden">
                        <SubmissionStatusBadge status={row.status || "new"} />
                      </td>
                      <td className="data-sm max-md:hidden" style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                        {date} {time}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
