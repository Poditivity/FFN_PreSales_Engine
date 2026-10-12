"use client";

import { AlertTriangle, Check, Copy, Mail, MessageCircle, Save, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Input, Modal, Select, Textarea } from "@/components/ffn";
import { createEmailTemplate } from "@/lib/emailEngine/templates";
import type { EmailTemplate } from "@/lib/emailEngine/types";
import { sendLeadEmail } from "@/lib/emailEngine/thread";
import { hubUrl } from "@/lib/hubs/hubs";
import type { MessageRecipient } from "@/lib/messaging/recipients";
import {
  bodyToEditorHtml,
  hasVisibleText,
  modernizeVariables,
  personalizeHtml,
  personalizeText,
  TEMPLATE_VARIABLES,
  unknownVariables,
  WHATSAPP_VARIABLES,
} from "@/lib/messaging/text";
import {
  copyToClipboard,
  usesHubLink,
  WA_MAX_CHARS,
  WA_WARN_CHARS,
  whatsappMessage,
  type WhatsAppTemplate,
} from "@/lib/messaging/whatsapp";
import { SYSTEM_EMAIL_KEYS, SYSTEM_EMAIL_TEMPLATES, SYSTEM_WHATSAPP_TEMPLATES, type SystemVariable } from "@/lib/messaging/systemTemplates";
import { RichTextEditor } from "./RichTextEditor";

export type Channel = "email" | "whatsapp";

/** One entry in "Start from a template": the team's own, or a message the system sends itself. */
interface TemplateChoice {
  id: string;
  label: string;
  subject: string;
  body: string;
  /** Set for a system message: the variables that message was written for. */
  variables?: readonly SystemVariable[];
}

const SYSTEM_PREFIX = "system:";

type Outcome = { status: "sending" | "sent" | "failed" | "skipped"; error?: string };

const CONFIRM_ABOVE = 5;

