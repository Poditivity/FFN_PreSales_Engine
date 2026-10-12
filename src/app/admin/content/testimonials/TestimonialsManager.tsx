"use client";

import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Modal, Select, Textarea, Input } from "@/components/ffn";
import { AudiencePicker } from "@/components/content/AudiencePicker";
import {
  createTestimonial,
  deleteTestimonial,
  updateTestimonial,
  type TestimonialInput,
} from "@/lib/content/testimonials";
import { VISIBILITY_OPTIONS, type Testimonial, type Track } from "@/lib/content/types";
import { NOT_SAVED_SUMMARY, revealFirstError, validateTestimonial, type FieldErrors } from "@/lib/content/validation";

interface FounderOption {
  id: string;
  name: string;
  startup_name: string | null;
}

function emptyForm(defaultFounderId: string): TestimonialInput {
  return {
    founder_id: defaultFounderId,
    testimonial_quote: null,
    video_link: null,
    audience: [],
    featured: false,
    visibility: "draft",
    sort_order: 0,
  };
}

export function TestimonialsManager({
  initialTestimonials,
  founders,
  tracks,
}: {
  initialTestimonials: Testimonial[];
  founders: FounderOption[];
  tracks: Track[];
}) {
  const [testimonials, setTestimonials] = useState(initialTestimonials);
  const [editing, setEditing] = useState<Testimonial | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(t: Testimonial) {
    if (!window.confirm("Delete this testimonial?")) return;
    try {
      await deleteTestimonial(t.id);
      setTestimonials((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (founders.length === 0) {
    return <EmptyState title="Add a founder first">Testimonials are always tied to a founder.</EmptyState>;
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
        <span />
        <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditing("new")}>
          New testimonial
        </Button>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {testimonials.length === 0 ? (
        <EmptyState title="No testimonials yet" />
      ) : (
        <Card flush>
          {testimonials.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div>
                <p className="body-medium">
                  {t.founders?.name ?? "Unknown founder"}
                  {t.featured && (
                    <Star size={13} style={{ display: "inline", marginLeft: "var(--space-1)", color: "var(--warning)" }} fill="var(--warning)" />
                  )}
                </p>
                <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                  {(t.testimonial_quote ?? "").slice(0, 100) || "No quote yet"}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <Badge tone={t.visibility === "public" ? "success" : "neutral"} dot={false}>
                  {t.visibility}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => setEditing(t)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(t)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <TestimonialEditor
          testimonial={editing === "new" ? null : editing}
          founders={founders}
          tracks={tracks}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setTestimonials((prev) => {
              const exists = prev.some((t) => t.id === saved.id);
              return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TestimonialEditor({
  testimonial,
  founders,
  tracks,
  onClose,
  onSaved,
}: {
  testimonial: Testimonial | null;
  founders: FounderOption[];
  tracks: Track[];
  onClose: () => void;
  onSaved: (testimonial: Testimonial) => void;
}) {
  const isNew = !testimonial;
  const [form, setForm] = useState<TestimonialInput>(
    testimonial
      ? {
          founder_id: testimonial.founder_id,
          testimonial_quote: testimonial.testimonial_quote,
          video_link: testimonial.video_link,
          audience: testimonial.audience,
          featured: testimonial.featured,
          visibility: testimonial.visibility,
          sort_order: testimonial.sort_order,
        }
      : emptyForm(founders[0].id),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (patch: Partial<TestimonialInput>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    const found = validateTestimonial(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createTestimonial(form) : await updateTestimonial(testimonial!.id, form);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New testimonial" : "Edit testimonial"} onClose={onClose}>
      <Select
        label="Founder"
        required
        error={errors.founder_id}
        value={form.founder_id}
        options={founders.map((f) => ({ value: f.id, label: f.startup_name ? `${f.name} (${f.startup_name})` : f.name }))}
        onChange={(e) => set({ founder_id: e.target.value })}
      />
      <Textarea
        label="Testimonial quote"
        rows={4}
        hint="Add a quote, a video link, or both. One of the two is required."
        error={errors.testimonial_quote}
        value={form.testimonial_quote ?? ""}
        onChange={(e) => set({ testimonial_quote: e.target.value || null })}
      />
      <Input
        label="Video link"
        placeholder="https://…"
        error={errors.video_link}
        value={form.video_link ?? ""}
        onChange={(e) => set({ video_link: e.target.value || null })}
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
          onChange={(e) => set({ visibility: e.target.value as TestimonialInput["visibility"] })}
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
