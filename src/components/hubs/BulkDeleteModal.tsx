"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Modal } from "@/components/ffn";
import { deleteHub } from "@/lib/hubs/hubs";
import type { BulkTarget } from "./BulkSendModal";

/**
 * Deleting a hub kills its private link for good, so this asks once, plainly,
 * with the names in front of the admin, and keeps going if one row fails.
 */
export function BulkDeleteModal({
  hubs,
  onClose,
}: {
  hubs: (BulkTarget & { detail: string })[];
  /** Called with the ids that were deleted, so the list can drop them. */
  onClose: (deletedIds: string[]) => void;
}) {
  const [running, setRunning] = useState(false);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [failures, setFailures] = useState<{ name: string; error: string }[]>([]);
  const [finished, setFinished] = useState(false);

  async function run() {
    setRunning(true);
    const ok: string[] = [];
    const bad: { name: string; error: string }[] = [];
    for (const h of hubs) {
      try {
        await deleteHub(h.id);
        ok.push(h.id);
        setDeleted([...ok]);
      } catch (e) {
        bad.push({ name: h.name || "(no name)", error: e instanceof Error ? e.message : "Could not delete." });
        setFailures([...bad]);
      }
    }
    setRunning(false);
    if (bad.length === 0) onClose(ok);
    else setFinished(true);
  }

  return (
    <Modal
      title={`Delete ${hubs.length} hub${hubs.length === 1 ? "" : "s"}?`}
      onClose={() => !running && onClose(deleted)}
    >
      <p className="body" style={{ margin: 0 }}>
        Their private links stop working straight away, along with the open history behind them. This cannot be undone.
      </p>

      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
        {hubs.map((h) => (
          <div key={h.id} style={{ padding: "var(--space-2) var(--space-3)", borderBottom: "1px solid var(--border)" }}>
            <div className="body-sm">{h.name || "(no name)"}</div>
            <div className="caption" style={{ color: "var(--ink-muted)" }}>
              {h.detail || "—"}
            </div>
          </div>
        ))}
      </div>

      {running && (
        <p className="body-sm" role="status" style={{ margin: 0 }}>
          Deleting. <span className="data-sm">{deleted.length}</span> of <span className="data-sm">{hubs.length}</span>.
        </p>
      )}

      {failures.length > 0 && (
        <Alert tone="danger" title={`${deleted.length} deleted, ${failures.length} could not be deleted`}>
          {failures.map((f) => `${f.name} (${f.error})`).join("; ")}
        </Alert>
      )}

      <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
        <Button variant="secondary" onClick={() => onClose(deleted)} disabled={running}>
          {finished ? "Close" : "Cancel"}
        </Button>
        {!finished && (
          <Button variant="danger" iconLeft={<Trash2 size={15} />} loading={running} disabled={hubs.length === 0} onClick={run}>
            {`Delete ${hubs.length}`}
          </Button>
        )}
      </div>
    </Modal>
  );
}
