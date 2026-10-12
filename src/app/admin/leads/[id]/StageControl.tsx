"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ffn";
import { callsWord } from "@/lib/leads/calls";
import { moveLeadToStage } from "@/lib/leads/moveStage";
import { OFF_PATH_STAGES, PIPELINE_STAGES, type LeadStage, type LeadStageDef } from "@/lib/leads/schema";

/**
 * Where an admin moves a lead from its own page. The five stages on the path
 * run left to right, the three off the path sit apart. Any stage can be picked from any
 * other, in any order. Every move is written to the stage history and, if the
 * new stage has an email rule, sends that email.
 */
export function StageControl({
  leadId,
  stage,
  callsByStage = {},
}: {
  leadId: string;
  stage: LeadStage;
  /** Calls logged at each stage, shown under the stage name. */
  callsByStage?: Partial<Record<LeadStage, number>>;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<LeadStage>(stage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);

  async function change(next: LeadStage, label: string) {
    if (next === current || saving) return;
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError(null);
    setMoved(null);
    const { error: moveError } = await moveLeadToStage(leadId, next);
    setSaving(false);
    if (moveError) {
      setCurrent(previous);
      setError(moveError);
      return;
    }
    setMoved(label);
    // Re-read the page so the header, the stage history and the timing are current.
    router.refresh();
  }

  const pathIndex = PIPELINE_STAGES.findIndex((s) => s.id === current);

  const step = (def: LeadStageDef, index: number | null) => {
    const active = def.id === current;
    const done = index !== null && pathIndex >= 0 && index < pathIndex;
    return (
      <button
        key={def.id}
        type="button"
        className="lead-step"
        aria-pressed={active}
        aria-label={`${def.label}. ${def.hint}`}
        title={def.hint}
        disabled={saving}
        data-done={done || undefined}
        onClick={() => change(def.id, def.label)}
      >
        <span className="lead-step__mark data-sm" aria-hidden="true">
          {done ? <Check size={13} strokeWidth={2} /> : index !== null ? index + 1 : "-"}
        </span>
        <span className="lead-step__text">
          <span className="lead-step__label label">{def.label}</span>
          {callsByStage[def.id] ? (
            <span className="lead-step__calls caption">{callsWord(callsByStage[def.id] ?? 0)}</span>
          ) : null}
        </span>
      </button>
    );
  };

  return (
    <div>
      <div className="lead-steps" role="group" aria-label="Pipeline stage">
        {PIPELINE_STAGES.map((def, i) => step(def, i))}
        <span className="lead-steps__gap" role="separator" aria-label="Off the path" />
        {OFF_PATH_STAGES.map((def) => step(def, null))}
      </div>
      <p className="caption" role="status" style={{ margin: "var(--space-2) 0 0", color: "var(--ink-muted)", minHeight: 16 }}>
        {saving ? "Moving" : moved ? `Moved to ${moved}.` : PIPELINE_STAGES.concat(OFF_PATH_STAGES).find((s) => s.id === current)?.hint}
      </p>
      {error && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <Alert tone="danger" title="Move failed">
            {error}
          </Alert>
        </div>
      )}
    </div>
  );
}
