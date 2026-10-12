"use client";

import { Activity, ExternalLink, Link2, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, RowsSkeleton, Tooltip } from "@/components/ffn";
import { CreateHubModal } from "@/components/hubs/CreateHubModal";
import { EditContextModal } from "@/components/hubs/EditContextModal";
import { HubActivityModal } from "@/components/hubs/HubActivityModal";
import { HUB_STATUS_TONE } from "@/components/hubs/hubStatus";
import type { Track } from "@/lib/content/types";
import { hubPreviewUrl, hubUrl, listHubsForLead, sendHub } from "@/lib/hubs/hubs";
import type { Hub } from "@/lib/hubs/types";

export function ProofHubCard({ leadId, tracks }: { leadId: string; tracks: Track[] }) {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingContext, setEditingContext] = useState<Hub | null>(null);
  const [viewingActivityId, setViewingActivityId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listHubsForLead(leadId)
      .then(setHubs)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load hubs"))
      .finally(() => setLoading(false));
  }, [leadId]);

  async function send(hub: Hub) {
    setSendingId(hub.id);
    setError(null);
    const result = await sendHub(hub.id);
    if (!result.ok) {
      setError(result.error ?? "Send failed");
    } else {
      setHubs((prev) => prev.map((h) => (h.id === hub.id ? { ...h, status: "sent" } : h)));
    }
    setSendingId(null);
  }

  function copyLink(hub: Hub) {
    navigator.clipboard?.writeText(hubUrl(hub.token)).catch(() => {});
    setCopiedId(hub.id);
    setTimeout(() => setCopiedId((current) => (current === hub.id ? null : current)), 1500);
  }

  return (
    <Card title="Proof hub" subtitle="A personalized, track-filtered page for this lead.">
      {loading ? (
        <RowsSkeleton rows={1} label="Loading the hub" />
      ) : hubs.length === 0 ? (
        <EmptyState title="No hub yet" />
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          {hubs.map((hub) => (
            <div
              key={hub.id}
              className="flex items-center justify-between flex-wrap"
              style={{ gap: "var(--space-3)", padding: "var(--space-2) 0" }}
            >
              <div>
                <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                  <Badge tone={HUB_STATUS_TONE[hub.status]} dot={false}>
                    {hub.status}
                  </Badge>
                  <a href={hubPreviewUrl(hub.token)} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="sm" iconLeft={<ExternalLink size={15} />}>
                      Preview
                    </Button>
                  </a>
                </div>
                <p className="caption" style={{ color: "var(--ink-muted)", marginTop: "var(--space-2)" }}>
                  Opened {hub.open_count} time{hub.open_count === 1 ? "" : "s"}. Preview is not counted.
                </p>
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                <Tooltip label={copiedId === hub.id ? "Link copied" : "Copy the link to send to the applicant"}>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={copiedId === hub.id ? "Link copied" : "Copy link"}
                    onClick={() => copyLink(hub)}
                  >
                    <Link2 size={14} />
                  </Button>
                </Tooltip>
                <Tooltip label="View activity: opens, sections read and sends">
                  <Button variant="ghost" size="sm" aria-label="View activity" onClick={() => setViewingActivityId(hub.id)}>
                    <Activity size={14} />
                  </Button>
                </Tooltip>
                <Tooltip label="Edit the startup, stage and context shown at the top of the hub">
                  <Button variant="ghost" size="sm" aria-label="Edit lead context" onClick={() => setEditingContext(hub)}>
                    <Pencil size={14} />
                  </Button>
                </Tooltip>
                {hub.status === "draft" && (
                  <Button size="sm" onClick={() => send(hub)} loading={sendingId === hub.id}>
                    Send
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      <div style={{ marginTop: "var(--space-3)" }}>
        <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setCreating(true)} disabled={tracks.length === 0}>
          Create hub
        </Button>
      </div>

      {creating && (
        <CreateHubModal
          leadId={leadId}
          tracks={tracks}
          onClose={() => setCreating(false)}
          onCreated={(hub) => {
            setHubs((prev) => [hub, ...prev]);
            setCreating(false);
          }}
        />
      )}

      {editingContext && (
        <EditContextModal
          hub={editingContext}
          onClose={() => setEditingContext(null)}
          onSaved={(hub) => {
            setHubs((prev) => prev.map((h) => (h.id === hub.id ? hub : h)));
            setEditingContext(null);
          }}
        />
      )}

      {viewingActivityId && <HubActivityModal hubId={viewingActivityId} onClose={() => setViewingActivityId(null)} />}
    </Card>
  );
}
