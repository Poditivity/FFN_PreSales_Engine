"use client";

import { ArrowLeft, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Textarea } from "@/components/ffn";
import {
  resetSystemWhatsApp,
  saveSystemWhatsApp,
  SYSTEM_WHATSAPP_TEMPLATES,
  type SystemWhatsAppDef,
} from "@/lib/messaging/systemTemplates";
import { modernizeVariables, unknownVariables, WHATSAPP_VARIABLES } from "@/lib/messaging/text";
import {
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  updateWhatsAppTemplate,
  WA_MAX_CHARS,
  WA_WARN_CHARS,
  type WhatsAppTemplate,
} from "@/lib/messaging/whatsapp";

function Editor({
  template,
  system,
  onBack,
  onSaved,
  onReset,
}: {
  template: WhatsAppTemplate | null;
  /** Set when this edits one of the messages the system fills in itself. */
  system?: SystemWhatsAppDef;
  onBack: () => void;
  onSaved: (template: WhatsAppTemplate, isNew: boolean) => void;
  onReset?: () => void;
}) {
  const isNew = !template;
  const [name, setName] = useState(template?.name ?? system?.name ?? "");
  const [body, setBody] = useState(modernizeVariables(template?.body ?? system?.body ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offered = system?.variables ?? WHATSAPP_VARIABLES;
  const offeredText = offered.map((v) => v.token).join(", ");
  const problems = unknownVariables(body, offered);
  const tone = body.length > WA_MAX_CHARS ? "var(--danger)" : body.length >= WA_WARN_CHARS ? "var(--warning)" : "var(--ink-subtle)";

  async function save() {
    if (!name.trim() || !body.trim()) {
      setError("Name and message are both required.");
      return;
    }
    if (body.length > WA_MAX_CHARS) {
      setError(`The message is over the ${WA_MAX_CHARS} character limit.`);
      return;
    }
    if (problems.length > 0) {
      setError(`Only ${offeredText} can be used. Remove ${problems.join(", ")}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), body };
      const saved = system
        ? await saveSystemWhatsApp(system.key, template, body)
        : isNew
          ? await createWhatsAppTemplate(input)
          : await updateWhatsAppTemplate(template!.id, input);
      onSaved(saved, isNew);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      await resetSystemWhatsApp(template);
      onReset?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
        <Button variant="secondary" size="sm" aria-label="Back to templates" onClick={onBack}>
          <ArrowLeft size={15} />
        </Button>
        <h2 className="h2" style={{ margin: 0, flex: 1, minWidth: 0 }}>
          {system ? system.name : isNew ? "New WhatsApp template" : "Edit WhatsApp template"}
        </h2>
        {system && template && (
          <Button variant="secondary" iconLeft={<RotateCcw size={15} />} disabled={saving} onClick={reset}>
            Reset to default
          </Button>
        )}
        <Button iconLeft={<Save size={15} />} loading={saving} onClick={save}>
          Save
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Not saved">
          {error}
        </Alert>
      )}

      {system ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          {system.usedWhen} Until you save, the default wording below is used.
        </p>
      ) : (
        <Input label="Template name" hint="Only your team sees this." required value={name} onChange={(e) => setName(e.target.value)} placeholder="Discovery call reminder" />
      )}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-1)" }}>
          <span className="label">Message</span>
          <span className="data-sm" style={{ color: tone }}>
            {body.length} / {WA_MAX_CHARS}
          </span>
        </div>
        <Textarea aria-label="Message" rows={9} placeholder="Hi {{name}}, ..." value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {offered.map((v) => (
            <button
              key={v.token}
              type="button"
              className="msg-var data-sm"
              onClick={() => setBody((b) => `${b}${b && !b.endsWith(" ") && !b.endsWith("\n") ? " " : ""}${v.token}`)}
            >
              {v.token}
            </button>
          ))}
          <span className="caption" style={{ color: "var(--ink-muted)" }}>
            {system
              ? "Each one is filled in when the message is made."
              : "Name becomes the lead's name, or \"there\" if there is none. Hub link becomes their own hub."}
          </span>
        </div>
      </div>
      {problems.length > 0 && !error && (
        <Alert tone="warning" title="Remove what is not available">
          Only {offeredText} can be used. Remove {problems.join(", ")}.
        </Alert>
      )}
    </div>
  );
}

export function WhatsAppTemplatesPanel({
  templates,
  onChange,
  systemRows,
  onSystemChange,
}: {
  templates: WhatsAppTemplate[];
  onChange: (templates: WhatsAppTemplate[]) => void;
  /** The rows saved for the system messages. A message with no row is on its default wording. */
  systemRows: WhatsAppTemplate[];
  onSystemChange: (rows: WhatsAppTemplate[]) => void;
}) {
  const [editing, setEditing] = useState<WhatsAppTemplate | "new" | null>(null);
  const [editingSystem, setEditingSystem] = useState<SystemWhatsAppDef | null>(null);
  const [deleting, setDeleting] = useState<WhatsAppTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteWhatsAppTemplate(deleting.id);
      onChange(templates.filter((t) => t.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (editingSystem) {
    const row = systemRows.find((r) => r.system_key === editingSystem.key) ?? null;
    return (
      <Editor
        template={row}
        system={editingSystem}
        onBack={() => setEditingSystem(null)}
        onSaved={(saved) => {
          onSystemChange(systemRows.some((r) => r.id === saved.id) ? systemRows.map((r) => (r.id === saved.id ? saved : r)) : [...systemRows, saved]);
          setEditingSystem(null);
        }}
        onReset={() => {
          onSystemChange(systemRows.filter((r) => r.system_key !== editingSystem.key));
          setEditingSystem(null);
        }}
      />
    );
  }

  if (editing) {
    return (
      <Editor
        template={editing === "new" ? null : editing}
        onBack={() => setEditing(null)}
        onSaved={(saved, isNew) => {
          onChange(isNew ? [...templates, saved].sort((a, b) => a.name.localeCompare(b.name)) : templates.map((t) => (t.id === saved.id ? saved : t)));
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: "var(--space-3)" }}>
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          Messages for WhatsApp. Pick a system message to edit, or write your own template.
        </p>
        <Button iconLeft={<Plus size={15} />} onClick={() => setEditing("new")}>
          New template
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      <Alert tone="warning" title="WhatsApp is not connected to Meta yet">
        Every template here can be edited for now. When you connect WhatsApp, Meta must approve the exact text of each message that
        goes out through it, so make those templates non-editable then. The Meta template name to register is shown on each one.
      </Alert>

      <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <div>
          <h3 className="h3" style={{ margin: 0 }}>System messages</h3>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 0" }}>
            Nothing here sends by itself yet. Until you save a change, the default wording is used.
          </p>
        </div>
        <div className="msg-grid">
          {Object.values(SYSTEM_WHATSAPP_TEMPLATES).map((def) => {
            const row = systemRows.find((r) => r.system_key === def.key) ?? null;
            return (
              <Card key={def.key}>
                <div className="flex flex-col" style={{ gap: "var(--space-2)", minHeight: 120 }}>
                  <div className="flex items-start justify-between" style={{ gap: "var(--space-2)" }}>
                    <p className="body-medium" style={{ margin: 0, overflowWrap: "anywhere" }}>{def.name}</p>
                    <Badge tone={row ? "brand" : "neutral"} dot={false}>
                      {row ? "Edited" : "Default"}
                    </Badge>
                  </div>
                  <p className="caption" style={{ margin: 0, color: "var(--ink-muted)" }}>{def.usedWhen}</p>
                  <p
                    className="body-sm"
                    style={{ margin: 0, color: "var(--ink-muted)", whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}
                  >
                    {row?.body ?? def.body}
                  </p>
                  {def.metaName && (
                    <p className="caption data-sm" style={{ margin: 0, color: "var(--ink-subtle)" }}>
                      Meta template name: {def.metaName}
                    </p>
                  )}
                  <div style={{ marginTop: "auto", paddingTop: "var(--space-2)" }}>
                    <Button variant="secondary" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setEditingSystem(def)}>
                      Edit
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <div>
          <h3 className="h3" style={{ margin: "var(--space-2) 0 0" }}>Your templates</h3>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 0" }}>
            Plain-text messages you load into the composer. You copy them, filled in for each lead, and paste them into WhatsApp.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState title="No WhatsApp templates yet">Create one to reuse it when you message a lead.</EmptyState>
      ) : (
        <div className="msg-grid">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-col" style={{ gap: "var(--space-2)", minHeight: 120 }}>
                <p className="body-medium" style={{ margin: 0, overflowWrap: "anywhere" }}>{t.name}</p>
                <p
                  className="body-sm"
                  style={{ margin: 0, color: "var(--ink-muted)", whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}
                >
                  {t.body}
                </p>
                <div className="flex items-center" style={{ gap: "var(--space-2)", marginTop: "auto", paddingTop: "var(--space-2)" }}>
                  <Button variant="secondary" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {deleting && (
        <Modal title={`Delete "${deleting.name}"?`} onClose={() => setDeleting(null)}>
          <p className="body" style={{ margin: 0 }}>This cannot be undone.</p>
          <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmDelete}>
              Delete template
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
