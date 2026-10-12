"use client";

import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select, Textarea } from "@/components/ffn";
import { AudiencePicker } from "@/components/content/AudiencePicker";
import { createFaq, deleteFaq, updateFaq, type FaqInput } from "@/lib/content/faqs";
import { VISIBILITY_OPTIONS, type Faq, type Track } from "@/lib/content/types";
import { NOT_SAVED_SUMMARY, revealFirstError, validateFaq, type FieldErrors } from "@/lib/content/validation";

const EMPTY: FaqInput = {
  question: "",
  answer: "",
  audience: [],
  featured: false,
  visibility: "public",
  sort_order: 0,
};

export function FaqsManager({ initialFaqs, tracks }: { initialFaqs: Faq[]; tracks: Track[] }) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [editing, setEditing] = useState<Faq | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(faq: Faq) {
    if (!window.confirm("Delete this FAQ?")) return;
    try {
      await deleteFaq(faq.id);
      setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
        <span />
        <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditing("new")}>
          New FAQ
        </Button>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {faqs.length === 0 ? (
        <EmptyState title="No FAQs yet" />
      ) : (
        <Card flush>
          {faqs.map((faq, i) => (
            <div
              key={faq.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div>
                <p className="body-medium">
                  {faq.question}
                  {faq.featured && (
                    <Star size={13} style={{ display: "inline", marginLeft: "var(--space-1)", color: "var(--warning)" }} fill="var(--warning)" />
                  )}
                </p>
                <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                  {faq.answer.slice(0, 100)}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <Badge tone={faq.visibility === "public" ? "success" : "neutral"} dot={false}>
                  {faq.visibility}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => setEditing(faq)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(faq)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <FaqEditor
          faq={editing === "new" ? null : editing}
          tracks={tracks}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setFaqs((prev) => {
              const exists = prev.some((f) => f.id === saved.id);
              return exists ? prev.map((f) => (f.id === saved.id ? saved : f)) : [...prev, saved];
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function FaqEditor({
  faq,
  tracks,
  onClose,
  onSaved,
}: {
  faq: Faq | null;
  tracks: Track[];
  onClose: () => void;
  onSaved: (faq: Faq) => void;
}) {
  const isNew = !faq;
  const [form, setForm] = useState<FaqInput>(
    faq
      ? {
          question: faq.question,
          answer: faq.answer,
          audience: faq.audience,
          featured: faq.featured,
          visibility: faq.visibility,
          sort_order: faq.sort_order,
        }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (patch: Partial<FaqInput>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    const found = validateFaq(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createFaq(form) : await updateFaq(faq!.id, form);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New FAQ" : "Edit FAQ"} onClose={onClose}>
      <Input label="Question" required error={errors.question} value={form.question} onChange={(e) => set({ question: e.target.value })} />
      <Textarea label="Answer" required rows={4} error={errors.answer} value={form.answer} onChange={(e) => set({ answer: e.target.value })} />

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
          onChange={(e) => set({ visibility: e.target.value as FaqInput["visibility"] })}
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
