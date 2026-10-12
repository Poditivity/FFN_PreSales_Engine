"use client";

import { ArrowLeft, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal } from "@/components/ffn";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  updateEmailTemplate,
} from "@/lib/emailEngine/templates";
import type { EmailTemplate } from "@/lib/emailEngine/types";
import {
  resetSystemEmail,
  sampleValues,
  saveSystemEmail,
  SYSTEM_EMAIL_KEYS,
  SYSTEM_EMAIL_TEMPLATES,
  type SystemEmailDef,
} from "@/lib/messaging/systemTemplates";
import {
  bodyToEditorHtml,
  hasVisibleText,
  htmlToPlainText,
  modernizeVariables,
  TEMPLATE_VARIABLES,
  unknownVariables,
} from "@/lib/messaging/text";
import { RichTextEditor } from "./RichTextEditor";

const clamp = (lines: number) =>
  ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }) as const;

function Editor({
  template,
  system,
  onBack,
  onSaved,
  onReset,
}: {
  template: EmailTemplate | null;
  /** Set when this edits one of the messages the system sends on its own. */
  system?: SystemEmailDef;
  onBack: () => void;
  onSaved: (template: EmailTemplate, isNew: boolean) => void;
  onReset?: () => void;
}) {
  const isNew = !template;
  // A system message that has not been edited yet opens on its default wording.
  const [name, setName] = useState(template?.name ?? system?.name ?? "");
  const [subject, setSubject] = useState(modernizeVariables(template?.subject ?? system?.subject ?? ""));
  const [body, setBody] = useState(() => bodyToEditorHtml(modernizeVariables(template?.body ?? system?.body ?? "")));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offered = system?.variables ?? TEMPLATE_VARIABLES;
  const offeredText = offered.map((v) => v.token).join(", ");
  const problems = unknownVariables(`${subject} ${body}`, offered);

  async function save() {
    if (!name.trim() || !subject.trim() || !hasVisibleText(body)) {
      setError("Name, subject and message are all required.");
      return;
    }
    if (problems.length > 0) {
      setError(`Only ${offeredText} can be used. Remove ${problems.join(", ")}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), subject: subject.trim(), body };
      const saved = system
        ? await saveSystemEmail(system.key, template, { subject: input.subject, body })
        : isNew
          ? await createEmailTemplate(input)
          : await updateEmailTemplate(template!.id, input);
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
      await resetSystemEmail(template);
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
          {system ? system.name : isNew ? "New email template" : "Edit email template"}
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
      {problems.length > 0 && !error && (
        <Alert tone="warning" title="Remove what is not available">
          Only {offeredText} can be used. Remove {problems.join(", ")}.
        </Alert>
      )}
      {system && (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          {system.usedWhen} Until you save, the default wording below is what goes out.
        </p>
      )}

      <div className="hubform-grid">
        {system ? null : (
          <Input label="Template name" hint="Only your team sees this." required value={name} onChange={(e) => setName(e.target.value)} placeholder="Discovery call invite" />
        )}
        <Input label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A note for {{name}}" />
      </div>
      <RichTextEditor value={body} onChange={setBody} previewName="Ananya" previewVars={system ? sampleValues(system.variables) : undefined} />
      {system ? (
        <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          {system.variables.map((v) => (
            <p key={v.key} className="caption" style={{ color: "var(--ink-muted)", margin: 0 }}>
              <span className="data-sm">{v.token}</span> is filled in with {v.label.toLowerCase()}.
            </p>
          ))}
          {system.optional.length > 0 && (
            <p className="caption" style={{ color: "var(--ink-muted)", margin: 0 }}>
              A paragraph that uses {system.optional.map((k) => `{{${k}}}`).join(" or ")} is left out when there is no value for it.
            </p>
          )}
        </div>
      ) : (
        <p className="caption" style={{ color: "var(--ink-muted)", margin: 0 }}>
          Name becomes the lead&apos;s name, or &quot;there&quot; if there is none. Hub link becomes the address of their own hub. A message that uses it is not sent to a lead who has no hub yet.
        </p>
      )}
    </div>
  );
}

export function EmailTemplatesPanel({
  templates,
  onChange,
  systemRows,
  onSystemChange,
}: {
  templates: EmailTemplate[];
  onChange: (templates: EmailTemplate[]) => void;
  /** The rows saved for the system messages. A message with no row is on its default wording. */
  systemRows: EmailTemplate[];
  onSystemChange: (rows: EmailTemplate[]) => void;
}) {
  const [editing, setEditing] = useState<EmailTemplate | "new" | null>(null);
  const [editingSystem, setEditingSystem] = useState<SystemEmailDef | null>(null);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteEmailTemplate(deleting.id);
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
          Written once, used for manual emails and stage rules. Use <span className="data-sm">{"{{name}}"}</span> to greet a lead by name.
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

      <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <div>
          <h3 className="h3" style={{ margin: 0 }}>Sent automatically</h3>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-1) 0 0" }}>
            The system sends these on its own. Edit the wording here. Until you save a change, the default is sent.
          </p>
        </div>
        <div className="msg-grid">
          {SYSTEM_EMAIL_KEYS.map((key) => {
            const def = SYSTEM_EMAIL_TEMPLATES[key];
            const row = systemRows.find((r) => r.system_key === key) ?? null;
            return (
              <Card key={key}>
                <div className="flex flex-col" style={{ gap: "var(--space-2)", minHeight: 140 }}>
                  <div className="flex items-start justify-between" style={{ gap: "var(--space-2)" }}>
                    <p className="body-medium" style={{ margin: 0, overflowWrap: "anywhere" }}>{def.name}</p>
                    <Badge tone={row ? "brand" : "neutral"} dot={false}>
                      {row ? "Edited" : "Default"}
                    </Badge>
                  </div>
                  <p className="caption" style={{ margin: 0, color: "var(--ink-muted)" }}>{def.usedWhen}</p>
                  <p className="body-sm" style={{ margin: 0, color: "var(--ink)", ...clamp(1) }}>{row?.subject ?? def.subject}</p>
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
        <h3 className="h3" style={{ margin: "var(--space-2) 0 0" }}>Your templates</h3>
      </div>

      {templates.length === 0 ? (
        <EmptyState title="No email templates yet">Create one to reuse it when you write to a lead.</EmptyState>
      ) : (
        <div className="msg-grid">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-col" style={{ gap: "var(--space-2)", minHeight: 140 }}>
                <p className="body-medium" style={{ margin: 0, overflowWrap: "anywhere" }}>{t.name}</p>
                <p className="body-sm" style={{ margin: 0, color: "var(--ink)", ...clamp(1) }}>{t.subject}</p>
                <p className="body-sm" style={{ margin: 0, color: "var(--ink-muted)", ...clamp(3) }}>
                  {htmlToPlainText(bodyToEditorHtml(t.body))}
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
          <p className="body" style={{ margin: 0 }}>
            A stage rule that uses this template will need a new one before it sends again. This cannot be undone.
          </p>
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
