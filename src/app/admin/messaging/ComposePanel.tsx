"use client";

import { Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Checkbox, Input, Select, StageBadge } from "@/components/ffn";
import type { EmailTemplate } from "@/lib/emailEngine/types";
import { ALL_LEAD_STAGES, type LeadStage } from "@/lib/leads/schema";
import type { MessageRecipient } from "@/lib/messaging/recipients";
import type { WhatsAppTemplate } from "@/lib/messaging/whatsapp";
import { Composer, type Channel } from "./Composer";

// A long list is cut off here and the search or stage filter narrows it, so the
// picker stays quick with thousands of leads. Select all still takes every match.
const SHOWN = 100;

export function ComposePanel({
  recipients,
  initialSelected,
  initialChannel,
  emailTemplates,
  whatsappTemplates,
  systemEmails,
  systemWhatsApp,
  onEmailTemplateSaved,
}: {
  recipients: MessageRecipient[];
  initialSelected: string[];
  initialChannel: Channel;
  emailTemplates: EmailTemplate[];
  whatsappTemplates: WhatsAppTemplate[];
  systemEmails: EmailTemplate[];
  systemWhatsApp: WhatsAppTemplate[];
  onEmailTemplateSaved: (template: EmailTemplate) => void;
}) {
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"" | LeadStage>("");
  const [formId, setFormId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));

  const reachable = (r: MessageRecipient) => (channel === "email" ? !!r.email : !!r.phone);

  // Only forms that have leads are offered, and the menu is left out when there is just one.
  const forms = useMemo(() => {
    const map = new Map<string, string>();
    recipients.forEach((r) => map.set(r.formId, r.programTitle));
    return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [recipients]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recipients.filter((r) => {
      if (stage && r.stage !== stage) return false;
      if (formId && r.formId !== formId) return false;
      if (term && ![r.name, r.email, r.phone, r.programTitle].some((v) => v.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [recipients, search, stage, formId]);

  const chosen = useMemo(() => recipients.filter((r) => selected.has(r.leadId)), [recipients, selected]);
  const selectable = filtered.filter(reachable);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.leadId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectable.forEach((r) => next.delete(r.leadId));
      else selectable.forEach((r) => next.add(r.leadId));
      return next;
    });
  }

  return (
    <div className="msg-compose">
      <section className="msg-card msg-picker" style={{ padding: 0, overflow: "hidden" }} aria-label="Choose leads">
        <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border)" }} className="flex flex-col">
          <div className="flex items-center" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <Users size={16} strokeWidth={1.75} aria-hidden style={{ color: "var(--ink-subtle)" }} />
            <span className="label">Leads</span>
            <span className="data-sm" style={{ marginLeft: "auto", color: "var(--ink-muted)" }}>
              {selected.size} chosen
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <Input
              size="sm"
              aria-label="Search leads"
              placeholder="Name, email or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "var(--space-8)" }}
            />
            <Search
              size={14}
              strokeWidth={1.75}
              aria-hidden
              style={{ position: "absolute", left: "var(--space-3)", top: "50%", transform: "translateY(-50%)", color: "var(--ink-subtle)", pointerEvents: "none" }}
            />
          </div>
          {forms.length > 1 && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <Select
                size="sm"
                aria-label="Filter by form"
                value={formId}
                options={[{ value: "", label: "All forms" }, ...forms.map((f) => ({ value: f.id, label: f.title }))]}
                onChange={(e) => setFormId(e.target.value)}
              />
            </div>
          )}
          <div style={{ marginTop: "var(--space-2)" }}>
            <Select
              size="sm"
              aria-label="Filter by stage"
              value={stage}
              options={[{ value: "", label: "All stages" }, ...ALL_LEAD_STAGES.map((s) => ({ value: s.id, label: s.label }))]}
              onChange={(e) => setStage(e.target.value as "" | LeadStage)}
            />
          </div>
        </div>

        {selectable.length > 0 && (
          <div style={{ padding: "var(--space-2) var(--space-4)", borderBottom: "1px solid var(--border)", background: "var(--surface-sunken)" }}>
            <Checkbox
              label={<span className="caption">{allSelected ? "Clear these" : `Choose all ${selectable.length} with ${channel === "email" ? "an email" : "a phone number"}`}</span>}
              checked={allSelected}
              onChange={toggleAll}
            />
          </div>
        )}

        {/* relative: the visually hidden checkboxes are absolutely placed and would otherwise escape this scroller and stretch the page. */}
        <div style={{ position: "relative", maxHeight: "min(60vh, 520px)", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <p className="body-sm" style={{ padding: "var(--space-6)", margin: 0, textAlign: "center", color: "var(--ink-muted)" }}>
              {recipients.length === 0 ? "No leads yet." : "No leads match."}
            </p>
          ) : (
            filtered.slice(0, SHOWN).map((r) => {
              const ok = reachable(r);
              return (
                <div
                  key={r.leadId}
                  className="flex items-center"
                  style={{
                    gap: "var(--space-3)",
                    padding: "var(--space-2) var(--space-4)",
                    borderBottom: "1px solid var(--border)",
                    background: selected.has(r.leadId) ? "var(--surface-selected)" : undefined,
                    opacity: ok ? 1 : 0.6,
                  }}
                >
                  <Checkbox
                    label={<span className="ffn-sr">Choose {r.name || r.email || "lead"}</span>}
                    checked={selected.has(r.leadId)}
                    onChange={() => toggle(r.leadId)}
                  />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="body-sm" style={{ display: "block", overflowWrap: "anywhere" }}>
                      {r.name || r.email || "Unknown"}
                    </span>
                    <span className="caption" style={{ display: "block", color: "var(--ink-muted)", overflowWrap: "anywhere" }}>
                      {ok ? (channel === "email" ? r.email : r.phone) : channel === "email" ? "No email" : "No phone"}
                    </span>
                  </span>
                  <StageBadge stage={r.stage} />
                </div>
              );
            })
          )}
          {filtered.length > SHOWN && (
            <p className="caption" style={{ padding: "var(--space-3) var(--space-4)", margin: 0, color: "var(--ink-muted)" }}>
              Showing the first {SHOWN} of {filtered.length}. Search or pick a stage to narrow the list.
            </p>
          )}
        </div>
      </section>

      <section className="msg-card" aria-label="Write a message">
        <Composer
          recipients={chosen}
          channel={channel}
          onChannelChange={setChannel}
          emailTemplates={emailTemplates}
          whatsappTemplates={whatsappTemplates}
          systemEmails={systemEmails}
          systemWhatsApp={systemWhatsApp}
          onEmailTemplateSaved={onEmailTemplateSaved}
        />
      </section>
    </div>
  );
}
