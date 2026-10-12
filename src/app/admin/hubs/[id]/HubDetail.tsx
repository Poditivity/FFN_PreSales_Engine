"use client";

// One hub, opened from the Hubs list. Ported from build-fellowship's HubDetail
// page: who it is for, the page blocks (shared template or customized), what
// the applicant did on it (engagement summary, time by section, a visit
// timeline) and every time it was sent.

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Link2, RotateCcw, Save, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select } from "@/components/ffn";
import { EngagementSummary, VisitTimeline } from "@/components/hubs/HubActivityPanels";
import { ModuleComposer, normalizeModules } from "@/components/hubs/ModuleComposer";
import { HUB_STATUS_TONE } from "@/components/hubs/hubStatus";
import type { Track } from "@/lib/content/types";
import { isValidEmail } from "@/lib/forms/formLogic";
import { formatIST } from "@/lib/forms/ist";
import { computeInterest, computeTimeline, getHubEvents, type ItemNames } from "@/lib/hubs/engagement";
import { deleteHub, getHubSends, hubPreviewUrl, hubUrl, updateHub, type HubUpdate } from "@/lib/hubs/hubs";
import type { HubIdentity } from "@/lib/hubs/identity";
import { loadItemsByType } from "@/lib/hubs/pickerItems";
import { listHubTemplatesForTrack } from "@/lib/hubs/templates";
import type { Hub, HubModule, HubStatus } from "@/lib/hubs/types";

const STATUS_OPTIONS: { value: HubStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "opened", label: "Opened" },
];

const SEND_STATUS_TONE: Record<string, "success" | "danger" | "neutral"> = { sent: "success", failed: "danger", skipped: "neutral" };

