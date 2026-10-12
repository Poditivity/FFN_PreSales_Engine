"use client";

import Link from "next/link";
import { Plus, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, RowsSkeleton, Select, Textarea } from "@/components/ffn";
import { AudiencePicker } from "@/components/content/AudiencePicker";
import { ImageUploadField } from "@/components/content/ImageUploadField";
import {
  createFounder,
  deleteFounder,
  linkCoFounders,
  listCoFounders,
  unlinkCoFounders,
  updateFounder,
  type FounderInput,
} from "@/lib/content/founders";
import { VISIBILITY_OPTIONS, type Founder, type Track, type Visibility } from "@/lib/content/types";
import { NOT_SAVED_SUMMARY, revealFirstError, validateFounder, type FieldErrors } from "@/lib/content/validation";

const EMPTY: FounderInput = {
  name: "",
  photo_url: null,
  startup_name: null,
  startup_logo_url: null,
  website_url: null,
  starting_stage: null,
  current_stage: null,
  starting_problem: null,
  journey: null,
  industry: null,
  ffn_support: null,
  key_change: null,
  outcome: null,
  milestones: null,
  professional_experience: null,
  linkedin_url: null,
  audience: [],
  featured: false,
  visibility: "draft",
  sort_order: 0,
};

export function FoundersManager({ initialFounders, tracks }: { initialFounders: Founder[]; tracks: Track[] }) {
  const [founders, setFounders] = useState(initialFounders);
  const [editing, setEditing] = useState<Founder | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(founder: Founder) {
    if (!window.confirm(`Delete "${founder.name}"? This also removes their co-founder links and testimonials.`)) return;
    try {
      await deleteFounder(founder.id);
      setFounders((prev) => prev.filter((f) => f.id !== founder.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
        <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
          Open a founder to link co-founders from the same or a different startup.
        </p>
        <Button size="sm" iconLeft={<Plus size={15} />} onClick={() => setEditing("new")}>
          New founder
        </Button>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      {founders.length === 0 ? (
        <EmptyState title="No founders yet">Add the first founder profile.</EmptyState>
      ) : (
        <Card flush>
          {founders.map((founder, i) => (
            <div
              key={founder.id}
              className="flex items-center justify-between"
              style={{ padding: "var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
            >
              <div>
                <Link href={`/admin/content/founders/${founder.id}`} className="body-medium" style={{ color: "var(--ink)" }}>
                  {founder.name}
                  {founder.featured && (
                    <Star size={13} style={{ display: "inline", marginLeft: "var(--space-1)", color: "var(--warning)" }} fill="var(--warning)" />
                  )}
                </Link>
                <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
                  {founder.startup_name || "—"}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <Badge tone={founder.visibility === "public" ? "success" : "neutral"} dot={false}>
                  {founder.visibility}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => setEditing(founder)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(founder)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <FounderEditor
          founder={editing === "new" ? null : editing}
          tracks={tracks}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setFounders((prev) => {
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

function FounderFields({
  form,
  set,
  tracks,
  errors,
}: {
  form: FounderInput;
  set: (patch: Partial<FounderInput>) => void;
  tracks: Track[];
  errors: FieldErrors;
}) {
  const text = (key: keyof FounderInput) => (form[key] as string | null) ?? "";
  const setText = (key: keyof FounderInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set({ [key]: e.target.value || null } as Partial<FounderInput>);

  return (
    <>
      <Input label="Founder name" required error={errors.name} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      <ImageUploadField
        label="Photo"
        folder="founders/photos"
        shape="round"
        testId="founder-photo"
        error={errors.photo_url}
        value={form.photo_url}
        onChange={(photo_url) => set({ photo_url })}
      />

      <ImageUploadField
        label="Startup logo"
        folder="founders/logos"
        testId="founder-logo"
        error={errors.startup_logo_url}
        value={form.startup_logo_url}
        onChange={(startup_logo_url) => set({ startup_logo_url })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "var(--space-4)" }}>
        <Input label="Startup name" required error={errors.startup_name} value={text("startup_name")} onChange={setText("startup_name")} />
        <Input label="Website" error={errors.website_url} value={text("website_url")} onChange={setText("website_url")} />
        <Input label="LinkedIn" error={errors.linkedin_url} value={text("linkedin_url")} onChange={setText("linkedin_url")} />
        <Input label="Starting stage" value={text("starting_stage")} onChange={setText("starting_stage")} />
        <Input label="Current stage" value={text("current_stage")} onChange={setText("current_stage")} />
        <Input label="Industry" value={text("industry")} onChange={setText("industry")} />
      </div>

      <Textarea label="Starting problem" rows={2} value={text("starting_problem")} onChange={setText("starting_problem")} />
      <Textarea label="Journey" rows={3} value={text("journey")} onChange={setText("journey")} />
      <Textarea label="FFN support" rows={2} value={text("ffn_support")} onChange={setText("ffn_support")} />
      <Textarea label="Key change" rows={2} value={text("key_change")} onChange={setText("key_change")} />
      <Textarea label="Outcome" rows={2} value={text("outcome")} onChange={setText("outcome")} />
      <Textarea label="Milestones" rows={2} value={text("milestones")} onChange={setText("milestones")} />
      <Textarea
        label="Professional / industry experience"
        rows={2}
        value={text("professional_experience")}
        onChange={setText("professional_experience")}
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
          onChange={(e) => set({ visibility: e.target.value as FounderInput["visibility"] })}
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
    </>
  );
}

// A co-founder shares the primary founder's startup details (same startup,
// same journey) — only their own personal fields are editable here. The
// shared startup fields are copied from the primary form when saved.
//
// `id` is null for a co-founder that doesn't exist yet (created on save) and
// set once persisted — either freshly created, or loaded from the DB so an
// already-linked co-founder's own details show (and stay editable) the next
// time this founder is opened, not just their name.
interface CoFounderEntry {
  key: string;
  id: string | null;
  base: Founder | null;
  name: string;
  photo_url: string | null;
  professional_experience: string | null;
  audience: string[];
  featured: boolean;
  visibility: Visibility;
}

function newCoFounderEntry(): CoFounderEntry {
  return {
    key: crypto.randomUUID(),
    id: null,
    base: null,
    name: "",
    photo_url: null,
    professional_experience: null,
    audience: [],
    featured: false,
    visibility: "draft",
  };
}

function coFounderEntryFromFounder(founder: Founder): CoFounderEntry {
  return {
    key: founder.id,
    id: founder.id,
    base: founder,
    name: founder.name,
    photo_url: founder.photo_url,
    professional_experience: founder.professional_experience,
    audience: founder.audience,
    featured: founder.featured,
    visibility: founder.visibility,
  };
}

function CoFounderEntryFields({
  entry,
  tracks,
  onChange,
  onRemove,
}: {
  entry: CoFounderEntry;
  tracks: Track[];
  onChange: (patch: Partial<Pick<CoFounderEntry, "name" | "photo_url" | "professional_experience" | "audience" | "featured" | "visibility">>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        background: "var(--surface-sunken)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="body-sm" style={{ color: "var(--ink-muted)" }}>
          {entry.id ? "Linked co-founder" : "New co-founder — shares this startup's details"}
        </span>
        <Button type="button" variant="ghost" size="sm" aria-label="Remove co-founder" onClick={onRemove}>
          <X size={14} />
        </Button>
      </div>

      <Input label="Founder name" required value={entry.name} onChange={(e) => onChange({ name: e.target.value })} />
      <ImageUploadField
        label="Photo"
        folder="founders/photos"
        shape="round"
        testId="cofounder-photo"
        value={entry.photo_url}
        onChange={(photo_url) => onChange({ photo_url })}
      />
      <Textarea
        label="Professional / industry experience"
        rows={2}
        value={entry.professional_experience ?? ""}
        onChange={(e) => onChange({ professional_experience: e.target.value || null })}
      />

      <div>
        <span className="label" style={{ display: "block", marginBottom: "var(--space-2)" }}>
          Audience
        </span>
        <AudiencePicker tracks={tracks} value={entry.audience} onChange={(audience) => onChange({ audience })} />
      </div>

      <div className="flex items-end flex-wrap" style={{ gap: "var(--space-4)" }}>
        <Select
          label="Visibility"
          value={entry.visibility}
          options={VISIBILITY_OPTIONS}
          onChange={(e) => onChange({ visibility: e.target.value as Visibility })}
        />
        <label className="flex items-center" style={{ gap: "var(--space-2)", height: "var(--control-md)" }}>
          <input type="checkbox" checked={entry.featured} onChange={(e) => onChange({ featured: e.target.checked })} />
          <span className="body-sm">Featured</span>
        </label>
      </div>
    </div>
  );
}

function FounderEditor({
  founder,
  tracks,
  onClose,
  onSaved,
}: {
  founder: Founder | null;
  tracks: Track[];
  onClose: () => void;
  onSaved: (founder: Founder) => void;
}) {
  const isNew = !founder;
  const [form, setForm] = useState<FounderInput>(founder ? { ...founder } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (patch: Partial<FounderInput>) => setForm((f) => ({ ...f, ...patch }));

  const [coFounders, setCoFounders] = useState<CoFounderEntry[]>([]);
  const [loadingCoFounders, setLoadingCoFounders] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    listCoFounders(founder!.id)
      .then((rows) => {
        if (!cancelled) setCoFounders(rows.map(coFounderEntryFromFounder));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load co-founders");
      })
      .finally(() => {
        if (!cancelled) setLoadingCoFounders(false);
      });
    return () => {
      cancelled = true;
    };
    // founder is fixed for the lifetime of this editor instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  function addCoFounder() {
    setCoFounders((prev) => [...prev, newCoFounderEntry()]);
  }

  function updateCoFounder(key: string, patch: Partial<Omit<CoFounderEntry, "key" | "id" | "base">>) {
    setCoFounders((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  async function removeCoFounder(entry: CoFounderEntry) {
    if (entry.id) {
      try {
        await unlinkCoFounders(founder!.id, entry.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove co-founder");
        return;
      }
    }
    setCoFounders((prev) => prev.filter((c) => c.key !== entry.key));
  }

  async function save() {
    const found = validateFounder(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setError(NOT_SAVED_SUMMARY);
      revealFirstError();
      return;
    }
    if (coFounders.some((c) => !c.name.trim())) {
      setError("Every co-founder needs a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createFounder(form) : await updateFounder(founder!.id, form);
      // Co-founders share the primary founder's startup context — only their
      // own personal fields are edited here; the shared fields are kept in
      // sync with the primary founder's current values on every save.
      const sharedFields = {
        startup_name: form.startup_name,
        startup_logo_url: form.startup_logo_url,
        website_url: form.website_url,
        starting_stage: form.starting_stage,
        current_stage: form.current_stage,
        starting_problem: form.starting_problem,
        journey: form.journey,
        industry: form.industry,
        ffn_support: form.ffn_support,
        key_change: form.key_change,
        outcome: form.outcome,
        milestones: form.milestones,
      };
      for (const entry of coFounders) {
        const coFounderInput: FounderInput = {
          name: entry.name,
          photo_url: entry.photo_url,
          ...sharedFields,
          professional_experience: entry.professional_experience,
          linkedin_url: entry.base?.linkedin_url ?? null,
          audience: entry.audience,
          featured: entry.featured,
          visibility: entry.visibility,
          sort_order: entry.base?.sort_order ?? 0,
        };
        if (entry.id) {
          await updateFounder(entry.id, coFounderInput);
        } else {
          const newCoFounder = await createFounder(coFounderInput);
          await linkCoFounders(saved.id, newCoFounder.id);
        }
      }
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? "New founder" : `Edit — ${founder!.name}`} onClose={onClose} wide>
      <FounderFields form={form} set={set} tracks={tracks} errors={errors} />

      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
          <span className="label">Co-founders</span>
          <Button type="button" variant="secondary" size="sm" iconLeft={<Plus size={15} />} onClick={addCoFounder}>
            Add co-founder
          </Button>
        </div>

        {loadingCoFounders ? (
          <RowsSkeleton rows={2} label="Loading co-founders" />
        ) : coFounders.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
            No co-founders yet.
          </p>
        ) : (
          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            {coFounders.map((entry) => (
              <CoFounderEntryFields
                key={entry.key}
                entry={entry}
                tracks={tracks}
                onChange={(patch) => updateCoFounder(entry.key, patch)}
                onRemove={() => removeCoFounder(entry)}
              />
            ))}
          </div>
        )}
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
