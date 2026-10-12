"use client";

import { ExternalLink, Plus, Star, X } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select } from "@/components/ffn";
import { AudiencePicker } from "@/components/content/AudiencePicker";
import { CasePdfField } from "@/components/content/CasePdfField";
import {
  createCaseStudy,
  deleteCaseStudy,
  setCaseStudyFounders,
  updateCaseStudy,
  type CaseStudyInput,
} from "@/lib/content/caseStudies";
import { VISIBILITY_OPTIONS, type CaseStudy, type Track } from "@/lib/content/types";
import { NOT_SAVED_SUMMARY, revealFirstError, validateCaseStudy, type FieldErrors } from "@/lib/content/validation";

interface FounderOption {
  id: string;
  name: string;
  startup_name: string | null;
}

const EMPTY: CaseStudyInput = {
  title: "",
  case_study_link: null,
  audience: [],
  featured: false,
  visibility: "draft",
  sort_order: 0,
};

export function CaseStudiesManager({
  initialCaseStudies,
  founders,
  tracks,
}: {
  initialCaseStudies: CaseStudy[];
  founders: FounderOption[];
  tracks: Track[];
}) {
  const [caseStudies, setCaseStudies] = useState(initialCaseStudies);
  const [editing, setEditing] = useState<CaseStudy | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(cs: CaseStudy) {
    if (!window.confirm(`Delete "${cs.title}"?`)) return;
    try {
      await deleteCaseStudy(cs.id);
      setCaseStudies((prev) => prev.filter((c) => c.id !== cs.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
        <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
          Link the founders a case study is about — a case study can span founders from different startups.
        </p>
        <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditing("new")}>
          New case study
        </Button>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {caseStudies.length === 0 ? (
        <EmptyState title="No case studies yet" />
      ) : (
        <Card flush>
          {caseStudies.map((cs, i) => (
            <div
              key={cs.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div>
                <p className="body-medium">
                  {cs.title}
                  {cs.featured && (
                    <Star size={13} style={{ display: "inline", marginLeft: "var(--space-1)", color: "var(--warning)" }} fill="var(--warning)" />
                  )}
                </p>
                <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                  {(cs.case_study_founders ?? []).map((f) => f.founders.name).join(", ") || "No founders linked"}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                {cs.case_study_link && (
                  <a href={cs.case_study_link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-muted)" }}>
                    <ExternalLink size={16} />
                  </a>
                )}
                <Badge tone={cs.visibility === "public" ? "success" : "neutral"} dot={false}>
                  {cs.visibility}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => setEditing(cs)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(cs)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <CaseStudyEditor
          caseStudy={editing === "new" ? null : editing}
          founders={founders}
          tracks={tracks}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setCaseStudies((prev) => {
              const exists = prev.some((c) => c.id === saved.id);
              return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CaseStudyEditor({
  caseStudy,
  founders,
  tracks,
  onClose,
  onSaved,
}: {
  caseStudy: CaseStudy | null;
  founders: FounderOption[];
  tracks: Track[];
  onClose: () => void;
  onSaved: (caseStudy: CaseStudy) => void;
}) {
  const isNew = !caseStudy;
  const [form, setForm] = useState<CaseStudyInput>(
    caseStudy
      ? {
          title: caseStudy.title,
          case_study_link: caseStudy.case_study_link,
          audience: caseStudy.audience,
          featured: caseStudy.featured,
          visibility: caseStudy.visibility,
          sort_order: caseStudy.sort_order,
        }
      : EMPTY,
  );
  // One row per founder, ordered — same shape as the source system's own
  // case-study founder picker. Always at least one row to pick from.
  const [founderIds, setFounderIds] = useState<string[]>(() => {
    const existing = (caseStudy?.case_study_founders ?? []).map((f) => f.founder_id);
    return existing.length ? existing : [""];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (patch: Partial<CaseStudyInput>) => setForm((f) => ({ ...f, ...patch }));

  function addFounderRow() {
    setFounderIds((rows) => [...rows, ""]);
  }
  function setFounderRow(i: number, value: string) {
    setFounderIds((rows) => rows.map((r, j) => (j === i ? value : r)));
  }
  function removeFounderRow(i: number) {
    setFounderIds((rows) => (rows.length === 1 ? [""] : rows.filter((_, j) => j !== i)));
  }

  async function save() {
    const found = validateCaseStudy(form, founderIds);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createCaseStudy(form) : await updateCaseStudy(caseStudy!.id, form);
      await setCaseStudyFounders(saved.id, founderIds.filter(Boolean));
      // Re-read so the linked founder names shown in the list are current.
      const founderRows = founderIds
        .filter(Boolean)
        .map((id, i) => ({ founder_id: id, sort_order: i, founders: founders.find((f) => f.id === id)! }))
        .filter((r) => r.founders);
      onSaved({ ...saved, case_study_founders: founderRows });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New case study" : `Edit — ${caseStudy!.title}`} onClose={onClose} wide>
      <Input label="Title" required error={errors.title} value={form.title} onChange={(e) => set({ title: e.target.value })} />
      <CasePdfField value={form.case_study_link} error={errors.case_study_link} onChange={(case_study_link) => set({ case_study_link })} />

      <div>
        <span className="label" style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Founders <span className="ffn-field__req">*</span>
        </span>
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {founderIds.map((id, i) => {
            const takenElsewhere = new Set(founderIds.filter((_, j) => j !== i).filter(Boolean));
            return (
              <div key={i} className="flex items-center" style={{ gap: "var(--space-2)" }}>
                <Select
                  value={id}
                  placeholder="Choose a founder"
                  options={founders
                    .filter((f) => !takenElsewhere.has(f.id))
                    .map((f) => ({ value: f.id, label: f.startup_name ? `${f.name} (${f.startup_name})` : f.name }))}
                  onChange={(e) => setFounderRow(i, e.target.value)}
                />
                <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => removeFounderRow(i)}>
                  <X size={14} />
                </Button>
              </div>
            );
          })}
          {founderIds.filter(Boolean).length < founders.length && (
            <Button variant="secondary" size="sm" className="w-fit" iconLeft={<Plus size={13} />} onClick={addFounderRow}>
              Add another founder
            </Button>
          )}
          {errors.founders && <p className="ffn-field__error">{errors.founders}</p>}
        </div>
      </div>

      <div>
        <span className="label" style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Audience
        </span>
        <AudiencePicker tracks={tracks} value={form.audience} onChange={(audience) => set({ audience })} />
      </div>

      <div className="flex items-end flex-wrap" style={{ gap: "var(--space-4)" }}>
        <Select
          label="Visibility"
          value={form.visibility}
          options={VISIBILITY_OPTIONS}
          onChange={(e) => set({ visibility: e.target.value as CaseStudyInput["visibility"] })}
        />
        <Input
          type="number"
          label="Sort order"
          value={form.sort_order}
          onChange={(e) => set({ sort_order: Number(e.target.value) })}
          style={{ maxWidth: 140 }}
        />
        <label className="flex items-center" style={{ gap: "var(--space-2)", height: "var(--control-md)" }}>
          <input type="checkbox" checked={form.featured} onChange={(e) => set({ featured: e.target.checked })} />
          <span className="body-sm">Featured</span>
        </label>
      </div>

      {error && (
        <Alert tone="danger" title="Not saved">
          {error}
        </Alert>
      )}

      <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
