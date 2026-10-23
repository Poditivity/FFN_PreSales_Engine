"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Modal, Select } from "@/components/ffn";
import { FieldRenderer } from "@/components/forms/FieldRenderer";
import { uploadFormFile } from "@/lib/forms/fileUpload";
import { fileConfigOf } from "@/lib/forms/formLogic";
import { answerProblems, createManualLead, MANUAL_ENTRY_FIELDS, pickAnswers, questionsFor, routeProblems } from "@/lib/leads/manualLead";

export interface ManualLeadForm {
  id: string;
  title: string;
  schema: unknown;
}

// Mirrors the session ids applicants get; "manual-" marks a lead the team added.
const newSessionId = () => `manual-${crypto.randomUUID()}`;

/**
 * Adds a lead by hand. Choosing a form is optional: with one, the team answers that
 * form's questions as an applicant would (branches included); without one, a short
 * name, email, phone and notes form is used.
 */
export function ManualLeadModal({
  forms,
  onClose,
  onAdded,
}: {
  forms: ManualLeadForm[];
  onClose: () => void;
  onAdded: (leadId: string | null) => void;
}) {
  const [formId, setFormId] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [sessionId] = useState(newSessionId);

  const form = forms.find((f) => f.id === formId) ?? null;
  const fields = useMemo(() => (form ? questionsFor(form.schema, answers) : MANUAL_ENTRY_FIELDS), [form, answers]);

  function setAnswer(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setProblems((prev) => (prev[id] ? Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)) : prev));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || uploading > 0) return;
    const found = { ...answerProblems(fields, answers), ...(form ? routeProblems(form.schema, answers) : {}) };
    setProblems(found);
    if (Object.keys(found).length > 0) {
      setError("Check the highlighted answers.");
      return;
    }
    setError(null);
    setSaving(true);
    const { id, error: failed } = await createManualLead(formId, pickAnswers(fields, answers));
    setSaving(false);
    if (failed) {
      setError(failed);
      return;
    }
    onAdded(id);
  }

  return (
    <Modal title="Add a lead" wide onClose={onClose}>
      <form noValidate className="flex flex-col" style={{ gap: "var(--space-4)" }} onSubmit={submit}>
        <Select
          label="Form (optional)"
          hint={form ? "Answer the form's questions as the applicant would." : "Leave blank to add a lead with just a name, email, phone and notes."}
          value={formId}
          options={[{ value: "", label: "No form" }, ...forms.map((f) => ({ value: f.id, label: f.title }))]}
          onChange={(e) => {
            setFormId(e.target.value);
            setAnswers({});
            setProblems({});
            setError(null);
          }}
        />

        {form && fields.length === 0 && (
          <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
            This form has no questions yet.
          </p>
        )}

        {fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={answers[field.id]}
            error={problems[field.id]}
            onChange={(value) => setAnswer(field.id, value)}
            onBusyChange={(busy) => setUploading((n) => Math.max(0, n + (busy ? 1 : -1)))}
            onUploadFile={
              form
                ? (file) => uploadFormFile({ formId: form.id, fieldId: field.id, sessionId, file, config: fileConfigOf(field) })
                : undefined
            }
          />
        ))}

        {error && (
          <Alert tone="danger" title="Not added">
            {error}
          </Alert>
        )}

        <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={uploading > 0}>
            Add lead
          </Button>
        </div>
      </form>
    </Modal>
  );
}