function CharCounter({ length }: { length: number }) {
  const tone = length > WA_MAX_CHARS ? "var(--danger)" : length >= WA_WARN_CHARS ? "var(--warning)" : "var(--ink-subtle)";
  return (
    <span className="data-sm" style={{ color: tone }} aria-live="polite">
      {length} / {WA_MAX_CHARS}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  if (outcome.status === "sending") return <Badge tone="neutral" dot={false}>Sending</Badge>;
  if (outcome.status === "sent") return <Badge tone="success">Sent</Badge>;
  if (outcome.status === "skipped") return <Badge tone="warning" dot={false}>Skipped</Badge>;
  return <Badge tone="danger">Failed</Badge>;
}

/**
 * Writes one message and sends it to the recipients it is given. The Messaging
 * page hands it the leads ticked in its picker; a lead's own page hands it that
 * one lead. Email goes out through the lead-email-send function, one lead at a
 * time, and is logged in the lead's thread. WhatsApp is on hold, so a WhatsApp
 * message is copied per lead with their name and hub link filled in, for staff
 * to paste into WhatsApp themselves.
 */
export function Composer({
  recipients,
  channel,
  onChannelChange,
  emailTemplates,
  whatsappTemplates,
  systemEmails = [],
  systemWhatsApp = [],
  onEmailTemplateSaved,
  onSent,
}: {
  recipients: MessageRecipient[];
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  emailTemplates: EmailTemplate[];
  whatsappTemplates: WhatsAppTemplate[];
  /** The saved wording of the system messages. One with no row is offered on its default wording. */
  systemEmails?: EmailTemplate[];
  systemWhatsApp?: WhatsAppTemplate[];
  onEmailTemplateSaved?: (template: EmailTemplate) => void;
  /** Called after at least one email left, so a thread on the same page can reload. */
  onSent?: () => void;
}) {
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [waText, setWaText] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingAs, setSavingAs] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewName = recipients[0]?.name ?? "";
  const withEmail = useMemo(() => recipients.filter((r) => r.email), [recipients]);
  // A message that uses {{hub_link}} is never sent to a lead with no hub: the link would be empty.
  const needsHubEmail = channel === "email" && usesHubLink(`${subject} ${bodyHtml}`);
  const sendable = useMemo(() => withEmail.filter((r) => !needsHubEmail || r.hubToken), [withEmail, needsHubEmail]);
  const noHubCount = withEmail.length - sendable.length;

  const problems = useMemo(
    () => (channel === "email" ? unknownVariables(`${subject} ${bodyHtml}`) : unknownVariables(waText, WHATSAPP_VARIABLES)),
    [channel, subject, bodyHtml, waText],
  );

  function clearResults() {
    setOutcomes({});
    setNotice(null);
    setError(null);
  }

  const choices = useMemo<TemplateChoice[]>(() => {
    const own: TemplateChoice[] =
      channel === "email"
        ? emailTemplates.map((t) => ({ id: t.id, label: t.name, subject: t.subject, body: t.body }))
        : whatsappTemplates.map((t) => ({ id: t.id, label: t.name, subject: "", body: t.body }));
    // The system messages come after the team's own, each on its saved wording or, until someone edits it, its default.
    const system: TemplateChoice[] =
      channel === "email"
        ? SYSTEM_EMAIL_KEYS.map((key) => {
            const def = SYSTEM_EMAIL_TEMPLATES[key];
            const row = systemEmails.find((r) => r.system_key === key);
            return {
              id: SYSTEM_PREFIX + key,
              label: `${def.name} (system)`,
              subject: row?.subject?.trim() ? row.subject : def.subject,
              body: row?.body?.trim() ? row.body : def.body,
              variables: def.variables,
            };
          })
        : Object.values(SYSTEM_WHATSAPP_TEMPLATES).map((def) => {
            const row = systemWhatsApp.find((r) => r.system_key === def.key);
            return { id: SYSTEM_PREFIX + def.key, label: `${def.name} (system)`, subject: "", body: row?.body?.trim() ? row.body : def.body, variables: def.variables };
          });
    return [...own, ...system];
  }, [channel, emailTemplates, whatsappTemplates, systemEmails, systemWhatsApp]);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    clearResults();
    if (!id) {
      // Back to "Blank message": drop what the template filled in.
      if (channel === "email") {
        setSubject("");
        setBodyHtml("");
      } else {
        setWaText("");
      }
      return;
    }
    const t = choices.find((x) => x.id === id);
    if (!t) return;
    if (channel === "email") {
      setSubject(modernizeVariables(t.subject));
      setBodyHtml(bodyToEditorHtml(modernizeVariables(t.body)));
    } else {
      setWaText(modernizeVariables(t.body));
    }
  }

  function switchChannel(next: Channel) {
    if (next === channel) return;
    setTemplateId("");
    clearResults();
    onChannelChange(next);
  }

  const emailReady = subject.trim() !== "" && hasVisibleText(bodyHtml) && problems.length === 0 && sendable.length > 0;

  async function sendEmails() {
    setConfirmOpen(false);
    setError(null);
    setNotice(null);
    setSending(true);
    const start: Record<string, Outcome> = {};
    recipients.forEach((r) => {
      start[r.leadId] = !r.email
        ? { status: "skipped", error: "No email address on file" }
        : needsHubEmail && !r.hubToken
          ? { status: "skipped", error: "No hub yet" }
          : { status: "sending" };
    });
    setOutcomes(start);

    let sent = 0;
    let failed = 0;
    for (const r of sendable) {
      const extra = { hub_link: r.hubToken ? hubUrl(r.hubToken) : "" };
      const result = await sendLeadEmail(r.leadId, personalizeText(subject, r.name, extra), personalizeHtml(bodyHtml, r.name, extra));
      setOutcomes((prev) => ({
        ...prev,
        [r.leadId]: result.ok ? { status: "sent" } : { status: "failed", error: result.error ?? "Send failed" },
      }));
      if (result.ok) sent += 1;
      else failed += 1;
    }
    setSending(false);
    setNotice(`${sent} sent${failed ? `, ${failed} failed` : ""}${recipients.length > sendable.length ? `, ${recipients.length - sendable.length} skipped` : ""}.`);
    if (sent > 0) onSent?.();
  }

  function requestSend() {
    if (!emailReady || sending) return;
    if (sendable.length > CONFIRM_ABOVE) setConfirmOpen(true);
    else void sendEmails();
  }

  async function saveTemplate() {
    const name = (savingAs ?? "").trim();
    if (!name) return;
    setSaveBusy(true);
    setError(null);
    try {
      if (channel === "email") {
        const saved = await createEmailTemplate({ name, subject: subject.trim(), body: bodyHtml });
        onEmailTemplateSaved?.(saved);
        setTemplateId(saved.id);
      }
      setSavingAs(null);
      setNotice(`Saved "${name}" as a template.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the template");
    } finally {
      setSaveBusy(false);
    }
  }

  async function copyMessage() {
    const ok = await copyToClipboard(whatsappMessage(waText, previewName, recipients[0]?.hubToken));
    if (!ok) {
      setError("Copying is not allowed in this browser. Select the text in the preview and copy it.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyFor(r: MessageRecipient) {
    const ok = await copyToClipboard(whatsappMessage(waText, r.name, r.hubToken));
    if (!ok) {
      setError("Copying is not allowed in this browser. Select the text in the preview and copy it.");
      return;
    }
    setError(null);
    setCopiedIds((prev) => new Set(prev).add(r.leadId));
  }

  const waReady = waText.trim() !== "" && waText.length <= WA_MAX_CHARS && problems.length === 0;
  const needsHub = usesHubLink(waText);
  const templateOptions = choices.map((t) => ({ value: t.id, label: t.label }));
  // A system message is written for the email it belongs to, so it can hold variables that are only filled in there.
  const chosenSystem = choices.find((t) => t.id === templateId)?.variables;
  const notFilledHere = (chosenSystem ?? []).filter((v) => !TEMPLATE_VARIABLES.some((o) => o.key === v.key));

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: "var(--space-3)" }}>
        <div className="dash-segment" role="group" aria-label="Channel">
          {(
            [
              { key: "email", icon: Mail, label: "Email" },
              { key: "whatsapp", icon: MessageCircle, label: "WhatsApp" },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              className="dash-segment__btn label-sm flex items-center"
              style={{ gap: "var(--space-2)" }}
              aria-pressed={channel === key}
              onClick={() => switchChannel(key)}
            >
              <Icon size={14} strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
          {recipients.length === 0
            ? "Choose who this goes to."
            : `To ${recipients.length} ${recipients.length === 1 ? "lead" : "leads"}: ${recipients
                .slice(0, 2)
                .map((r) => r.name || r.email || "Unknown")
                .join(", ")}${recipients.length > 2 ? ` and ${recipients.length - 2} more` : ""}`}
        </p>
      </div>

      <Select
        label={channel === "email" ? "Start from an email template" : "Start from a WhatsApp template"}
        value={templateId}
        placeholder="Blank message"
        options={templateOptions}
        hint={
          notFilledHere.length > 0
            ? `This is a message the system sends on its own. ${notFilledHere.map((v) => v.token).join(", ")} ${notFilledHere.length === 1 ? "is" : "are"} only filled in there, so replace ${notFilledHere.length === 1 ? "it" : "them"} with real text before sending.`
            : undefined
        }
        onChange={(e) => chooseTemplate(e.target.value)}
      />

      {channel === "email" ? (
        <>
          <Input
            label="Subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              clearResults();
            }}
          />
          <RichTextEditor
            value={bodyHtml}
            onChange={(html) => {
              setBodyHtml(html);
              clearResults();
            }}
            previewName={previewName}
          />
        </>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-1)" }}>
              <span className="label">Message</span>
              <CharCounter length={waText.length} />
            </div>
            <Textarea
              aria-label="WhatsApp message"
              rows={7}
              placeholder="Write your WhatsApp message"
              value={waText}
              onChange={(e) => {
                setWaText(e.target.value);
                clearResults();
              }}
            />
            <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              {WHATSAPP_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  className="msg-var data-sm"
                  onClick={() => setWaText((t) => `${t}${t && !t.endsWith(" ") && !t.endsWith("\n") ? " " : ""}${v.token}`)}
                >
                  {v.token}
                </button>
              ))}
              <span className="caption" style={{ color: "var(--ink-muted)" }}>
                Name becomes the lead&apos;s name, or &quot;there&quot; if there is none. Hub link becomes their own hub.
              </span>
            </div>
          </div>
          {waText.trim() && (
            <div className="msg-card" style={{ background: "var(--surface-sunken)" }}>
              <p className="eyebrow" style={{ color: "var(--ink-subtle)", textTransform: "uppercase", margin: "0 0 var(--space-2)" }}>
                Preview{previewName ? ` for ${previewName}` : ""}
              </p>
              <p className="body" style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {whatsappMessage(waText, previewName, recipients[0]?.hubToken)}
              </p>
            </div>
          )}
        </>
      )}

      {problems.length > 0 && (
        <Alert tone="warning" title="Remove what is not available">
          Only {(channel === "email" ? TEMPLATE_VARIABLES : WHATSAPP_VARIABLES).map((v) => v.token).join(", ")} can be used. Remove {problems.join(", ")} before sending.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
      {notice && (
        <p className="body-sm" role="status" style={{ margin: 0, color: "var(--ink-muted)" }}>
          {notice}
        </p>
      )}

      {channel === "email" ? (
        <>
          {recipients.length > withEmail.length && (
            <p className="body-sm flex items-center" style={{ gap: "var(--space-2)", color: "var(--ink-muted)", margin: 0 }}>
              <AlertTriangle size={14} aria-hidden /> {recipients.length - withEmail.length} of the chosen leads have no email address and will be skipped.
            </p>
          )}
          {noHubCount > 0 && (
            <p className="body-sm flex items-center" style={{ gap: "var(--space-2)", color: "var(--ink-muted)", margin: 0 }}>
              <AlertTriangle size={14} aria-hidden /> {noHubCount} of the chosen leads have no hub yet and will be skipped, because this message uses a hub link.
            </p>
          )}
          <div className="flex items-center flex-wrap" style={{ gap: "var(--space-3)" }}>
            <Button iconLeft={<Send size={15} />} onClick={requestSend} loading={sending} disabled={!emailReady}>
              {sendable.length > 1 ? `Send email to ${sendable.length}` : "Send email"}
            </Button>
            {savingAs === null ? (
              <Button
                variant="secondary"
                iconLeft={<Save size={15} />}
                disabled={!subject.trim() || !hasVisibleText(bodyHtml)}
                onClick={() => setSavingAs("")}
              >
                Save as template
              </Button>
            ) : (
              <div className="flex items-end" style={{ gap: "var(--space-2)" }}>
                <Input size="sm" aria-label="Template name" placeholder="Template name" value={savingAs} onChange={(e) => setSavingAs(e.target.value)} />
                <Button size="sm" onClick={saveTemplate} loading={saveBusy} disabled={!savingAs.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSavingAs(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
          {Object.keys(outcomes).length > 0 && recipients.length > 1 && (
            <div className="msg-card" style={{ padding: 0 }}>
              {recipients.map((r, i) => {
                const o = outcomes[r.leadId];
                return (
                  <div
                    key={r.leadId}
                    className="flex items-center justify-between"
                    style={{ gap: "var(--space-3)", padding: "var(--space-2) var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
                  >
                    <span className="body-sm" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      {r.name || r.email || "Unknown"}
                      {o?.error && <span className="caption" style={{ display: "block", color: "var(--ink-muted)" }}>{o.error}</span>}
                    </span>
                    {o && <OutcomeBadge outcome={o} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <div className="flex items-center flex-wrap" style={{ gap: "var(--space-3)" }}>
            <Button variant="secondary" iconLeft={copied ? <Check size={15} /> : <Copy size={15} />} onClick={copyMessage} disabled={!waText.trim()}>
              {copied ? "Copied" : "Copy message"}
            </Button>
            <p className="caption" style={{ color: "var(--ink-muted)", margin: 0 }}>
              Copy the message for each lead below, then paste it into WhatsApp and send it there.
            </p>
          </div>
          {recipients.length > 0 && (
            <div className="msg-card" style={{ padding: 0 }}>
              {recipients.map((r, i) => {
                return (
                  <div
                    key={r.leadId}
                    className="flex items-center justify-between"
                    style={{ gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
                  >
                    <span className="body-sm" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      {r.name || r.email || "Unknown"}
                      <span className="caption data-sm" style={{ display: "block", color: "var(--ink-muted)" }}>
                        {r.phone || "No phone number"}
                      </span>
                    </span>
                    {needsHub && !r.hubToken ? (
                      <Badge tone="warning" dot={false}>No hub yet</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={copiedIds.has(r.leadId) ? "secondary" : "primary"}
                        iconLeft={copiedIds.has(r.leadId) ? <Check size={14} /> : <Copy size={14} />}
                        disabled={!waReady}
                        onClick={() => copyFor(r)}
                      >
                        {copiedIds.has(r.leadId) ? "Copied" : "Copy message"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {confirmOpen && (
        <Modal title={`Send email to ${sendable.length} leads?`} onClose={() => setConfirmOpen(false)}>
          <p className="body" style={{ margin: 0 }}>
            Each lead gets the message with their own name and hub link filled in, and it is logged in their thread. Emails go out one at a time.
          </p>
          <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendEmails}>Send</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
