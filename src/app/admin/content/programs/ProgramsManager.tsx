"use client";

import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select, Textarea } from "@/components/ffn";
import { AudiencePicker } from "@/components/content/AudiencePicker";
import { TagListInput } from "@/components/content/TagListInput";
import { createProgram, deleteProgram, updateProgram, type ProgramInput } from "@/lib/content/programs";
import { VISIBILITY_OPTIONS, type Program, type Track } from "@/lib/content/types";
import { NOT_SAVED_SUMMARY, revealFirstError, validateProgram, type FieldErrors } from "@/lib/content/validation";

const EMPTY: ProgramInput = {
  name: "",
  description: null,
  stages: [],
  problems_addressed: [],
  audience: [],
  featured: false,
  visibility: "draft",
  sort_order: 0,
};

export function ProgramsManager({ initialPrograms, tracks }: { initialPrograms: Program[]; tracks: Track[] }) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [editing, setEditing] = useState<Program | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(program: Program) {
    if (!window.confirm(`Delete "${program.name}"?`)) return;
    try {
      await deleteProgram(program.id);
      setPrograms((prev) => prev.filter((p) => p.id !== program.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
        <span />
        <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditing("new")}>
          New program
        </Button>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {programs.length === 0 ? (
        <EmptyState title="No programs yet" />
      ) : (
        <Card flush>
          {programs.map((program, i) => (
            <div
              key={program.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div>
                <p className="body-medium">
                  {program.name}
                  {program.featured && (
                    <Star size={13} style={{ display: "inline", marginLeft: "var(--space-1)", color: "var(--warning)" }} fill="var(--warning)" />
                  )}
                </p>
                <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                  {program.stages.length > 0 ? program.stages.join(", ") : "—"}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <Badge tone={program.visibility === "public" ? "success" : "neutral"} dot={false}>
                  {program.visibility}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => setEditing(program)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(program)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <ProgramEditor
          program={editing === "new" ? null : editing}
          tracks={tracks}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setPrograms((prev) => {
              const exists = prev.some((p) => p.id === saved.id);
              return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ProgramEditor({
  program,
  tracks,
  onClose,
  onSaved,
}: {
  program: Program | null;
  tracks: Track[];
  onClose: () => void;
  onSaved: (program: Program) => void;
}) {
  const isNew = !program;
  const [form, setForm] = useState<ProgramInput>(program ? { ...program } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (patch: Partial<ProgramInput>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    const found = validateProgram(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createProgram(form) : await updateProgram(program!.id, form);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New program" : `Edit — ${program!.name}`} onClose={onClose}>
      <Input label="Name" required error={errors.name} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      <Textarea
        label="Description"
        required
        rows={3}
        error={errors.description}
        value={form.description ?? ""}
        onChange={(e) => set({ description: e.target.value || null })}
      />

      <TagListInput
        label="Relevant stages"
        hint="Founder/startup stages this program is relevant for."
        value={form.stages}
        onChange={(stages) => set({ stages })}
        placeholder="e.g. Idea stage"
      />
      <TagListInput
        label="Problems addressed"
        value={form.problems_addressed}
        onChange={(problems_addressed) => set({ problems_addressed })}
        placeholder="e.g. Customer discovery"
      />

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
          onChange={(e) => set({ visibility: e.target.value as ProgramInput["visibility"] })}
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
