"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ffn";
import { CallForm } from "@/components/leads/CallForm";
import { listEmailTemplates, listSystemEmailRows } from "@/lib/emailEngine/templates";
import type { EmailTemplate } from "@/lib/emailEngine/types";
import type { LeadCall } from "@/lib/leads/calls";
import type { MessageRecipient } from "@/lib/messaging/recipients";
import { listSystemWhatsAppRows, listWhatsAppTemplates, type WhatsAppTemplate } from "@/lib/messaging/whatsapp";
import { useIsClient } from "@/lib/useIsClient";
import { Composer, type Channel } from "../../messaging/Composer";
import { CallHistory } from "./CallHistory";
import { EmailThreadCard } from "./EmailThreadCard";

type Mode = "message" | "call";

/** The event the hero's "Log a call" button sends, so it can open the call form without sharing state with a server component. */
export const OPEN_CALL_EVENT = "lead:open-call-form";

/**
 * The lead's own composer, open as soon as the page loads, with the call log
 * beside it as a second mode and the history under it. Message is the same
 * composer as the Messaging page with this one lead as the only recipient.
 */
export function Communications({
  recipient,
  calls,
  currentUserId,
  isSuperAdmin,
}: {
  recipient: MessageRecipient;
  calls: LeadCall[];
  currentUserId: string | null;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const isClient = useIsClient();
  const [mode, setMode] = useState<Mode>("message");
  const [channel, setChannel] = useState<Channel>("email");
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);
  const [systemEmails, setSystemEmails] = useState<EmailTemplate[]>([]);
  const [systemWhatsApp, setSystemWhatsApp] = useState<WhatsAppTemplate[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    // The composer works without templates, so a failed load only means an empty list.
    listEmailTemplates().then(setEmailTemplates).catch(() => {});
    listWhatsAppTemplates().then(setWhatsappTemplates).catch(() => {});
    listSystemEmailRows().then(setSystemEmails).catch(() => {});
    listSystemWhatsAppRows().then(setSystemWhatsApp).catch(() => {});
  }, []);

  useEffect(() => {
    const open = () => {
      setMode("call");
      document.getElementById("compose")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(OPEN_CALL_EVENT, open);
    return () => window.removeEventListener(OPEN_CALL_EVENT, open);
  }, []);

  const name = recipient.name || recipient.email || "this lead";

  return (
    <>
      <div id="compose" style={{ scrollMarginTop: "var(--space-6)" }}>
        <Card
          title={mode === "message" ? `Write to ${name}` : `Log a call with ${name}`}
          subtitle={
            mode === "message"
              ? "Email is logged in the history below. For WhatsApp, copy the message with their name and hub link filled in, then paste it there."
              : "Record a call the moment it ends. It is counted against the stage you pick."
          }
          actions={
            <div className="dash-segment" role="group" aria-label="What to do">
              <button type="button" className="dash-segment__btn label" aria-pressed={mode === "message"} onClick={() => setMode("message")}>
                Message
              </button>
              <button type="button" className="dash-segment__btn label" aria-pressed={mode === "call"} onClick={() => setMode("call")}>
                Log a call
              </button>
            </div>
          }
        >
          {mode === "message" ? (
            <Composer
              recipients={[recipient]}
              channel={channel}
              onChannelChange={setChannel}
              emailTemplates={emailTemplates}
              whatsappTemplates={whatsappTemplates}
              systemEmails={systemEmails}
              systemWhatsApp={systemWhatsApp}
              onEmailTemplateSaved={(saved) => setEmailTemplates((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))}
              onSent={() => setRefreshKey((k) => k + 1)}
            />
          ) : isClient ? (
            <>
              {savedNote && (
                <p className="body-sm" role="status" style={{ margin: "0 0 var(--space-3)", color: "var(--success)" }}>
                  {savedNote}
                </p>
              )}
              <CallForm
                key={formKey}
                leadId={recipient.leadId}
                defaultStage={recipient.stage}
                onSaved={(draft) => {
                  setSavedNote(`Call logged as ${draft.outcome.replace(/_/g, " ")}.`);
                  setFormKey((k) => k + 1);
                  router.refresh();
                }}
              />
            </>
          ) : null}
        </Card>
      </div>
      <CallHistory leadId={recipient.leadId} stage={recipient.stage} calls={calls} currentUserId={currentUserId} isSuperAdmin={isSuperAdmin} />
      <EmailThreadCard leadId={recipient.leadId} refreshKey={refreshKey} />
    </>
  );
}
