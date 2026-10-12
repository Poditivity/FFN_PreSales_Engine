"use client";

import { useState } from "react";
import { Tabs } from "@/components/ffn";
import type { EmailTemplate, StageEmailRule } from "@/lib/emailEngine/types";
import type { MessageRecipient } from "@/lib/messaging/recipients";
import type { WhatsAppTemplate } from "@/lib/messaging/whatsapp";
import type { Channel } from "./Composer";
import type { MessagingTab } from "./tabs";
import { ComposePanel } from "./ComposePanel";
import { EmailTemplatesPanel } from "./EmailTemplatesPanel";
import { StageEmailRulesManager } from "./StageEmailRulesManager";
import { WhatsAppTemplatesPanel } from "./WhatsAppTemplatesPanel";

export type { MessagingTab };

/**
 * Everything about writing to leads on one page: compose, the two template
 * libraries, and the rules that send an email when a lead reaches a stage.
 */
export function MessagingHub({
  initialTab,
  initialChannel,
  initialSelected,
  recipients,
  initialEmailTemplates,
  initialWhatsAppTemplates,
  initialSystemEmails,
  initialSystemWhatsApp,
  rules,
}: {
  initialTab: MessagingTab;
  initialChannel: Channel;
  initialSelected: string[];
  recipients: MessageRecipient[];
  initialEmailTemplates: EmailTemplate[];
  initialWhatsAppTemplates: WhatsAppTemplate[];
  /** The saved rows for the messages the system sends itself (templates with a system_key). */
  initialSystemEmails: EmailTemplate[];
  initialSystemWhatsApp: WhatsAppTemplate[];
  rules: StageEmailRule[];
}) {
  const [tab, setTab] = useState<MessagingTab>(initialTab);
  const [emailTemplates, setEmailTemplates] = useState(initialEmailTemplates);
  const [whatsappTemplates, setWhatsappTemplates] = useState(initialWhatsAppTemplates);
  const [systemEmails, setSystemEmails] = useState(initialSystemEmails);
  const [systemWhatsApp, setSystemWhatsApp] = useState(initialSystemWhatsApp);

  function choose(id: string) {
    setTab(id as MessagingTab);
    // Keep the address honest so a reload or a shared link lands on the same tab.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <Tabs
        active={tab}
        onChange={choose}
        items={[
          { id: "compose", label: "Compose" },
          { id: "email", label: "Email templates", count: emailTemplates.length },
          { id: "whatsapp", label: "WhatsApp templates", count: whatsappTemplates.length },
          { id: "rules", label: "Stage rules" },
        ]}
      />

      {tab === "compose" && (
        <ComposePanel
          recipients={recipients}
          initialSelected={initialSelected}
          initialChannel={initialChannel}
          emailTemplates={emailTemplates}
          whatsappTemplates={whatsappTemplates}
          systemEmails={systemEmails}
          systemWhatsApp={systemWhatsApp}
          onEmailTemplateSaved={(saved) => setEmailTemplates((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}
      {tab === "email" && <EmailTemplatesPanel templates={emailTemplates} onChange={setEmailTemplates} systemRows={systemEmails} onSystemChange={setSystemEmails} />}
      {tab === "whatsapp" && <WhatsAppTemplatesPanel templates={whatsappTemplates} onChange={setWhatsappTemplates} systemRows={systemWhatsApp} onSystemChange={setSystemWhatsApp} />}
      {tab === "rules" && (
        <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
            Send an email automatically when a lead moves to a stage. Nothing sends for a stage until you pick a template and turn it on.
          </p>
          <StageEmailRulesManager initialRules={rules} templates={emailTemplates} />
        </div>
      )}
    </div>
  );
}
