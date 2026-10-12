"use client";

import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select, Textarea } from "@/components/ffn";
import { AudiencePicker } from "@/components/content/AudiencePicker";
import { ImageUploadField } from "@/components/content/ImageUploadField";
import { createMentor, deleteMentor, updateMentor, type MentorInput } from "@/lib/content/mentors";
import { VISIBILITY_OPTIONS, type Mentor, type Track } from "@/lib/content/types";
import { NOT_SAVED_SUMMARY, revealFirstError, validateMentor, type FieldErrors } from "@/lib/content/validation";

const EMPTY: MentorInput = {
  name: "",
  photo_url: null,
  role: null,
  expertise: null,
  relevant_experience: null,
  linkedin_url: null,
  audience: [],
  featured: false,
  visibility: "draft",
  sort_order: 0,
};

export function MentorsManager({ initialMentors, tracks }: { initialMentors: Mentor[]; tracks: Track[] }) {
  const [mentors, setMentors] = useState(initialMentors);
  const [editing, setEditing] = useState<Mentor | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(mentor: Mentor) {
    if (!window.confirm(`Delete "${mentor.name}"?`)) return;
    try {
      await deleteMentor(mentor.id);
      setMentors((prev) => prev.filter((m) => m.id !== mentor.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
        <span />
        <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditing("new")}>
          New mentor
        </Button>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {mentors.length === 0 ? (
        <EmptyState title="No mentors yet" />
      ) : (
        <Card flush>
          {mentors.map((mentor, i) => (
            <div
              key={mentor.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div>
                <p className="body-medium">
                  {mentor.name}
                  {mentor.featured && (
                    <Star size={13} style={{ display: "inline", marginLeft: "var(--space-1)", color: "var(--warning)" }} fill="var(--warning)" />
                  )}
                </p>
                <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                  {mentor.role || "—"}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <Badge tone={mentor.visibility === "public" ? "success" : "neutral"} dot={false}>
                  {mentor.visibility}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => setEditing(mentor)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(mentor)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <MentorEditor
          mentor={editing === "new" ? null : editing}
          tracks={tracks}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setMentors((prev) => {
              const exists = prev.some((m) => m.id === saved.id);
              return exists ? prev.map((m) => (m.id === saved.id ? saved : m)) : [...prev, saved];
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MentorEditor({
  mentor,
  tracks,
  onClose,
  onSaved,
}: {
  mentor: Mentor | null;
  tracks: Track[];
  onClose: () => void;
  onSaved: (mentor: Mentor) => void;
}) {
  const isNew = !mentor;
  const [form, setForm] = useState<MentorInput>(mentor ? { ...mentor } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (patch: Partial<MentorInput>) => setForm((f) => ({ ...f, ...patch }));
  const text = (key: keyof MentorInput) => (form[key] as string | null) ?? "";
  const setText = (key: keyof MentorInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set({ [key]: e.target.value || null } as Partial<MentorInput>);

  async function save() {
    const found = validateMentor(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createMentor(form) : await updateMentor(mentor!.id, form);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New mentor" : `Edit — ${mentor!.name}`} onClose={onClose}>
      <Input label="Name" required error={errors.name} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      <ImageUploadField
        label="Photo"
        folder="mentors/photos"
        shape="round"
        testId="mentor-photo"
        error={errors.photo_url}
        value={form.photo_url}
        onChange={(photo_url) => set({ photo_url })}
      />
      <Input label="Role" required error={errors.role} value={text("role")} onChange={setText("role")} />
      <Textarea label="Expertise" required rows={2} error={errors.expertise} value={text("expertise")} onChange={setText("expertise")} />
      <Textarea label="Relevant experience" rows={3} value={text("relevant_experience")} onChange={setText("relevant_experience")} />
      <Input label="LinkedIn" error={errors.linkedin_url} value={text("linkedin_url")} onChange={setText("linkedin_url")} />

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
          onChange={(e) => set({ visibility: e.target.value as MentorInput["visibility"] })}
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
