"use client";

import { Activity, Check, ExternalLink, LayoutTemplate, Link2, MessageCircle, Pencil, Plus, Search, Send, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select, Tooltip } from "@/components/ffn";
import { BulkDeleteModal } from "@/components/hubs/BulkDeleteModal";
import { BulkSendModal } from "@/components/hubs/BulkSendModal";
import { CreateHubModal } from "@/components/hubs/CreateHubModal";
import { HubActivityModal } from "@/components/hubs/HubActivityModal";
import { HUB_STATUS_TONE } from "@/components/hubs/hubStatus";
import type { Track } from "@/lib/content/types";
import { HUB_SORTS, matchesHubSearch, sortHubRows, type HubListRow, type HubSort } from "@/lib/hubs/hubList";
import { hubPreviewUrl, hubUrl, sendHub } from "@/lib/hubs/hubs";
import type { Hub } from "@/lib/hubs/types";
import { copyToClipboard, DEFAULT_HUB_MESSAGE, loadHubMessage, whatsappMessage } from "@/lib/messaging/whatsapp";

export interface LeadOption {
  id: string;
  name: string;
  email: string;
  programTitle: string;
  hasHub: boolean;
}

export function HubsManager({
  initialRows,
  leadOptions,
  tracks,
  startCreating = false,
}: {
  initialRows: HubListRow[];
  leadOptions: LeadOption[];
  tracks: Track[];
  /** Open the new-hub dialog on arrival (the dashboard's "New hub" action). */
  startCreating?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<HubSort>("opens");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickingFromApplication, setPickingFromApplication] = useState(false);
  const [creatingForLead, setCreatingForLead] = useState<LeadOption | null>(null);
  const [creatingStandalone, setCreatingStandalone] = useState(startCreating);
  const [viewingActivityId, setViewingActivityId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  // The Hub link message from Messaging, read ahead of the click: some browsers
  // refuse to copy once a request has run in between.
  const [hubMessage, setHubMessage] = useState(DEFAULT_HUB_MESSAGE);
  useEffect(() => {
    loadHubMessage().then(setHubMessage);
  }, []);

  const filtered = useMemo(() => {
    const base = rows.filter((r) => matchesHubSearch(r, query));
    return sortHubRows(base, sort);
  }, [rows, query, sort]);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someFilteredSelected = filtered.some((r) => selected.has(r.id));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Select all acts on what is on screen, so a search narrows what it picks up.
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (filtered.every((r) => next.has(r.id))) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  // WhatsApp is on hold: staff copy a message with the applicant's name and hub
  // link filled in, and paste it into WhatsApp themselves.
  async function copyMessage(row: HubListRow) {
    const ok = await copyToClipboard(whatsappMessage(hubMessage, row.applicant_name, row.token));
    if (!ok) {
      setError("Copying is not allowed in this browser. Use the copy link button instead.");
      return;
    }
    setError(null);
    setCopiedMessageId(row.id);
    setTimeout(() => setCopiedMessageId((current) => (current === row.id ? null : current)), 1500);
  }

  function copyLink(row: HubListRow) {
    const url = hubUrl(row.token);
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  async function send(row: HubListRow) {
    setSendingId(row.id);
    setError(null);
    const result = await sendHub(row.id);
    if (!result.ok) {
      setError(result.error ?? "Send failed");
    } else {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "sent" } : r)));
    }
    setSendingId(null);
  }

  function onHubCreated(hub: Hub) {
    setCreatingForLead(null);
    setCreatingStandalone(false);
    // Land on the hub that was just created and sent, whether or not it has a
    // lead behind it. The list below is still updated so Back shows it.
    router.push(`/admin/hubs/${hub.id}`);
    const trackName = tracks.find((t) => t.id === hub.track_id)?.name ?? "—";
    setRows((prev) => [
      {
        id: hub.id,
        token: hub.token,
        status: hub.status,
        open_count: hub.open_count,
        last_opened_at: hub.last_opened_at,
        first_opened_at: hub.first_opened_at,
        updated_at: hub.updated_at,
        lead_id: hub.lead_id,
        applicant_name: hub.applicant_name ?? "",
        applicant_email: hub.applicant_email ?? "",
        applicant_whatsapp: hub.applicant_whatsapp ?? "",
        track_name: trackName,
      },
      ...prev,
    ]);
  }

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 className="h1">Applicant Hubs</h1>
        <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
          A personalized page for each applicant, assembled by track from your content library. Send the private link
          by email.
        </p>
      </div>

      <div
        className="flex items-center justify-between flex-wrap"
        style={{ gap: "var(--space-3)", marginBottom: "var(--space-4)" }}
      >
        <div className="flex items-center flex-wrap" style={{ gap: "var(--space-3)" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-subtle)" }}
            />
            <Input
              aria-label="Search applicants"
              placeholder="Search applicants…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 34, minWidth: 220 }}
            />
          </div>
          <Select
            aria-label="Sort applicants"
            value={sort}
            options={HUB_SORTS.map((s) => ({ value: s.value, label: s.label }))}
            onChange={(e) => setSort(e.target.value as HubSort)}
            style={{ minWidth: 170 }}
          />
        </div>
        <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
          <Button variant="secondary" iconLeft={<LayoutTemplate size={15} />} onClick={() => router.push("/admin/hub-templates")}>
            Templates
          </Button>
          <Button variant="secondary" iconLeft={<UserPlus size={15} />} onClick={() => setPickingFromApplication(true)}>
            From application
          </Button>
          <Button iconLeft={<Plus size={15} />} onClick={() => setCreatingStandalone(true)}>
            New hub
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {selected.size > 0 && (
        <div
          className="flex items-center justify-between flex-wrap"
          role="region"
          aria-label="Selected applicants"
          style={{
            gap: "var(--space-3)",
            background: "var(--surface-inverse)",
            color: "var(--on-inverse)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-3) var(--space-4)",
            marginBottom: "var(--space-4)",
          }}
        >
          <span className="body">
            <span className="data">{selected.size}</span> selected
          </span>
          <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" size="sm" iconLeft={<Send size={14} />} onClick={() => setBulkSendOpen(true)}>
              Send again
            </Button>
            <Button variant="danger" size="sm" iconLeft={<Trash2 size={14} />} onClick={() => setBulkDeleteOpen(true)}>
              Delete
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title={rows.length === 0 ? "No hubs yet" : "No hubs match your search"} />
      ) : (
        <Card flush>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: "var(--space-10)", textAlign: "center", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border)" }}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="hubs-check"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      aria-label={allFilteredSelected ? "Clear selection" : "Select all applicants"}
                      title={allFilteredSelected ? "Clear selection" : "Select all shown"}
                    />
                  </th>
                  {["Applicant", "Track", "Status", "Opens", "Updated", ""].map((h) => (
                    <th
                      key={h}
                      className={`eyebrow${h === "Track" || h === "Updated" ? " max-md:hidden" : ""}`}
                      style={{
                        textAlign: h === "" ? "right" : "left",
                        padding: "var(--space-3) var(--space-4)",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--ink-muted)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    data-testid={`hub-row-${row.id}`}
                    style={selected.has(row.id) ? { background: "var(--surface-selected)" } : undefined}
                  >
                    <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        className="hubs-check"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`Select ${row.applicant_name || "applicant"}`}
                      />
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border)" }}>
                      <Link href={`/admin/hubs/${row.id}`} style={{ color: "var(--ink)" }}>
                        <div className="body-medium">{row.applicant_name || "(no name)"}</div>
                        <div className="caption" style={{ color: "var(--ink-muted)" }}>
                          {row.applicant_email || row.applicant_whatsapp || "—"}
                        </div>
                      </Link>
                    </td>
                    <td className="max-md:hidden" style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border)" }}>
                      <Badge tone="neutral" dot={false}>
                        {row.track_name}
                      </Badge>
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border)" }}>
                      <Badge tone={HUB_STATUS_TONE[row.status]} dot={false}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="body-sm" style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border)" }}>
                      {row.open_count}
                    </td>
                    <td
                      className="caption max-md:hidden"
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--ink-muted)",
                      }}
                    >
                      {new Date(row.updated_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                      <div className="flex items-center justify-end" style={{ gap: "var(--space-1)" }}>
                        <Tooltip label="Copy the hub link" className="max-md:hidden">
                          <Button variant="ghost" size="sm" aria-label="Copy link" onClick={() => copyLink(row)}>
                            <Link2 size={15} />
                          </Button>
                        </Tooltip>
                        <Tooltip label="View activity: opens, sections read and sends" className="max-md:hidden">
                          <Button variant="ghost" size="sm" aria-label="View activity" onClick={() => setViewingActivityId(row.id)}>
                            <Activity size={15} />
                          </Button>
                        </Tooltip>
                        <Tooltip label="Preview the hub in a new tab. Not counted as an open" className="max-md:hidden">
                          <a href={hubPreviewUrl(row.token)} target="_blank" rel="noreferrer" aria-label="Open preview">
                            <Button variant="ghost" size="sm" tabIndex={-1}>
                              <ExternalLink size={15} />
                            </Button>
                          </a>
                        </Tooltip>
                        <Tooltip label={row.status === "draft" ? "Send the hub link by email" : "Send the hub link by email again"}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={row.status === "draft" ? "Send" : "Send again"}
                            onClick={() => send(row)}
                            loading={sendingId === row.id}
                          >
                            <Send size={15} />
                          </Button>
                        </Tooltip>
                        <Tooltip label={copiedMessageId === row.id ? "Message copied" : "Copy WhatsApp message with the hub link"}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={copiedMessageId === row.id ? "Message copied" : "Copy WhatsApp message"}
                            onClick={() => copyMessage(row)}
                          >
                            {copiedMessageId === row.id ? <Check size={15} /> : <MessageCircle size={15} />}
                          </Button>
                        </Tooltip>
                        <Tooltip label="Open the hub to edit it">
                          <Link href={`/admin/hubs/${row.id}`} aria-label="Edit">
                            <Button variant="ghost" size="sm" tabIndex={-1}>
                              <Pencil size={15} />
                            </Button>
                          </Link>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pickingFromApplication && (
        <LeadPickerModal
          leadOptions={leadOptions.filter((l) => !l.hasHub)}
          emptyMessage="Every application already has a hub."
          onClose={() => setPickingFromApplication(false)}
          onPick={(lead) => {
            setPickingFromApplication(false);
            setCreatingForLead(lead);
          }}
        />
      )}

      {creatingForLead && (
        <CreateHubModal
          leadId={creatingForLead.id}
          tracks={tracks}
          onClose={() => setCreatingForLead(null)}
          onCreated={onHubCreated}
        />
      )}

      {creatingStandalone && (
        <CreateHubModal leadId={null} tracks={tracks} onClose={() => setCreatingStandalone(false)} onCreated={onHubCreated} />
      )}

      {bulkSendOpen && (
        <BulkSendModal
          hubs={selectedRows.map((r) => ({ id: r.id, name: r.applicant_name, email: r.applicant_email }))}
          onClose={(sentIds) => {
            setBulkSendOpen(false);
            if (sentIds.length > 0) {
              const sent = new Set(sentIds);
              // hub-send only moves a draft to sent; sent and opened hubs keep their status.
              setRows((prev) => prev.map((r) => (sent.has(r.id) && r.status === "draft" ? { ...r, status: "sent" } : r)));
            }
          }}
        />
      )}

      {bulkDeleteOpen && (
        <BulkDeleteModal
          hubs={selectedRows.map((r) => ({
            id: r.id,
            name: r.applicant_name,
            email: r.applicant_email,
            detail: r.applicant_email || r.applicant_whatsapp,
          }))}
          onClose={(deletedIds) => {
            setBulkDeleteOpen(false);
            if (deletedIds.length === 0) return;
            const gone = new Set(deletedIds);
            setRows((prev) => prev.filter((r) => !gone.has(r.id)));
            setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
            // Re-read the server props so a lead whose hub was deleted can be picked again.
            router.refresh();
          }}
        />
      )}

      {viewingActivityId && <HubActivityModal hubId={viewingActivityId} onClose={() => setViewingActivityId(null)} />}
    </div>
  );
}

function LeadPickerModal({
  leadOptions,
  emptyMessage,
  onClose,
  onPick,
}: {
  leadOptions: LeadOption[];
  emptyMessage: string;
  onClose: () => void;
  onPick: (lead: LeadOption) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leadOptions;
    return leadOptions.filter((l) => [l.name, l.email].some((v) => v.toLowerCase().includes(q)));
  }, [leadOptions, query]);

  return (
    <Modal title="Create hub from an application" onClose={onClose} wide>
      <Input
        aria-label="Find an applicant"
        placeholder="Search applicants…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", textAlign: "center", padding: "var(--space-4) 0" }}>
          {leadOptions.length === 0 ? emptyMessage : "No applicants match your search."}
        </p>
      ) : (
        <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-2) var(--space-3)", borderBottom: "1px solid var(--border)" }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="body-medium">{lead.name || "(no name)"}</div>
                <div className="caption" style={{ color: "var(--ink-muted)" }}>
                  {lead.email || "—"} · {lead.programTitle}
                </div>
              </div>
              <Button size="sm" onClick={() => onPick(lead)}>
                Create hub
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
