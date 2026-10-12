import { Alert } from "@/components/ffn";
import type { EmailTemplate, StageEmailRule } from "@/lib/emailEngine/types";
import { loadRecipients } from "@/lib/messaging/recipients";
import type { WhatsAppTemplate } from "@/lib/messaging/whatsapp";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Channel } from "./Composer";
import { MessagingHub } from "./MessagingHub";
import { MESSAGING_TABS, type MessagingTab } from "./tabs";

export default async function MessagingPage({ searchParams }: PageProps<"/admin/messaging">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tabParam = one(params.tab);
  const tab: MessagingTab = MESSAGING_TABS.includes(tabParam as MessagingTab) ? (tabParam as MessagingTab) : "compose";
  const channel: Channel = one(params.channel) === "whatsapp" ? "whatsapp" : "email";
  const lead = one(params.lead);

  const supabase = await createServerSupabaseClient();
  const [{ recipients, error: recipientsError }, emailResult, whatsappResult, rulesResult] = await Promise.all([
    loadRecipients(supabase),
    supabase.from("email_templates").select("*").order("name", { ascending: true }),
    supabase.from("whatsapp_templates").select("*").order("name", { ascending: true }),
    supabase.from("stage_email_rules").select("*"),
  ]);

  // A missing table (the migration has not run yet) must not take the page down:
  // the tab simply starts empty and creating a template reports the real error.
  // Templates with a system_key are the messages the system sends itself. They are
  // edited in their own section and are also offered, marked "(system)", when composing.
  const emailRows = (emailResult.data ?? []) as EmailTemplate[];
  const whatsappRows = (whatsappResult.data ?? []) as WhatsAppTemplate[];

  const errors = [recipientsError, emailResult.error?.message, rulesResult.error?.message].filter(Boolean);

  return (
    <div>
      <h1 className="h1">Messaging</h1>
      <p className="body-sm" style={{ color: "var(--ink-muted)", marginTop: "var(--space-1)" }}>
        Write to leads by email or WhatsApp, keep your templates, and set which stage sends what.
      </p>
      {errors.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <Alert tone="danger" title="Some data did not load">
            {errors.join(" ")}
          </Alert>
        </div>
      )}
      <div style={{ marginTop: "var(--space-6)" }}>
        <MessagingHub
          initialTab={tab}
          initialChannel={channel}
          initialSelected={lead ? [lead] : []}
          recipients={recipients}
          initialEmailTemplates={emailRows.filter((t) => !t.system_key)}
          initialWhatsAppTemplates={whatsappRows.filter((t) => !t.system_key)}
          initialSystemEmails={emailRows.filter((t) => t.system_key)}
          initialSystemWhatsApp={whatsappRows.filter((t) => t.system_key)}
          rules={(rulesResult.data ?? []) as StageEmailRule[]}
        />
      </div>
    </div>
  );
}
