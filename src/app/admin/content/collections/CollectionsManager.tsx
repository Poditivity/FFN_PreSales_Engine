"use client";

import { Pencil, Plus, Star } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Select, Textarea } from "@/components/ffn";
import { AudiencePicker } from "@/components/content/AudiencePicker";
import { ImageUploadField } from "@/components/content/ImageUploadField";
import {
  createCollection,
  createCollectionItem,
  deleteCollection,
  deleteCollectionItem,
  updateCollection,
  updateCollectionItem,
  type CollectionItemInput,
} from "@/lib/content/collections";
import { VISIBILITY_OPTIONS, type Collection, type CollectionItem, type Track } from "@/lib/content/types";
import {
  NOT_SAVED_SUMMARY,
  revealFirstError,
  validateCollection,
  validateCollectionItem,
  type FieldErrors,
} from "@/lib/content/validation";

export function CollectionsManager({
  initialCollections,
  initialItems,
  tracks,
}: {
  initialCollections: Collection[];
  initialItems: CollectionItem[];
  tracks: Track[];
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [items, setItems] = useState(initialItems);
  const [currentId, setCurrentId] = useState(initialCollections[0]?.id ?? "");
  const [editingCollection, setEditingCollection] = useState<Collection | "new" | null>(null);
  const [editingItem, setEditingItem] = useState<CollectionItem | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = collections.find((c) => c.id === currentId) ?? null;
  const currentItems = items.filter((i) => i.collection_id === currentId);

  async function removeCollection(collection: Collection) {
    const count = items.filter((i) => i.collection_id === collection.id).length;
    const message = `Delete "${collection.name}"${count ? ` and its ${count} item${count === 1 ? "" : "s"}` : ""}? A hub section that lists it will show nothing. This cannot be undone.`;
    if (!window.confirm(message)) return;
    try {
      await deleteCollection(collection.id);
      const remaining = collections.filter((c) => c.id !== collection.id);
      setCollections(remaining);
      setItems((prev) => prev.filter((i) => i.collection_id !== collection.id));
      setCurrentId(remaining[0]?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function removeItem(item: CollectionItem) {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      await deleteCollectionItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <p className="body-sm" style={{ color: "var(--ink-muted)", marginBottom: "var(--space-4)" }}>
        A collection is a list you define yourself, such as Events or Partners. Add it to a hub template as a section to show its public items.
      </p>

      <div className="flex items-end justify-between flex-wrap" style={{ gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div className="flex items-end flex-wrap" style={{ gap: "var(--space-3)" }}>
          {collections.length > 0 && (
            <Select
              label="Collection"
              value={currentId}
              options={collections.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(e) => setCurrentId(e.target.value)}
              style={{ minWidth: 220 }}
            />
          )}
          {current && (
            <>
              <Button variant="secondary" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setEditingCollection(current)}>
                Rename
              </Button>
              <Button variant="ghost" size="sm" onClick={() => removeCollection(current)}>
                Delete collection
              </Button>
            </>
          )}
        </div>
        <div className="flex" style={{ gap: "var(--space-2)" }}>
          <Button variant="secondary" size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditingCollection("new")}>
            New collection
          </Button>
          {current && (
            <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditingItem("new")}>
              New item
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {!current ? (
        <EmptyState title="No collections yet">Create one, such as Events or Partners, then add items to it.</EmptyState>
      ) : currentItems.length === 0 ? (
        <EmptyState title={`No items in ${current.name} yet`} />
      ) : (
        <Card flush>
          {currentItems.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-4)", gap: "var(--space-3)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div style={{ minWidth: 0 }}>
                <p className="body-medium" style={{ overflowWrap: "anywhere" }}>
                  {item.title}
                  {item.featured && (
                    <Star size={13} style={{ display: "inline", marginLeft: "var(--space-1)", color: "var(--warning)" }} fill="var(--warning)" />
                  )}
                </p>
                {item.description && (
                  <p className="body-sm" style={{ color: "var(--ink-muted)", overflowWrap: "anywhere" }}>
                    {item.description.slice(0, 100)}
                  </p>
                )}
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <Badge tone={item.visibility === "public" ? "success" : "neutral"} dot={false}>
                  {item.visibility}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => setEditingItem(item)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeItem(item)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editingCollection && (
        <CollectionEditor
          collection={editingCollection === "new" ? null : editingCollection}
          onClose={() => setEditingCollection(null)}
          onSaved={(saved) => {
            setCollections((prev) => {
              const exists = prev.some((c) => c.id === saved.id);
              return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
            });
            setCurrentId(saved.id);
            setEditingCollection(null);
          }}
        />
      )}

      {editingItem && current && (
        <ItemEditor
          collectionId={current.id}
          item={editingItem === "new" ? null : editingItem}
          tracks={tracks}
          onClose={() => setEditingItem(null)}
          onSaved={(saved) => {
            setItems((prev) => {
              const exists = prev.some((i) => i.id === saved.id);
              return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved];
            });
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}

function CollectionEditor({
  collection,
  onClose,
  onSaved,
}: {
  collection: Collection | null;
  onClose: () => void;
  onSaved: (collection: Collection) => void;
}) {
  const isNew = !collection;
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function save() {
    const found = validateCollection({ name });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), description: description.trim() || null, sort_order: collection?.sort_order ?? 0 };
      onSaved(isNew ? await createCollection(input) : await updateCollection(collection!.id, input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New collection" : `Rename — ${collection!.name}`} onClose={onClose}>
      <Input label="Name" required error={errors.name} placeholder="Events" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea
        label="Description"
        rows={2}
        hint="Only your team sees this."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
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

function ItemEditor({
  collectionId,
  item,
  tracks,
  onClose,
  onSaved,
}: {
  collectionId: string;
  item: CollectionItem | null;
  tracks: Track[];
  onClose: () => void;
  onSaved: (item: CollectionItem) => void;
}) {
  const isNew = !item;
  const [form, setForm] = useState<CollectionItemInput>({
    collection_id: collectionId,
    title: item?.title ?? "",
    description: item?.description ?? null,
    image_url: item?.image_url ?? null,
    link_url: item?.link_url ?? null,
    audience: item?.audience ?? [],
    featured: item?.featured ?? false,
    visibility: item?.visibility ?? "public",
    sort_order: item?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (patch: Partial<CollectionItemInput>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    const found = validateCollectionItem(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { ...form, title: form.title.trim() };
      onSaved(isNew ? await createCollectionItem(input) : await updateCollectionItem(item!.id, input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New item" : `Edit — ${item!.title}`} onClose={onClose}>
      <Input label="Title" required error={errors.title} value={form.title} onChange={(e) => set({ title: e.target.value })} />
      <Textarea
        label="Description"
        rows={3}
        value={form.description ?? ""}
        onChange={(e) => set({ description: e.target.value || null })}
      />
      <ImageUploadField
        label="Image"
        folder="collections/images"
        testId="collection-image"
        error={errors.image_url}
        value={form.image_url}
        onChange={(image_url) => set({ image_url })}
      />
      <Input
        label="Link"
        placeholder="https://"
        hint="Optional. Opens in a new tab from the item on the hub."
        error={errors.link_url}
        value={form.link_url ?? ""}
        onChange={(e) => set({ link_url: e.target.value || null })}
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
          onChange={(e) => set({ visibility: e.target.value as CollectionItemInput["visibility"] })}
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