export function HubDetail({
  initialHub,
  identity,
  tracks,
}: {
  initialHub: Hub;
  identity: HubIdentity;
  tracks: Track[];
}) {
  const router = useRouter();
  const [hub, setHub] = useState(initialHub);
  const standalone = !hub.lead_id;

  const [meta, setMeta] = useState({
    applicant_name: hub.applicant_name ?? "",
    applicant_email: hub.applicant_email ?? "",
    applicant_whatsapp: hub.applicant_whatsapp ?? "",
    startup_name: hub.startup_name ?? "",
    founder_stage: hub.founder_stage ?? "",
    current_context: hub.current_context ?? "",
    track_id: hub.track_id,
    status: hub.status,
  });
  // null means the hub follows its template; an array means it was customized.
  const [modules, setModules] = useState<HubModule[] | null>(hub.modules);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const email = standalone ? hub.applicant_email ?? "" : identity.email;
  const displayName = standalone ? hub.applicant_name || "" : identity.name;

  const items = useQuery({ queryKey: ["hub-picker-items"], queryFn: loadItemsByType, staleTime: 60_000 });
  const events = useQuery({ queryKey: ["hub-events", hub.id], queryFn: () => getHubEvents(hub.id), refetchOnWindowFocus: false });
  const sends = useQuery({ queryKey: ["hub-sends", hub.id, email], queryFn: () => getHubSends(hub.id, email), refetchOnWindowFocus: false });
  const templates = useQuery({
    queryKey: ["hub-templates-for-track", hub.track_id],
    queryFn: () => listHubTemplatesForTrack(hub.track_id),
  });
  const template = templates.data?.find((t) => t.id === hub.template_id) ?? templates.data?.[0] ?? null;

  const trackName = (id: string) => tracks.find((t) => t.id === id)?.name ?? "this track";
  const customized = modules !== null;

  const itemNames: ItemNames = {};
  if (items.data) {
    for (const [type, options] of Object.entries(items.data)) {
      itemNames[type] = Object.fromEntries(options.map((o) => [o.id, o.label]));
    }
  }
  const interest = events.data ? computeInterest(events.data, itemNames) : null;
  const timeline = events.data ? computeTimeline(events.data, itemNames) : [];

  function customize() {
    // A copy, so editing this hub can never touch the shared template.
    setModules(normalizeModules(structuredClone(template?.modules ?? [])));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const patch: HubUpdate = {
        status: meta.status,
        startup_name: meta.startup_name.trim() || null,
        founder_stage: meta.founder_stage.trim() || null,
        current_context: meta.current_context.trim() || null,
        modules,
      };
      if (standalone) {
        if (!meta.applicant_name.trim()) throw new Error("A name is required.");
        if (!meta.applicant_email.trim()) throw new Error("An email is required to send a standalone hub.");
        if (!isValidEmail(meta.applicant_email)) throw new Error("Enter a valid email address.");
        patch.applicant_name = meta.applicant_name.trim();
        patch.applicant_email = meta.applicant_email.trim();
        patch.applicant_whatsapp = meta.applicant_whatsapp.trim() || null;
      }
      // Switching track switches which template the hub follows.
      if (meta.track_id !== hub.track_id) {
        const forTrack = await listHubTemplatesForTrack(meta.track_id);
        if (forTrack.length === 0) {
          throw new Error(`${trackName(meta.track_id)} has no template yet. Create one under Hub templates first.`);
        }
        patch.track_id = meta.track_id;
        patch.template_id = forTrack[0].id;
      }
      setHub(await updateHub(hub.id, patch));
      setNotice("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await deleteHub(hub.id);
      router.push("/admin/hubs");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }

  function copyLink() {
    const url = hubUrl(hub.token);
    navigator.clipboard?.writeText(url).then(
      () => setNotice("Link copied."),
      () => setNotice(url),
    );
  }

  return (
    <div>
      <Link href="/admin/hubs">
        <Button variant="secondary" size="sm" iconLeft={<ArrowLeft size={15} />}>
          All hubs
        </Button>
      </Link>

      <div className="flex items-start justify-between flex-wrap" style={{ gap: "var(--space-4)", margin: "var(--space-4) 0 var(--space-5)" }}>
        <div>
          <h1 className="h1">{displayName || "(no name)"}</h1>
          <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <Badge tone={HUB_STATUS_TONE[hub.status]} dot={false}>
              {STATUS_OPTIONS.find((s) => s.value === hub.status)?.label ?? hub.status}
            </Badge>
            <span className="body-sm" style={{ color: "var(--ink-muted)" }}>
              <span className="data-sm">{hub.open_count}</span> {hub.open_count === 1 ? "open" : "opens"}
              {hub.last_opened_at && (
                <>
                  , last <span className="data-sm">{formatIST(hub.last_opened_at)}</span>
                </>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
          <Button variant="secondary" iconLeft={<Link2 size={15} />} onClick={copyLink}>
            Copy link
          </Button>
          <a href={hubPreviewUrl(hub.token)} target="_blank" rel="noreferrer">
            <Button variant="secondary" iconLeft={<ExternalLink size={15} />}>
              Preview
            </Button>
          </a>
          <Button iconLeft={<Save size={15} />} loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          {error ? (
            <Alert tone="danger" title="Something went wrong">
              {error}
            </Alert>
          ) : (
            <Alert tone="success" title={notice!} />
          )}
        </div>
      )}

      <div className="hub-detail-grid">
        <div className="flex flex-col" style={{ gap: "var(--space-5)", minWidth: 0 }}>
          {/* Page blocks */}
          <Card
            title="Page blocks"
            subtitle={
              customized
                ? "Customized for this applicant."
                : `Following the ${template ? `${template.name} ` : ""}${trackName(hub.track_id)} template.`
            }
            actions={
              customized ? (
                <Button variant="secondary" size="sm" iconLeft={<RotateCcw size={14} />} onClick={() => setModules(null)}>
                  Reset to template
                </Button>
              ) : (
                <Button variant="secondary" size="sm" iconLeft={<Wand2 size={14} />} onClick={customize} disabled={!template}>
                  Customize this hub
                </Button>
              )
            }
          >
            {customized ? (
              items.data ? (
                <ModuleComposer value={modules} onChange={setModules} itemsByType={items.data} />
              ) : (
                <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
                  Loading content
                </p>
              )
            ) : (
              <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
                This hub uses the shared template, so template edits reach it automatically. Customize it to change the
                blocks for this applicant only. Select Save changes after customizing.
              </p>
            )}
          </Card>

          {/* Engagement */}
          <Card
            title="Engagement"
            subtitle={
              <>
                <span className="data-sm">{hub.open_count}</span> {hub.open_count === 1 ? "open" : "opens"}
                {hub.last_opened_at && (
                  <>
                    , last opened <span className="data-sm">{formatIST(hub.last_opened_at)}</span>
                  </>
                )}
              </>
            }
          >
            {events.error ? (
              <Alert tone="danger" title="Could not load engagement">
                {events.error instanceof Error ? events.error.message : "Try again in a moment."}
              </Alert>
            ) : !interest ? (
              <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
                Loading engagement
              </p>
            ) : (
              <EngagementSummary interest={interest} />
            )}
          </Card>

          {/* Activity timeline: exact and chronological, what to open the call with */}
          <Card title="Activity timeline" flush={timeline.length === 0}>
            <VisitTimeline visits={timeline} />
          </Card>

          {/* Send history */}
          <Card title="Send history" flush>
            {sends.error ? (
              <div style={{ padding: "var(--space-4)" }}>
                <Alert tone="danger" title="Could not load send history">
                  {sends.error instanceof Error ? sends.error.message : "Try again in a moment."}
                </Alert>
              </div>
            ) : !sends.data ? (
              <p className="body-sm" style={{ color: "var(--ink-muted)", padding: "var(--space-4)", margin: 0 }}>
                Loading send history
              </p>
            ) : sends.data.length === 0 ? (
              <EmptyState title="Nothing sent yet" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ffn-table">
                  <caption className="ffn-sr">Every time this hub was sent</caption>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Channel</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sends.data.map((s) => (
                      <tr key={s.id}>
                        <td className="data-sm" style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                          {formatIST(s.at)}
                        </td>
                        <td className="body-sm">{s.channel === "email" ? "Email" : "WhatsApp"}</td>
                        <td>
                          <Badge tone={SEND_STATUS_TONE[s.status] ?? "neutral"}>{s.status.charAt(0).toUpperCase() + s.status.slice(1)}</Badge>
                        </td>
                        <td className="body-sm" style={{ color: "var(--ink-muted)" }}>
                          {s.detail || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Applicant */}
        <Card title="Applicant">
          <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
            {standalone ? (
              <>
                <Input label="Name" required value={meta.applicant_name} onChange={(e) => setMeta({ ...meta, applicant_name: e.target.value })} />
                <Input label="Email" type="email" required value={meta.applicant_email} onChange={(e) => setMeta({ ...meta, applicant_email: e.target.value })} />
                <Input label="WhatsApp number" placeholder="9876543210" value={meta.applicant_whatsapp} onChange={(e) => setMeta({ ...meta, applicant_whatsapp: e.target.value })} />
              </>
            ) : (
              <>
                <Input label="Name" value={identity.name} disabled readOnly />
                <Input label="Email" value={identity.email} disabled readOnly hint="Comes from the application, so edit it on the lead." />
                <Link href={`/admin/leads/${hub.lead_id}`} className="body-sm" style={{ color: "var(--brand)" }}>
                  Open the lead
                </Link>
              </>
            )}

            <Select
              label="Track"
              hint="Switching track changes which template and content the hub uses."
              value={meta.track_id}
              options={tracks.map((t) => ({ value: t.id, label: t.name }))}
              onChange={(e) => setMeta({ ...meta, track_id: e.target.value })}
            />
            <Select
              label="Status"
              value={meta.status}
              options={STATUS_OPTIONS}
              onChange={(e) => setMeta({ ...meta, status: e.target.value as HubStatus })}
            />

            <div className="eyebrow" style={{ color: "var(--ink-subtle)", textTransform: "uppercase" }}>
              Context for the welcome block
            </div>
            <Input label="Startup name" value={meta.startup_name} onChange={(e) => setMeta({ ...meta, startup_name: e.target.value })} />
            <Input label="Founder stage" value={meta.founder_stage} onChange={(e) => setMeta({ ...meta, founder_stage: e.target.value })} />
            <Input label="Current context or problem" value={meta.current_context} onChange={(e) => setMeta({ ...meta, current_context: e.target.value })} />

            <Button variant="danger" iconLeft={<Trash2 size={15} />} block onClick={() => setConfirmingDelete(true)}>
              Delete hub
            </Button>
          </div>
        </Card>
      </div>

      {confirmingDelete && (
        <Modal title="Delete this hub?" onClose={() => !deleting && setConfirmingDelete(false)}>
          <p className="body" style={{ margin: 0 }}>
            The private link stops working straight away, along with the open history behind it. This cannot be undone.
          </p>
          <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" iconLeft={<Trash2 size={15} />} loading={deleting} onClick={remove}>
              Delete hub
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
