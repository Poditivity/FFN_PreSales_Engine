"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Input, Select, Textarea } from "@/components/ffn";
import { CALL_OUTCOMES, istToIso, nowInIST, saveCall, type CallDraft, type CallOutcome, type LeadCall } from "@/lib/leads/calls";
import { ALL_LEAD_STAGES, type LeadStage } from "@/lib/leads/schema";
import { utcToIST } from "@/lib/forms/ist";

/**
 * One call, as a form: the stage it was made at, how it went, when, what was
 * said and when to try again. Used on the lead's own page and in the quick-log
 * dialog on the leads list, so a call is recorded the same way in both.
 *
 * The stage starts as the lead's current stage and can be changed for a call
 * that is being logged late. The date and time start as now, in IST.
 */
export function CallForm({
  leadId,
  defaultStage,
  initial,
  submitLabel = "Log call",
  onSaved,
  onCancel,
}: {
  leadId: string;
  defaultStage: LeadStage;
  /** A call being edited. Without it the form logs a new one. */
  initial?: LeadCall;
  submitLabel?: string;
  onSaved: (draft: CallDraft) => void;
  onCancel?: () => void;
}) {
  const [stage, setStage] = useState<LeadStage>(initial?.stage ?? defaultStage);
  const [outcome, setOutcome] = useState<CallOutcome | null>(initial?.outcome ?? null);
  const [when, setWhen] = useState(() => (initial ? utcToIST(initial.called_at) : nowInIST()));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [followUp, setFollowUp] = useState(initial?.follow_up_on ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome) {
      setError("Pick how the call went.");
      return;
    }
    if (!when.date || !when.time) {
      setError("Enter the date and time of the call.");
      return;
    }
    const draft: CallDraft = {
      stage,
      outcome,
      calledAt: istToIso(when.date, when.time),
      notes,
      followUpOn: followUp || null,
    };
    setSaving(true);
    setError(null);
    const { error: saveError } = await saveCall(leadId, draft, initial?.id);
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onSaved(draft);
  }

  return (
    <form onSubmit={submit} className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div>
        <p className="label" id={`call-outcome-${leadId}`} style={{ margin: "0 0 var(--space-2)" }}>
          How did it go?
        </p>
        <div className="call-outcomes" role="radiogroup" aria-labelledby={`call-outcome-${leadId}`}>
          {CALL_OUTCOMES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={outcome === o.id}
              className="call-chip"
              data-tone={o.tone}
              onClick={() => setOutcome(o.id)}
            >
              {outcome === o.id && <Check size={14} strokeWidth={2} aria-hidden />}
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="call-form-grid">
        <Select
          label="Stage at the time of the call"
          value={stage}
          onChange={(e) => setStage(e.target.value as LeadStage)}
          options={ALL_LEAD_STAGES.map((s) => ({ value: s.id, label: s.label }))}
        />
        <Input label="Date (IST)" type="date" value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} required />
        <Input label="Time (IST)" type="time" value={when.time} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))} required />
      </div>

      <Textarea
        label="What was discussed"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional. What they said, what was agreed."
      />

      <div className="call-form-grid call-form-grid--2">
        <Input
          label="Follow up on"
          type="date"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          hint="Optional. When to call again."
        />
      </div>

      {error && (
        <Alert tone="danger" title="Could not save the call">
          {error}
        </Alert>
      )}

      <div className="flex items-center justify-end flex-wrap" style={{ gap: "var(--space-2)" }}>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
