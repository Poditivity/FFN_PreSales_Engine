"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, Select, Textarea } from "@/components/ffn";
import { isValidEmail } from "@/lib/forms/formLogic";
import { ModuleComposer, normalizeModules, type ItemOption } from "@/components/hubs/ModuleComposer";
import type { Track } from "@/lib/content/types";
import { createHub, sendHub } from "@/lib/hubs/hubs";
import { loadItemsByType } from "@/lib/hubs/pickerItems";
import { hubDraftPreviewPath, stashHubDraft } from "@/lib/hubs/publicHub";
import { listHubTemplatesForTrack } from "@/lib/hubs/templates";
import type { BlockType, Hub, HubModule, HubTemplate } from "@/lib/hubs/types";

// The hub-creation flow: pick a track and template, optionally customize
// modules and add Lead Context, then create. Shared by ProofHubCard (the
// per-lead entry point, always a real leadId), the admin-wide Hubs list's
// "From application" flow (also a real leadId, picked first), and that same
// list's "New hub" flow (leadId null — a standalone hub for someone who
// isn't a lead, identified by the Name/Email/WhatsApp fields shown below
// instead) — one implementation, not three.
export function CreateHubModal({
  leadId,
  tracks,
  onClose,
  onCreated,
}: {
  leadId: string | null;
  tracks: Track[];
  onClose: () => void;
  onCreated: (hub: Hub) => void;
}) {
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const [templates, setTemplates] = useState<HubTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [customize, setCustomize] = useState(false);
  const [modules, setModules] = useState<HubModule[]>(normalizeModules([]));
  const [itemsByType, setItemsByType] = useState<Record<BlockType, ItemOption[]> | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantWhatsapp, setApplicantWhatsapp] = useState("");
  const [startupName, setStartupName] = useState("");
  const [founderStage, setFounderStage] = useState("");
  const [currentContext, setCurrentContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");
  // Set when the hub was created but the email could not be sent. The box stays open to say so.
  const [unsent, setUnsent] = useState<{ hub: Hub; reason: string } | null>(null);

  useEffect(() => {
    loadItemsByType()
      .then(setItemsByType)
      .catch(() => {
        // hand-picked-mode picker lists are a nice-to-have; missing them
        // shouldn't block creating a hub with automatic-mode modules
      });
  }, []);

  function selectTemplate(id: string, list: HubTemplate[]) {
    setTemplateId(id);
    setModules(normalizeModules(list.find((t) => t.id === id)?.modules ?? []));
    setCustomize(false);
  }

  useEffect(() => {
    if (!trackId) return;
    // Guard against a stale response: if trackId changes again before this
    // fetch resolves (e.g. the initial default track's fetch racing the
    // fetch for a track the user then explicitly picks), the cleanup below
    // marks it cancelled so it can never overwrite state with the wrong
    // track's templates.
    let cancelled = false;
    listHubTemplatesForTrack(trackId).then((ts) => {
      if (cancelled) return;
      setTemplates(ts);
      selectTemplate(ts[0]?.id ?? "", ts);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  // Opens the hub as it would be created, in a new tab, without saving anything.
  // Opened straight from the click so the browser does not treat it as a popup.
  function preview() {
    if (!trackId || !templateId) {
      setError("Pick a track and template to preview.");
      return;
    }
    const key = stashHubDraft({
      lead_id: leadId,
      track_id: trackId,
      template_id: templateId,
      modules: customize ? modules : null,
      startup_name: startupName.trim() || null,
      founder_stage: founderStage.trim() || null,
      current_context: currentContext.trim() || null,
      applicant_name: leadId ? null : applicantName.trim() || null,
      applicant_email: leadId ? null : applicantEmail.trim() || null,
      applicant_whatsapp: leadId ? null : applicantWhatsapp.trim() || null,
    });
    if (!key) {
      setError("This browser would not let the preview open. Allow site storage and try again.");
      return;
    }
    setError(null);
    window.open(hubDraftPreviewPath(key), "_blank");
  }

  async function create() {
    if (!trackId || !templateId) {
      setError("Pick a track and template.");
      return;
    }
    if (!leadId && !applicantName.trim()) {
      setError("A name is required.");
      return;
    }
    if (!leadId && !applicantEmail.trim()) {
      setError("An email is required to send a standalone hub.");
      return;
    }
    if (!leadId && !isValidEmail(applicantEmail)) {
      setEmailError("Enter a valid email address");
      setError("Check the email address.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // modules stays null (inherit the template) unless staff explicitly
      // turned on customization — that's the null-vs-array rule from
      // src/lib/hubs/modules.ts, applied at creation time.
      const hub = await createHub({
        lead_id: leadId,
        track_id: trackId,
        template_id: templateId,
        modules: customize ? modules : null,
        startup_name: startupName.trim() || null,
        founder_stage: founderStage.trim() || null,
        current_context: currentContext.trim() || null,
        applicant_name: leadId ? null : applicantName.trim() || null,
        applicant_email: leadId ? null : applicantEmail.trim() || null,
        applicant_whatsapp: leadId ? null : applicantWhatsapp.trim() || null,
      });
      // Create & Send is one action: send right away rather than leaving a draft to
      // find later. If the send fails (e.g. no email on file) the hub still exists as
      // a draft with its Send button, and this box says so instead of closing quietly.
      const sent = await sendHub(hub.id);
      if (sent.ok) onCreated({ ...hub, status: "sent" });
      else setUnsent({ hub, reason: sent.error ?? "Send failed" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (unsent) {
    return (
      <Modal title="Hub created, not sent" onClose={() => onCreated(unsent.hub)}>
        <Alert tone="warning" title="The email was not sent">
          The hub was created and is saved as a draft, but the email could not be sent: {unsent.reason}. Fix that, then open the hub
          and use Send (or use the send icon on the Hubs list).
        </Alert>
        <div className="flex justify-end">
          <Button onClick={() => onCreated(unsent.hub)}>Open the hub</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Create proof hub" onClose={onClose} xwide>
      <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "calc(var(--space-2) * -1) 0 0" }}>
        A private page built from your content library. Creating it sends the link by email right away. Preview shows it first and saves nothing.
      </p>

      {!leadId && (
        <Section step={1} title="Who is it for" hint="A standalone hub has no application behind it, so these details identify the person.">
          <div className="hubform-grid hubform-grid--3">
            <div>
              <Input label="Applicant name" required value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
            </div>
            <Input
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              required
              value={applicantEmail}
              onChange={(e) => {
                setApplicantEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              error={emailError || undefined}
            />
            <Input
              label="WhatsApp number"
              type="tel"
              inputMode="tel"
              placeholder="9876543210"
              value={applicantWhatsapp}
              onChange={(e) => setApplicantWhatsapp(e.target.value)}
              hint="Optional. Used to send the hub link on WhatsApp once WhatsApp is connected."
            />
          </div>
        </Section>
      )}

      <Section step={leadId ? 1 : 2} title="What they see" hint="The track filters the content. The template sets the sections and their order.">
        <div className="hubform-grid">
          <Select
            label="Track"
            value={trackId}
            options={tracks.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(e) => setTrackId(e.target.value)}
          />
          <Select
            label="Template"
            value={templateId}
            disabled={templates.length === 0}
            placeholder={templates.length === 0 ? "No templates for this track" : undefined}
            hint={templates.length === 0 ? "Create one under Hub templates first." : undefined}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(e) => selectTemplate(e.target.value, templates)}
          />
        </div>
      </Section>

      <Section
        step={leadId ? 2 : 3}
        title="Personalise"
        optional
        hint="Shown to the applicant at the top of the hub. Leave blank to skip."
      >
        <div className="hubform-grid">
          <Input label="Startup name" value={startupName} onChange={(e) => setStartupName(e.target.value)} />
          <Input label="Founder stage" value={founderStage} onChange={(e) => setFounderStage(e.target.value)} />
          <div className="hubform-span">
            <Textarea
              label="Current context or problem"
              rows={3}
              value={currentContext}
              onChange={(e) => setCurrentContext(e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section step={leadId ? 3 : 4} title="Sections" hint="By default the hub follows its template.">
        <Checkbox
          label="Customise the sections for this hub"
          hint="Pick which sections appear and in what order, instead of following the template."
          checked={customize}
          onChange={(e) => setCustomize(e.target.checked)}
        />
        {customize && itemsByType && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <ModuleComposer value={modules} onChange={setModules} itemsByType={itemsByType} />
          </div>
        )}
      </Section>

      {error && (
        <Alert tone="danger" title="Not created">
          {error}
        </Alert>
      )}

      <div className="hubform-footer">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          iconLeft={<Eye size={15} />}
          onClick={preview}
          disabled={saving || !templateId}
          title="See the hub as the applicant will, without creating or sending it"
        >
          Preview
        </Button>
        <Button
          onClick={create}
          loading={saving}
          disabled={!templateId || (!leadId && (!applicantName.trim() || !applicantEmail.trim()))}
        >
          Create & Send
        </Button>
      </div>
    </Modal>
  );
}

function Section({
  step,
  title,
  hint,
  optional,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="hubform-section">
      <header className="flex items-start" style={{ gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <span className="hubform-step data-sm" aria-hidden="true">
          {step}
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 className="h3" style={{ margin: 0 }}>
            {title}
            {optional && (
              <span className="body-sm" style={{ color: "var(--ink-subtle)", fontWeight: 400 }}>
                {" "}
                (optional)
              </span>
            )}
          </h3>
          {hint && (
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 0" }}>
              {hint}
            </p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}
