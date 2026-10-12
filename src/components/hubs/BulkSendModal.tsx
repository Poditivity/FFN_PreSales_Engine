"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal } from "@/components/ffn";
import { sendHub } from "@/lib/hubs/hubs";

// Spacing between sends in a run. Every recipient goes through the same
// hub-send function as the single Send button, so send history and status stay
// identical however a hub was sent; the gap just keeps a long run from tripping
// a provider's rate limit.
const GAP_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RowStatus = "pending" | "working" | "sent" | "failed";

interface Row {
  id: string;
  name: string;
  status: RowStatus;
  note: string;
}

const STATUS_COLOR: Record<RowStatus, string> = {
  pending: "var(--ink-subtle)",
  working: "var(--ink-muted)",
  sent: "var(--success)",
  failed: "var(--danger)",
};

export interface BulkTarget {
  id: string;
  name: string;
  email: string;
}

/**
 * Send several hubs again in one go. One recipient failing never stops the run,
 * and every row ends with a word: Sent or a reason it was not.
 */
export function BulkSendModal({
  hubs,
  onClose,
}: {
  hubs: BulkTarget[];
  /** Called with the ids that were sent, so the list can refresh their status. */
  onClose: (sentIds: string[]) => void;
}) {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    hubs.map((h) => ({ id: h.id, name: h.name || "(no name)", status: "pending", note: "" })),
  );
  const stopRef = useRef(false);
  // A run in flight must not keep going if the modal unmounts.
  useEffect(() => () => void (stopRef.current = true), []);

  const sentIds = rows.filter((r) => r.status === "sent").map((r) => r.id);
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const started = running || finished;

  function patch(id: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  async function run() {
    stopRef.current = false;
    setRunning(true);
    setFinished(false);
    setRows((rs) => rs.map((r) => ({ ...r, status: "pending", note: "" })));
    for (let i = 0; i < hubs.length; i += 1) {
      if (stopRef.current) break;
      const hub = hubs[i];
      patch(hub.id, { status: "working", note: "Sending" });
      if (!hub.email) {
        patch(hub.id, { status: "failed", note: "No email on file." });
      } else {
        try {
          const result = await sendHub(hub.id);
          if (result.ok) patch(hub.id, { status: "sent", note: "Sent" });
          else patch(hub.id, { status: "failed", note: result.error ?? "Could not send." });
        } catch (e) {
          patch(hub.id, { status: "failed", note: e instanceof Error ? e.message : "Could not send." });
        }
      }
      if (i < hubs.length - 1 && !stopRef.current) await sleep(GAP_MS);
    }
    setRunning(false);
    setFinished(true);
  }

  return (
    <Modal
      title={`Send again to ${hubs.length} applicant${hubs.length === 1 ? "" : "s"}`}
      onClose={() => !running && onClose(sentIds)}
      wide
    >
      {!started && (
        <p className="body-sm" style={{ margin: 0, color: "var(--ink-muted)" }}>
          Each applicant gets the hub email again with their own private link. Where WhatsApp is set up, it goes out
          alongside the email. A hub that is already sent or opened keeps its status.
        </p>
      )}

      <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center"
            style={{ gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", borderBottom: "1px solid var(--border)" }}
          >
            <div className="body-sm ffn-grow ffn-truncate">{r.name}</div>
            <div className="data-sm" style={{ textAlign: "right", maxWidth: "55%", color: STATUS_COLOR[r.status] }}>
              {r.note || (r.status === "pending" ? "Waiting" : r.status)}
            </div>
          </div>
        ))}
      </div>

      {started && (
        <p className="body-sm" role="status" style={{ margin: 0 }}>
          {running ? "Sending. " : "Done. "}
          <span className="data-sm">{sentIds.length}</span> sent
          {failedCount ? (
            <>
              , <span className="data-sm">{failedCount}</span> failed
            </>
          ) : null}
          .
        </p>
      )}
      {finished && failedCount > 0 && (
        <Alert tone="warning" title="Some hubs were not sent">
          Fix the reason shown against each name, then select them and send again.
        </Alert>
      )}

      <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
        {running ? (
          <Button
            variant="secondary"
            onClick={() => {
              stopRef.current = true;
            }}
          >
            Stop
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => onClose(sentIds)}>
            {finished ? "Close" : "Cancel"}
          </Button>
        )}
        {!finished && (
          <Button onClick={run} loading={running} disabled={hubs.length === 0}>
            {`Send to ${hubs.length}`}
          </Button>
        )}
      </div>
    </Modal>
  );
}
