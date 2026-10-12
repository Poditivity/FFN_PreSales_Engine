"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, LayoutGrid, Phone, Rows3, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, Select, StageBadge } from "@/components/ffn";
import { CallForm } from "@/components/leads/CallForm";
import { utcToIST } from "@/lib/forms/ist";
import { callsWord, type CallDraft } from "@/lib/leads/calls";
import {
  buildLeadsCsv,
  buildLeadsWorkbook,
  downloadBlob,
  leadsExportFilename,
  loadLeadsForExport,
} from "@/lib/leads/exportLeads";
import { moveLeadsToStage, moveLeadToStage } from "@/lib/leads/moveStage";
import { ALL_LEAD_STAGES, OFF_PATH_STAGES, PIPELINE_STAGES, type LeadStage, type LeadStageDef } from "@/lib/leads/schema";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ScorePill, type Band } from "../submissions/parts";

export interface BoardLead {
  id: string;
  stage: LeadStage;
  ownerId: string | null;
  createdAt: string;
  name: string;
  email: string;
  programId: string;
  programTitle: string;
  effortScore: number;
  effortBand: Band;
  /** Calls logged to this lead, and when the latest one was made. */
  callCount: number;
  lastCallAt: string | null;
  nextFollowUpOn: string | null;
}

export interface ProgramOption {
  id: string;
  title: string;
}

export interface OwnerOption {
  id: string;
  label: string;
}

type ViewMode = "list" | "board";

const PAGE_SIZE = 50;

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "effort_desc", label: "Highest effort score" },
  { value: "effort_asc", label: "Lowest effort score" },
  { value: "name_asc", label: "Name, A to Z" },
  { value: "calls_desc", label: "Most calls" },
  { value: "call_oldest", label: "Longest since last call" },
];

