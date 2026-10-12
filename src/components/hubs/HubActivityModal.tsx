"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, Modal } from "@/components/ffn";
import { formatIST } from "@/lib/forms/ist";
import { computeInterest, computeTimeline, getHubEvents, type ItemNames } from "@/lib/hubs/engagement";
import { getHub } from "@/lib/hubs/hubs";
import { loadItemsByType } from "@/lib/hubs/pickerItems";
import { EngagementSummary, VisitTimeline } from "./HubActivityPanels";

// Per-hub activity, the same view build-fellowship shows on a hub: a plain
// summary of what the applicant did, time by section, and a visit-by-visit
// timeline with founders, case studies and links named. Shared by the
// admin-wide Hubs list and the per-lead Proof hub card, and built from the
// same panels as the hub detail page.
export function HubActivityModal({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const events = useQuery({ queryKey: ["hub-events", hubId], queryFn: () => getHubEvents(hubId), refetchOnWindowFocus: false });
  const hub = useQuery({ queryKey: ["hub", hubId], queryFn: () => getHub(hubId), refetchOnWindowFocus: false });
  // Names are a nicety: without them a view still reads "Viewed a founder".
  const items = useQuery({ queryKey: ["hub-picker-items"], queryFn: loadItemsByType, staleTime: 60_000 });

  const itemNames: ItemNames = {};
  for (const [type, options] of Object.entries(items.data ?? {})) {
    itemNames[type] = Object.fromEntries(options.map((o) => [o.id, o.label]));
  }

  const h = hub.data;
  return (
    <Modal title="Hub activity" onClose={onClose} wide>
      {events.error && (
        <Alert tone="danger" title="Something went wrong">
          {events.error instanceof Error ? events.error.message : "Could not load activity"}
        </Alert>
      )}

      {!events.error && !events.data && (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          Loading
        </p>
      )}

      {events.data && (
        <>
          {h && (
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
              <span className="data-sm">{h.open_count}</span> {h.open_count === 1 ? "open" : "opens"}
              {h.last_opened_at && (
                <>
                  , last opened <span className="data-sm">{formatIST(h.last_opened_at)}</span>
                </>
              )}
            </p>
          )}
          <EngagementSummary interest={computeInterest(events.data, itemNames)} />
          <div>
            <h3 className="h3" style={{ marginBottom: "var(--space-3)" }}>
              Activity timeline
            </h3>
            <VisitTimeline visits={computeTimeline(events.data, itemNames)} />
          </div>
        </>
      )}
    </Modal>
  );
}
