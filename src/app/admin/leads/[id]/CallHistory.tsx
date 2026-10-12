"use client";

import { Pencil, Phone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, StageBadge } from "@/components/ffn";
import { CallForm } from "@/components/leads/CallForm";
import { formatIST } from "@/lib/forms/ist";
import { callerName, deleteCall, outcomeLabel, CALL_OUTCOMES, type LeadCall } from "@/lib/leads/calls";
import type { LeadStage } from "@/lib/leads/schema";

/**
 * Every call made to this lead, newest first, with the stage each was made at.
 * The person who logged a call can edit or delete it; a super admin can change
 * anyone's. The database enforces the same rule, so the buttons only hide what
 * would be refused.
 */
export function CallHistory({
  leadId,
  stage,
  calls,
  currentUserId,
  isSuperAdmin,
}: {
  leadId: string;
  stage: LeadStage;
  calls: LeadCall[];
  currentUserId: string | null;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    setError(null);
    const { error: deleteError } = await deleteCall(id);
    setBusy(null);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    setConfirming(null);
    router.refresh();
  }

  return (
    <Card title="Call history" subtitle={calls.length === 0 ? undefined : `${calls.length} ${calls.length === 1 ? "call" : "calls"} logged for this lead.`}>
      {error && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <Alert tone="danger" title="Could not change the call">
            {error}
          </Alert>
        </div>
      )}
      {calls.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          No calls yet. Use Log a call above after you speak to this lead.
        </p>
      ) : (
        <ol className="call-list">
          {calls.map((call) => {
            const canChange = isSuperAdmin || (currentUserId !== null && call.called_by === currentUserId);
            const tone = CALL_OUTCOMES.find((o) => o.id === call.outcome)?.tone ?? "neutral";
            return (
              <li key={call.id} className="call-item">
                {editing === call.id ? (
                  <CallForm
                    leadId={leadId}
                    defaultStage={stage}
                    initial={call}
                    submitLabel="Save changes"
                    onCancel={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null);
                      router.refresh();
                    }}
                  />
                ) : (
                  <>
                    <span className="call-item__icon" aria-hidden="true">
                      <Phone size={15} strokeWidth={1.75} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
                        <Badge tone={tone}>{outcomeLabel(call.outcome)}</Badge>
                        <span className="caption" style={{ color: "var(--ink-muted)" }}>
                          at
                        </span>
                        <StageBadge stage={call.stage} />
                      </div>
                      <p className="caption" style={{ margin: "var(--space-1) 0 0", color: "var(--ink-muted)" }}>
                        {formatIST(call.called_at)} · {callerName(call)}
                      </p>
                      {call.notes && (
                        <p className="body-sm" style={{ margin: "var(--space-2) 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                          {call.notes}
                        </p>
                      )}
                      {call.follow_up_on && (
                        <p className="caption" style={{ margin: "var(--space-2) 0 0", color: "var(--ink-muted)" }}>
                          Follow up on <span className="data-sm">{call.follow_up_on}</span>
                        </p>
                      )}
                      {confirming === call.id && (
                        <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                          <span className="body-sm">Delete this call?</span>
                          <Button size="sm" variant="danger" loading={busy === call.id} onClick={() => remove(call.id)}>
                            Delete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy === call.id}>
                            Keep
                          </Button>
                        </div>
                      )}
                    </div>
                    {canChange && confirming !== call.id && (
                      <div className="flex" style={{ gap: "var(--space-1)" }}>
                        <Button size="sm" variant="ghost" aria-label="Edit call" onClick={() => setEditing(call.id)}>
                          <Pencil size={15} />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label="Delete call" onClick={() => setConfirming(call.id)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