const CALL_FILTERS = [
  { value: "", label: "Any" },
  { value: "none", label: "Not called yet" },
  { value: "few", label: "1 to 2 calls" },
  { value: "many", label: "3 or more calls" },
  { value: "stale", label: "No call in 7 days" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 7;

/** Whole days since an ISO time. Kept out of render so the clock is read where the filter runs, not while React renders. */
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

function matchesCallFilter(lead: BoardLead, filter: string): boolean {
  switch (filter) {
    case "none":
      return lead.callCount === 0;
    case "few":
      return lead.callCount >= 1 && lead.callCount <= 2;
    case "many":
      return lead.callCount >= 3;
    case "stale":
      return !lead.lastCallAt || daysSince(lead.lastCallAt) >= STALE_DAYS;
    default:
      return true;
  }
}

// Names, emails and form titles are whatever an applicant or an admin typed,
// so none of them can be trusted to fit a cell. Long unbroken strings wrap
// instead of pushing out of the box.
const WRAP = { overflowWrap: "anywhere", minWidth: 0 } as const;

// Wide enough for a typical name and its controls on one line.
const COLUMN_WIDTH = 272;

const who = (lead: BoardLead) => lead.name || lead.email || "lead";
const stageLabel = (stage: LeadStage) => ALL_LEAD_STAGES.find((s) => s.id === stage)?.label ?? stage;

/** A board card carries the four things worth scanning for: name, date, effort score and stage. */
function LeadCard({
  lead,
  onMove,
  onDragStart,
  selected,
  onToggle,
  onLogCall,
}: {
  lead: BoardLead;
  onMove: (stage: LeadStage) => void;
  onLogCall?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  /** Present only when selection is on, which is when a single stage is filtered. */
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      data-testid={`lead-card-${lead.id}`}
      style={{
        background: selected ? "var(--surface-selected)" : "var(--surface)",
        border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        cursor: onDragStart ? "grab" : undefined,
        minWidth: 0,
      }}
    >
      <div className="flex items-start" style={{ gap: "var(--space-2)" }}>
        {onToggle && (
          <Checkbox
            label={<span className="ffn-sr">Select {who(lead)}</span>}
            checked={!!selected}
            onChange={onToggle}
          />
        )}
        <Link href={`/admin/leads/${lead.id}`} className="body-medium" style={{ color: "var(--ink)", flex: 1, ...WRAP }}>
          {lead.name || lead.email || "Unknown"}
        </Link>
      </div>
      <div className="flex items-center justify-between" style={{ gap: "var(--space-2)" }}>
        <p className="data-sm" style={{ color: "var(--ink-subtle)", margin: 0 }}>
          {utcToIST(lead.createdAt).date}
        </p>
        <span className="flex items-center" style={{ gap: "var(--space-1)" }}>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>
            Effort
          </span>
          <ScorePill score={lead.effortScore} band={lead.effortBand} />
        </span>
      </div>
      <div className="flex items-center justify-between" style={{ gap: "var(--space-2)" }}>
        <span className="caption" style={{ color: lead.callCount ? "var(--ink-muted)" : "var(--ink-subtle)" }}>
          {lead.callCount ? `${callsWord(lead.callCount)} · last ${utcToIST(lead.lastCallAt ?? lead.createdAt).date}` : "Not called yet"}
        </span>
        {onLogCall && (
          <button
            type="button"
            className="call-quick"
            aria-label={`Log a call with ${who(lead)}`}
            title="Log a call"
            onClick={onLogCall}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Phone size={14} strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>
      <Select
        size="sm"
        aria-label={`Stage of ${who(lead)}`}
        value={lead.stage}
        options={ALL_LEAD_STAGES.map((s) => ({ value: s.id, label: s.label }))}
        onChange={(e) => onMove(e.target.value as LeadStage)}
      />
    </div>
  );
}

function StageColumn({
  def,
  leads,
  dragOver,
  onDragOverStage,
  onDropLead,
  onMove,
  onLogCall,
}: {
  def: LeadStageDef;
  leads: BoardLead[];
  dragOver: boolean;
  onDragOverStage: (over: boolean) => void;
  onDropLead: (leadId: string) => void;
  onMove: (leadId: string, stage: LeadStage) => void;
  onLogCall: (lead: BoardLead) => void;
}) {
  return (
    <div
      data-testid={`stage-column-${def.id}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverStage(true);
      }}
      onDragLeave={() => onDragOverStage(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragOverStage(false);
        const leadId = e.dataTransfer.getData("text/plain");
        if (leadId) onDropLead(leadId);
      }}
      style={{
        flex: "none",
        width: COLUMN_WIDTH,
        background: dragOver ? "var(--surface-selected)" : "var(--surface-sunken)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <div>
        <div className="flex items-center justify-between" style={{ gap: "var(--space-2)" }}>
          <span className="label" style={{ color: "var(--ink)" }}>
            {def.label}
          </span>
          <span className="data-sm" style={{ color: "var(--ink-muted)" }}>
            {leads.length}
          </span>
        </div>
        <p className="caption" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 0" }}>
          {def.hint}
        </p>
      </div>
      {/* A column with hundreds of leads scrolls inside itself instead of stretching the page. */}
      <div className="flex flex-col" style={{ gap: "var(--space-2)", maxHeight: "calc(100vh - 340px)", minHeight: 120, overflowY: "auto" }}>
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onMove={(stage) => onMove(lead.id, stage)}
            onLogCall={() => onLogCall(lead)}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
          />
        ))}
        {leads.length === 0 && (
          <p
            className="caption"
            style={{
              color: "var(--ink-subtle)",
              margin: 0,
              padding: "var(--space-4) var(--space-2)",
              textAlign: "center",
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            No leads here. Drop one to move it.
          </p>
        )}
      </div>
    </div>
  );
}

export function LeadsBoard({
  initialLeads,
  programs,
  owners = [],
  loadError,
}: {
  initialLeads: BoardLead[];
  programs: ProgramOption[];
  /** The team, for the Owner filter and the owner shown under each name. */
  owners?: OwnerOption[];
  loadError?: string | null;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [programId, setProgramId] = useState("");
  const [stage, setStage] = useState<"" | LeadStage>("");
  const [sort, setSort] = useState("newest");
  const [callFilter, setCallFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [callTarget, setCallTarget] = useState<BoardLead | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<"" | LeadStage>("");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [mobileStage, setMobileStage] = useState<LeadStage>(PIPELINE_STAGES[0].id);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const showForm = programs.length > 1;

  // Everything but the stage filter, so each stage can show how many leads it
  // would give if picked.
  const scoped = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (programId && l.programId !== programId) return false;
      if (term && !l.email.toLowerCase().includes(term) && !l.name.toLowerCase().includes(term)) return false;
      if (!matchesCallFilter(l, callFilter)) return false;
      if (ownerFilter === "none" ? !!l.ownerId : ownerFilter && l.ownerId !== ownerFilter) return false;
      return true;
    });
  }, [leads, search, programId, callFilter, ownerFilter]);

  const stageCounts = useMemo(() => {
    const counts = new Map<LeadStage, number>();
    scoped.forEach((l) => counts.set(l.stage, (counts.get(l.stage) ?? 0) + 1));
    return counts;
  }, [scoped]);

  const filtered = useMemo(() => {
    const list = stage ? scoped.filter((l) => l.stage === stage) : scoped;
    const time = (l: BoardLead) => new Date(l.createdAt).getTime();
    const sorters: Record<string, (a: BoardLead, b: BoardLead) => number> = {
      newest: (a, b) => time(b) - time(a),
      oldest: (a, b) => time(a) - time(b),
      effort_desc: (a, b) => b.effortScore - a.effortScore || time(b) - time(a),
      effort_asc: (a, b) => a.effortScore - b.effortScore || time(b) - time(a),
      name_asc: (a, b) => (a.name || a.email || "~").localeCompare(b.name || b.email || "~"),
      calls_desc: (a, b) => b.callCount - a.callCount || time(b) - time(a),
      // Never-called leads first, then the ones whose last call is furthest back.
      call_oldest: (a, b) =>
        (a.lastCallAt ? new Date(a.lastCallAt).getTime() : -Infinity) - (b.lastCallAt ? new Date(b.lastCallAt).getTime() : -Infinity) ||
        time(b) - time(a),
    };
    return [...list].sort(sorters[sort] ?? sorters.newest);
  }, [scoped, stage, sort]);

  // Grouped once for the board and its phone tabs: one list, two presentations.
  const columns = useMemo(() => {
    const map = new Map<LeadStage, BoardLead[]>();
    for (const def of ALL_LEAD_STAGES) map.set(def.id, []);
    for (const lead of filtered) map.get(lead.stage)?.push(lead);
    return map;
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageLeads = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Selection only ever acts on leads still in view: a lead filtered out
  // after being ticked is not moved by accident.
  const selectedInView = useMemo(() => filtered.filter((l) => selected.has(l.id)), [filtered, selected]);
  const allSelected = filtered.length > 0 && selectedInView.length === filtered.length;
  const filtersActive = !!(search.trim() || programId || stage || callFilter || ownerFilter);
  const ownerName = (id: string | null) => (id ? (owners.find((o) => o.id === id)?.label ?? null) : null);

  // Board cards are ticked only when one stage is on screen, matching a
  // single-stage bulk move; the list always allows it.
  const boardSelectable = view === "board" && !!stage;

  // The tick boxes exist in the list, and on the board only when one stage is showing.
  const bulkVisible = selectedInView.length > 0 && (view === "list" || boardSelectable);

  const resetPage = () => setPage(0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((l) => l.id)));
  }

  async function moveLead(leadId: string, next: LeadStage) {
    setError(null);
    setNotice(null);
    const previous = leads;
    const lead = leads.find((l) => l.id === leadId);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: next } : l)));

    const { error: moveError } = await moveLeadToStage(leadId, next);
    if (moveError) {
      setLeads(previous);
      setError(moveError);
      return;
    }
    // The card leaves the list it was in, so say where it went.
    if (lead) setNotice(`Moved ${who(lead)} to ${stageLabel(next)}.`);
  }

  async function moveSelected() {
    if (!bulkStage) return;
    const ids = selectedInView.filter((l) => l.stage !== bulkStage).map((l) => l.id);
    setConfirmBulk(false);
    if (ids.length === 0) {
      setNotice(`Every selected lead is already at ${stageLabel(bulkStage)}.`);
      return;
    }
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    const idSet = new Set(ids);
    const previous = leads;
    setLeads((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, stage: bulkStage } : l)));
    const { error: moveError } = await moveLeadsToStage(ids, bulkStage);
    setBulkBusy(false);
    if (moveError) {
      setLeads(previous);
      setError(moveError);
      return;
    }
    setNotice(`Moved ${ids.length} ${ids.length === 1 ? "lead" : "leads"} to ${stageLabel(bulkStage)}.`);
    setSelected(new Set());
    setBulkStage("");
  }

  function onCallSaved(lead: BoardLead, draft: CallDraft) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? {
              ...l,
              callCount: l.callCount + 1,
              lastCallAt: !l.lastCallAt || draft.calledAt > l.lastCallAt ? draft.calledAt : l.lastCallAt,
              nextFollowUpOn: draft.followUpOn && (!l.nextFollowUpOn || draft.followUpOn > l.nextFollowUpOn) ? draft.followUpOn : l.nextFollowUpOn,
            }
          : l,
      ),
    );
    setCallTarget(null);
    setNotice(`Logged a call with ${who(lead)}.`);
  }

  async function runExport(kind: "xlsx" | "csv", scope: "all" | "view") {
    setExportOpen(false);
    setError(null);
    setNotice(null);
    setExporting(true);
    try {
      let records = await loadLeadsForExport(createBrowserSupabaseClient());
      let note = "All leads";
      if (scope === "view") {
        const order = new Map(filtered.map((l, i) => [l.id, i]));
        records = records.filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
        note = [
          stage ? `Stage: ${stageLabel(stage)}` : null,
          programId ? `Form: ${programs.find((p) => p.id === programId)?.title}` : null,
          search.trim() ? `Search: ${search.trim()}` : null,
        ]
          .filter(Boolean)
          .join("; ") || "Current view";
      }
      if (records.length === 0) {
        setNotice("Nothing to export. There are no leads in this scope.");
        return;
      }
      const filename = leadsExportFilename(scope === "all" ? "all" : note, kind);
      if (kind === "csv") downloadBlob(new Blob([buildLeadsCsv(records)], { type: "text/csv;charset=utf-8;" }), filename);
      else downloadBlob(buildLeadsWorkbook(records, note), filename);
      setNotice(`Exported ${records.length} ${records.length === 1 ? "lead" : "leads"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const column = (def: LeadStageDef) => (
    <StageColumn
      key={def.id}
      def={def}
      leads={columns.get(def.id) ?? []}
      dragOver={dragOverStage === def.id}
      onDragOverStage={(over) => setDragOverStage((cur) => (over ? def.id : cur === def.id ? null : cur))}
      onDropLead={(leadId) => moveLead(leadId, def.id)}
      onMove={moveLead}
      onLogCall={setCallTarget}
    />
  );

  const stageChip = (def: LeadStageDef) => (
    <button
      key={def.id}
      type="button"
      className="subs-toggle label-sm"
      aria-pressed={mobileStage === def.id}
      title={def.hint}
      onClick={() => setMobileStage(def.id)}
    >
      {def.label}
      <span className="data-sm" style={{ marginLeft: "var(--space-2)" }}>
        {columns.get(def.id)?.length ?? 0}
      </span>
    </button>
  );

  const mobileLeads = columns.get(mobileStage) ?? [];

  const cardGrid = (list: BoardLead[]) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(calc(var(--space-16) * 4), 1fr))", gap: "var(--space-3)" }}>
      {list.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          onMove={(next) => moveLead(lead.id, next)}
          selected={boardSelectable ? selected.has(lead.id) : undefined}
          onToggle={boardSelectable ? () => toggle(lead.id) : undefined}
          onLogCall={() => setCallTarget(lead)}
        />
      ))}
    </div>
  );

  const exportItems = [
    { kind: "xlsx", scope: "all", icon: FileSpreadsheet, title: `All leads, Excel (${leads.length})`, hint: "Summary, Leads, Stage history and Calls sheets" },
    { kind: "csv", scope: "all", icon: FileText, title: "All leads, CSV", hint: "One flat file, same columns as the Leads sheet" },
    ...(filtersActive
      ? [{ kind: "xlsx", scope: "view", icon: FileSpreadsheet, title: `Current view, Excel (${filtered.length})`, hint: "Only the leads matching your filters" }]
      : []),
  ] as const;

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)", paddingBottom: bulkVisible ? "calc(var(--space-16) * 2)" : undefined }}>
      <div className="flex items-start justify-between flex-wrap" style={{ gap: "var(--space-4)" }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="h1">Leads</h1>
          <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }} aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "lead" : "leads"}
            {filtersActive ? ` of ${leads.length}` : ""}. Every completed application becomes a lead automatically.
          </p>
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: "var(--space-3)" }}>
          <div className="dash-segment" role="group" aria-label="View">
            {(
              [
                { key: "list", icon: Rows3, label: "List" },
                { key: "board", icon: LayoutGrid, label: "Board" },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
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
              variant="secondary"
              iconLeft={<Download size={16} />}
              loading={exporting}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((v) => !v)}
            >
              Export
            </Button>
            {exportOpen && (
              <>
                <div className="subs-scrim" onClick={() => setExportOpen(false)} />
                <div className="subs-menu" role="menu">
                  <p className="caption subs-hint" style={{ padding: "var(--space-2) var(--space-3)", margin: 0 }}>
                    Includes contact details, stage, owner, effort score, source, every answer, the stage history and every call.
                  </p>
                  {exportItems.map(({ kind, scope, icon: Icon, title, hint }) => (
                    <button
                      key={`${kind}-${scope}`}
                      type="button"
                      role="menuitem"
                      className="subs-menuitem"
                      onClick={() => runExport(kind as "xlsx" | "csv", scope as "all" | "view")}
                    >
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

      <div className="flex items-end flex-wrap" style={{ gap: "var(--space-3)" }}>
        <div style={{ flex: "1 1 calc(var(--space-16) * 2.5)", minWidth: 0, maxWidth: 320 }}>
          <Input
            size="sm"
            label="Search"
            placeholder="Name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>
        <div style={{ flex: "1 1 calc(var(--space-16) * 2)", minWidth: 0, maxWidth: 220 }}>
          <Select
            size="sm"
            label="Stage"
            value={stage}
            options={[
              { value: "", label: `All stages (${scoped.length})` },
              ...ALL_LEAD_STAGES.map((s) => ({ value: s.id, label: `${s.label} (${stageCounts.get(s.id) ?? 0})` })),
            ]}
            onChange={(e) => {
              setStage(e.target.value as "" | LeadStage);
              if (e.target.value) setMobileStage(e.target.value as LeadStage);
              resetPage();
            }}
          />
        </div>
        {showForm && (
          <div style={{ flex: "1 1 calc(var(--space-16) * 2.5)", minWidth: 0, maxWidth: 260 }}>
            <Select
              size="sm"
              label="Form"
              value={programId}
              options={[{ value: "", label: "All forms" }, ...programs.map((p) => ({ value: p.id, label: p.title }))]}
              onChange={(e) => {
                setProgramId(e.target.value);
                resetPage();
              }}
            />
          </div>
        )}
        <div style={{ flex: "1 1 calc(var(--space-16) * 2)", minWidth: 0, maxWidth: 220 }}>
          <Select
            size="sm"
            label="Calls"
            value={callFilter}
            options={CALL_FILTERS}
            onChange={(e) => {
              setCallFilter(e.target.value);
              resetPage();
            }}
          />
        </div>
        {owners.length > 0 && (
          <div style={{ flex: "1 1 calc(var(--space-16) * 2)", minWidth: 0, maxWidth: 240 }}>
            <Select
              size="sm"
              label="Owner"
              value={ownerFilter}
              options={[{ value: "", label: "Any owner" }, { value: "none", label: "Unassigned" }, ...owners.map((o) => ({ value: o.id, label: o.label }))]}
              onChange={(e) => {
                setOwnerFilter(e.target.value);
                resetPage();
              }}
            />
          </div>
        )}
        <div style={{ flex: "1 1 calc(var(--space-16) * 2)", minWidth: 0, maxWidth: 220 }}>
          <Select size="sm" label="Sort" value={sort} options={SORTS} onChange={(e) => setSort(e.target.value)} />
        </div>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<X size={14} />}
            onClick={() => {
              setSearch("");
              setProgramId("");
              setStage("");
              setCallFilter("");
              setOwnerFilter("");
              resetPage();
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
      {notice && (
        <p className="body-sm" role="status" style={{ margin: 0, color: "var(--ink-muted)" }}>
          {notice}
        </p>
      )}

      {view === "list" ? (
        filtered.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
            {leads.length === 0 ? "No leads yet. Completed applications appear here." : "No leads match these filters."}
          </p>
        ) : (
          <>
            <div className="ffn-table-wrap" style={{ overflowX: "auto" }}>
              <table className="ffn-table">
                <caption className="ffn-sr">Leads matching the current filters</caption>
                <thead>
                  <tr>
                    <th style={{ width: "var(--space-10)" }}>
                      <Checkbox
                        label={<span className="ffn-sr">Select all {filtered.length} leads in this view</span>}
                        checked={allSelected}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>Name</th>
                    {showForm && <th className="max-lg:hidden">Form</th>}
                    <th>Stage</th>
                    <th style={{ textAlign: "center" }}>Effort</th>
                    <th>Calls</th>
                    <th className="max-md:hidden">Applied (IST)</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLeads.map((lead) => (
                    <tr key={lead.id} className={selected.has(lead.id) ? "ffn-table__row--selected" : undefined} data-testid={`lead-row-${lead.id}`}>
                      <td>
                        <Checkbox
                          label={<span className="ffn-sr">Select {who(lead)}</span>}
                          checked={selected.has(lead.id)}
                          onChange={() => toggle(lead.id)}
                        />
                      </td>
                      <td style={{ ...WRAP, minWidth: "calc(var(--space-16) * 2.25)" }}>
                        <Link href={`/admin/leads/${lead.id}`} className="label" style={{ color: "var(--ink)" }}>
                          {lead.name || lead.email || "Unknown"}
                        </Link>
                        {/* The wrapper carries the breakpoint: .ffn-table__sub sets its own display and would win over it. */}
                        {lead.name && lead.email && (
                          <span className="max-md:hidden">
                            <span className="ffn-table__sub" style={WRAP}>
                              {lead.email}
                            </span>
                          </span>
                        )}
                        <span className="md:hidden">
                          <span className="ffn-table__sub data-sm">{utcToIST(lead.createdAt).date}</span>
                        </span>
                        {ownerName(lead.ownerId) && (
                          <span className="ffn-table__sub" style={WRAP}>
                            Owner: {ownerName(lead.ownerId)}
                          </span>
                        )}
                      </td>
                      {showForm && (
                        <td className="body-sm max-lg:hidden" style={WRAP}>
                          {lead.programTitle}
                        </td>
                      )}
                      <td>
                        <StageBadge stage={lead.stage} />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <ScorePill score={lead.effortScore} band={lead.effortBand} />
                      </td>
                      <td>
                        <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                          <button
                            type="button"
                            className="call-quick"
                            aria-label={`Log a call with ${who(lead)}`}
                            title="Log a call"
                            onClick={() => setCallTarget(lead)}
                          >
                            <Phone size={14} strokeWidth={1.75} aria-hidden />
                          </button>
                          <span>
                            <span className="data-sm" style={{ display: "block", color: lead.callCount ? "var(--ink)" : "var(--ink-subtle)" }}>
                              {lead.callCount}
                            </span>
                            {lead.lastCallAt && (
                              <span className="caption max-md:hidden" style={{ display: "block", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                                {utcToIST(lead.lastCallAt).date}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="data-sm max-md:hidden" style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                        {utcToIST(lead.createdAt).date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between" style={{ gap: "var(--space-3)" }}>
                <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
                  {currentPage * PAGE_SIZE + 1} to {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Previous page"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                    iconLeft={<ChevronLeft size={14} />}
                  >
                    Previous
                  </Button>
                  <span className="data-sm" style={{ color: "var(--ink-muted)" }}>
                    {currentPage + 1} / {pageCount}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Next page"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                    iconRight={<ChevronRight size={14} />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )
      ) : stage ? (
        // One stage picked: its leads as a plain grid with tick boxes, on every screen size.
        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: "var(--space-3)" }}>
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
              <strong style={{ color: "var(--ink)" }}>{stageLabel(stage)}.</strong>{" "}
              {ALL_LEAD_STAGES.find((s) => s.id === stage)?.hint}
            </p>
            {filtered.length > 0 && (
              <Checkbox
                label={`Select all ${filtered.length}`}
                checked={allSelected}
                onChange={toggleAll}
              />
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
              No leads at this stage.
            </p>
          ) : (
            cardGrid(filtered)
          )}
        </div>
      ) : (
        <>
          {/* Desktop: every stage in one scrolling row, drag and drop between any
              two. The five on the path first, a divider, then the three off the path.
              Below lg the board would not fit a phone or tablet, so the
              single-stage tabs below replace it. */}
          <div
            className="hidden lg:flex"
            style={{ gap: "var(--space-4)", overflowX: "auto", paddingBottom: "var(--space-2)", alignItems: "stretch" }}
          >
            {PIPELINE_STAGES.map(column)}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Off the path: Nurture, Dormant and Lost"
              style={{ flex: "none", width: 1, background: "var(--border-strong)", margin: "0 var(--space-1)" }}
            />
            {OFF_PATH_STAGES.map(column)}
          </div>

          <div className="flex lg:hidden flex-col" style={{ gap: "var(--space-3)" }}>
            <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
              <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }} role="group" aria-label="Pipeline stages">
                {PIPELINE_STAGES.map(stageChip)}
              </div>
              <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)" }} role="group" aria-label="Off the path">
                <span className="eyebrow" style={{ color: "var(--ink-subtle)", textTransform: "uppercase" }}>
                  Off the path
                </span>
                {OFF_PATH_STAGES.map(stageChip)}
              </div>
            </div>
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
              <strong style={{ color: "var(--ink)" }}>{stageLabel(mobileStage)}.</strong>{" "}
              {ALL_LEAD_STAGES.find((s) => s.id === mobileStage)?.hint}
            </p>
            {mobileLeads.length === 0 ? (
              <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
                No leads at this stage.
              </p>
            ) : (
              cardGrid(mobileLeads)
            )}
          </div>
        </>
      )}

      {bulkVisible && (
        <div role="region" aria-label="Bulk actions" className="bulk-bar">
          <div className="bulk-bar__head">
            <p className="bulk-bar__count label">{selectedInView.length} selected</p>
            <button type="button" className="bulk-bar__clear caption" onClick={() => setSelected(new Set())}>
              Clear selection
            </button>
          </div>
          <div className="bulk-bar__body">
            <div className="bulk-bar__stages" role="group" aria-label="Move to stage">
              <span className="bulk-bar__label caption">Move to</span>
              {ALL_LEAD_STAGES.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  className="bulk-chip label-sm"
                  aria-pressed={bulkStage === def.id}
                  title={def.hint}
                  onClick={() => setBulkStage(bulkStage === def.id ? "" : def.id)}
                >
                  {def.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="bulk-bar__go"
              disabled={!bulkStage}
              loading={bulkBusy}
              onClick={() => setConfirmBulk(true)}
            >
              {bulkStage ? `Move to ${stageLabel(bulkStage)}` : "Choose a stage"}
            </Button>
          </div>
        </div>
      )}

      {callTarget && (
        <Modal title={`Log a call with ${who(callTarget)}`} onClose={() => setCallTarget(null)}>
          <CallForm
            leadId={callTarget.id}
            defaultStage={callTarget.stage}
            onCancel={() => setCallTarget(null)}
            onSaved={(draft) => onCallSaved(callTarget, draft)}
          />
        </Modal>
      )}

      {confirmBulk && bulkStage && (
        <Modal title={`Move ${selectedInView.length} ${selectedInView.length === 1 ? "lead" : "leads"} to ${stageLabel(bulkStage)}?`} onClose={() => setConfirmBulk(false)}>
          <p className="body" style={{ margin: 0 }}>
            Each lead is written to its stage history. If {stageLabel(bulkStage)} has an enabled email rule, that email is sent to every lead you move.
          </p>
          <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => setConfirmBulk(false)}>
              Cancel
            </Button>
            <Button onClick={moveSelected}>Move leads</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
