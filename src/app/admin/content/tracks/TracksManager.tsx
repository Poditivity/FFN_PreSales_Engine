"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card, EmptyState, Input, Modal, Textarea } from "@/components/ffn";
import { createTrack, deleteTrack, updateTrack, type TrackInput } from "@/lib/content/tracks";
import type { Track } from "@/lib/content/types";
import { NOT_SAVED_SUMMARY, revealFirstError, validateTrack, type FieldErrors } from "@/lib/content/validation";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const EMPTY: TrackInput = { name: "", slug: "", description: "", sort_order: 0 };

export function TracksManager({ initialTracks }: { initialTracks: Track[] }) {
  const [tracks, setTracks] = useState(initialTracks);
  const [editing, setEditing] = useState<Track | null | "new">(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(track: Track) {
    if (!window.confirm(`Delete track "${track.name}"? Content already targeting it keeps the reference.`)) return;
    try {
      await deleteTrack(track.id);
      setTracks((prev) => prev.filter((t) => t.id !== track.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
        <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
          Tracks are the audience segments every content type can target. Leaving a content item&rsquo;s
          audience empty makes it visible to every track.
        </p>
        <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditing("new")}>
          New track
        </Button>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {tracks.length === 0 ? (
        <EmptyState title="No tracks yet">Create one to start targeting content by audience.</EmptyState>
      ) : (
        <Card flush>
          {tracks.map((track, i) => (
            <div
              key={track.id}
              className="flex items-center justify-between"
              style={{
                padding: "var(--space-4)",
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <div>
                <p className="body-medium">{track.name}</p>
                <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                  {track.slug}
                  {track.description ? ` — ${track.description}` : ""}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                <Button variant="ghost" size="sm" aria-label="Edit" onClick={() => setEditing(track)}>
                  <Pencil size={15} />
                </Button>
                <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => remove(track)}>
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <TrackEditor
          track={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setTracks((prev) => {
              const exists = prev.some((t) => t.id === saved.id);
              const next = exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
              return next.sort((a, b) => a.sort_order - b.sort_order);
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TrackEditor({
  track,
  onClose,
  onSaved,
}: {
  track: Track | null;
  onClose: () => void;
  onSaved: (track: Track) => void;
}) {
  const isNew = !track;
  const [form, setForm] = useState<TrackInput>(
    track
      ? { name: track.name, slug: track.slug, description: track.description, sort_order: track.sort_order }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (patch: Partial<TrackInput>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    const found = validateTrack(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, slug: form.slug.trim() || slugify(form.name) };
      const saved = isNew ? await createTrack(payload) : await updateTrack(track!.id, payload);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New track" : `Edit — ${track!.name}`} onClose={onClose}>
      <Input
        label="Name"
        required
        error={errors.name}
        value={form.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      <Input
        label="Slug"
        hint="Auto-generated from the name if left blank."
        value={form.slug}
        onChange={(e) => set({ slug: e.target.value })}
      />
      <Textarea
        label="Description"
        rows={2}
        value={form.description ?? ""}
        onChange={(e) => set({ description: e.target.value })}
      />
      <Input
        type="number"
        label="Sort order"
        value={form.sort_order}
        onChange={(e) => set({ sort_order: Number(e.target.value) })}
      />
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
