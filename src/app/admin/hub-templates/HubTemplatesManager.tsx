"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Checkbox, Input, RowsSkeleton, Select } from "@/components/ffn";
import { ModuleComposer, normalizeModules, type ItemOption } from "@/components/hubs/ModuleComposer";
import type { Track } from "@/lib/content/types";
import { createHubTemplate, deleteHubTemplate, updateHubTemplate } from "@/lib/hubs/templates";
import { loadItemsByType } from "@/lib/hubs/pickerItems";
import { CTA_TEXT_MAX, updateHubSettings, validateBookingUrl, type HubSettings } from "@/lib/hubs/settings";
import type { BlockType, HubModule, HubTemplate } from "@/lib/hubs/types";

export function HubTemplatesManager({
  initialTemplates,
  tracks,
  initialSettings,
}: {
  initialTemplates: HubTemplate[];
  tracks: Track[];
  initialSettings: HubSettings;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [itemsByType, setItemsByType] = useState<Record<BlockType, ItemOption[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialTrackId = tracks[0]?.id ?? "";
  const initialTemplate = initialTemplates.filter((t) => t.track_id === initialTrackId)[0] ?? null;

  const [trackId, setTrackId] = useState(initialTrackId);
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");
  const [name, setName] = useState(initialTemplate?.name ?? "Default");
  const [modules, setModules] = useState<HubModule[]>(normalizeModules(initialTemplate?.modules ?? []));
  const [showNavbar, setShowNavbar] = useState(initialTemplate?.show_navbar ?? true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    loadItemsByType()
      .then(setItemsByType)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load content"));
  }, []);

  function loadTemplate(template: HubTemplate | null) {
    setTemplateId(template?.id ?? "");
    setName(template?.name ?? "Default");
    setModules(normalizeModules(template?.modules ?? []));
    setShowNavbar(template?.show_navbar ?? true);
  }

  function selectTrack(id: string) {
    setTrackId(id);
    loadTemplate(templates.filter((t) => t.track_id === id)[0] ?? null);
  }

  const templatesForTrack = templates.filter((t) => t.track_id === trackId);

  async function save() {
    if (!trackId) {
      setError("Pick a track.");
      return;
    }
    if (!name.trim()) {
      setError("A name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const input = { track_id: trackId, name, modules, show_navbar: showNavbar };
      const saved = templateId ? await updateHubTemplate(templateId, input) : await createHubTemplate(input);
      setTemplates((prev) => {
        const exists = prev.some((t) => t.id === saved.id);
        return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
      });
      loadTemplate(saved);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!templateId) return;
    if (!window.confirm(`Delete template "${name}"? Hubs that follow it keep the sections they have now.`)) return;
    try {
      await deleteHubTemplate(templateId);
      const remaining = templates.filter((t) => t.id !== templateId);
      setTemplates(remaining);
      loadTemplate(remaining.filter((t) => t.track_id === trackId)[0] ?? null);
      setJustSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const trackName = tracks.find((t) => t.id === trackId)?.name ?? "this track";

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap" style={{ gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div className="flex items-end flex-wrap" style={{ gap: "var(--space-4)" }}>
          <Select
            label="Template for"
            value={trackId}
            options={tracks.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(e) => selectTrack(e.target.value)}
            style={{ minWidth: 200 }}
          />
          {templatesForTrack.length > 0 && (
            <Select
              label="Template"
              value={templateId}
              options={templatesForTrack.map((t) => ({ value: t.id, label: t.name }))}
              onChange={(e) => loadTemplate(templatesForTrack.find((t) => t.id === e.target.value) ?? null)}
              style={{ minWidth: 200 }}
            />
          )}
          <Button variant="secondary" iconLeft={<Plus size={15} />} onClick={() => loadTemplate(null)} disabled={!trackId}>
            New template
          </Button>
          {templateId && (
            <Button variant="ghost" aria-label="Delete template" onClick={remove}>
              <Trash2 size={16} />
            </Button>
          )}
        </div>
        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <span role="status" aria-live="polite" className="body-sm" style={{ color: "var(--success)" }}>
            {justSaved ? "Saved." : ""}
          </span>
          <Button iconLeft={<Save size={15} />} onClick={save} loading={saving} disabled={!itemsByType}>
            Save template
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        </div>
      )}

      <Input
        label="Template name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ maxWidth: 320, marginBottom: "var(--space-4)" }}
      />
      <div style={{ marginBottom: "var(--space-4)" }}>
        <Checkbox
          label="Show menu items in the navigation bar"
          hint="Turn this off and hubs built from this template keep the bar with the logo and the booking button, without the section links and the Sections menu."
          checked={showNavbar}
          onChange={(e) => setShowNavbar(e.target.checked)}
        />
      </div>
      <p className="body-sm" style={{ color: "var(--ink-muted)", marginBottom: "var(--space-6)" }}>
        These blocks build every {trackName} hub. Turn blocks on or off and set how each one pulls content — a hub can
        still customize its own module list after creation.
      </p>

      {itemsByType ? (
        <ModuleComposer value={modules} onChange={setModules} itemsByType={itemsByType} />
      ) : (
        <RowsSkeleton rows={4} label="Loading content" />
      )}

      <div id="hub-settings" style={{ marginTop: "var(--space-8)" }}>
        <HubSettingsCard initialValue={initialSettings} />
      </div>
    </div>
  );
}

export function HubSettingsCard({ initialValue }: { initialValue: HubSettings }) {
  const [bookingUrl, setBookingUrl] = useState(initialValue.booking_url ?? "");
  const [ctaText, setCtaText] = useState(initialValue.cta_text ?? "");
  const [saved, setSaved] = useState({ bookingUrl: initialValue.booking_url ?? "", ctaText: initialValue.cta_text ?? "" });
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlError = validateBookingUrl(bookingUrl);
  const dirty = bookingUrl.trim() !== saved.bookingUrl || ctaText.trim() !== saved.ctaText;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (urlError) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await updateHubSettings({ booking_url: bookingUrl.trim(), cta_text: ctaText.trim() });
      setSaved({ bookingUrl: bookingUrl.trim(), ctaText: ctaText.trim() });
      setBookingUrl(bookingUrl.trim());
      setCtaText(ctaText.trim());
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Booking link & call to action"
      subtitle="Shown in the hub-ready email and on the closing block of every public hub page. Both are optional."
    >
      <form className="flex flex-col" style={{ gap: "var(--space-5)" }} onSubmit={save} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 items-start" style={{ gap: "var(--space-4)" }}>
          <Input
            type="url"
            label="Booking link"
            placeholder="https://cal.com/ffn/intro"
            value={bookingUrl}
            onChange={(e) => setBookingUrl(e.target.value)}
            error={urlError}
            hint="Leads use this link to book a call with you."
          />
          <Input
            label="Button text"
            placeholder="Book a call with us"
            maxLength={CTA_TEXT_MAX}
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            hint="Leave blank to use Book time with us."
          />
        </div>

        {error && (
          <Alert tone="danger" title="Not saved">
            {error}
          </Alert>
        )}

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <Button type="submit" loading={saving} disabled={!dirty || Boolean(urlError)}>
            Save
          </Button>
          <span className="body-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
            {justSaved && !dirty ? "Saved." : ""}
          </span>
        </div>
      </form>
    </Card>
  );
}
