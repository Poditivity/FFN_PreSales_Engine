// The one place notification types, and their WhatsApp template mapping,
// are defined. Every edge function names a NotificationType; none of them
// know a WhatsApp template name. Adding a channel (SMS, push) means adding a
// mapping here and a channel in dispatch.ts — not touching each flow.
//
// Each `body` below is the exact text to submit for approval in Meta
// Business Manager (category: Utility, language: WHATSAPP_TEMPLATE_LANGUAGE,
// default "en"). Positional placeholders {{1}}, {{2}}… are filled, in order,
// from `params`. Meta rejects a template that starts or ends with a
// placeholder, so every body opens and closes with fixed text.

export type NotificationType =
  | "SUBMISSION_RECEIVED"
  | "ADMIN_NEW_SUBMISSION"
  | "HUB_READY"
  | "LEAD_STAGE_MESSAGE"
  | "LEAD_MANUAL_MESSAGE"
  | "ADMIN_INVITE"
  | "ADMIN_PASSWORD_RESET"
  | "ADMIN_LEAD_ESCALATION"
  | "ADMIN_DAILY_DIGEST"
  | "ADMIN_WEEKLY_DIGEST";

export interface NotificationDataMap {
  SUBMISSION_RECEIVED: { name: string; formTitle: string };
  ADMIN_NEW_SUBMISSION: { formTitle: string; submitter: string };
  HUB_READY: { name: string; trackName: string; hubUrl: string };
  LEAD_STAGE_MESSAGE: { name: string; program: string; subject: string };
  LEAD_MANUAL_MESSAGE: { name: string; program: string; subject: string };
  ADMIN_INVITE: Record<string, never>;
  ADMIN_PASSWORD_RESET: Record<string, never>;
  ADMIN_LEAD_ESCALATION: Record<string, never>;
  ADMIN_DAILY_DIGEST: Record<string, never>;
  ADMIN_WEEKLY_DIGEST: Record<string, never>;
}

export interface TemplateParam {
  value: string | null | undefined;
  /** Used when `value` is empty — WhatsApp rejects empty parameters. */
  fallback: string;
}

export interface WhatsAppTemplateSpec<D> {
  name: string;
  body: string;
  params: (data: D) => TemplateParam[];
}

type Registry = { [K in NotificationType]: WhatsAppTemplateSpec<NotificationDataMap[K]> | null };

const leadUpdate = (d: NotificationDataMap["LEAD_STAGE_MESSAGE"]): TemplateParam[] => [
  { value: d.name, fallback: "there" },
  { value: d.program, fallback: "your application" },
  { value: d.subject, fallback: "an update" },
];

export const WHATSAPP_TEMPLATES: Registry = {
  SUBMISSION_RECEIVED: {
    name: "ffn_submission_received",
    body: "Hi {{1}}, we received your application for {{2}}. Our team will review it and get back to you soon. Founders First Network",
    params: (d) => [
      { value: d.name, fallback: "there" },
      { value: d.formTitle, fallback: "Founders First Network" },
    ],
  },
  ADMIN_NEW_SUBMISSION: {
    name: "ffn_admin_new_submission",
    body: "New submission for {{1}} from {{2}}. Open the FFN admin panel to review it.",
    params: (d) => [
      { value: d.formTitle, fallback: "a form" },
      { value: d.submitter, fallback: "an applicant" },
    ],
  },
  HUB_READY: {
    name: "ffn_hub_ready",
    body: "Hi {{1}}, your personalised {{2}} hub from Founders First Network is ready. View it here: {{3}} We look forward to hearing from you.",
    params: (d) => [
      { value: d.name, fallback: "there" },
      { value: d.trackName, fallback: "FFN" },
      { value: d.hubUrl, fallback: "the link in your email" },
    ],
  },
  // Stage-triggered and manually composed lead emails carry free-form bodies
  // written by staff, which cannot be approved as a template. WhatsApp
  // carries a short notice with the subject line and points to the email.
  LEAD_STAGE_MESSAGE: {
    name: "ffn_lead_update",
    body: "Hi {{1}}, Founders First Network sent you a message about {{2}}: {{3}}. Check your email for the full message.",
    params: leadUpdate,
  },
  LEAD_MANUAL_MESSAGE: {
    name: "ffn_lead_update",
    body: "Hi {{1}}, Founders First Network sent you a message about {{2}}: {{3}}. Check your email for the full message.",
    params: leadUpdate,
  },
  // Credential-bearing links stay on email, the address the account is
  // tied to. profiles.phone is editable by any admin (profiles_update_own
  // allows is_admin()), so sending a reset or invite link to it would let
  // one admin redirect another's recovery link to their own phone.
  ADMIN_INVITE: null,
  ADMIN_PASSWORD_RESET: null,
  // Team alerts reach the team in Google Chat and by email. WhatsApp is for
  // applicants and the new-submission notice, so none of these has a template.
  ADMIN_LEAD_ESCALATION: null,
  ADMIN_DAILY_DIGEST: null,
  ADMIN_WEEKLY_DIGEST: null,
};

export function whatsappTemplateFor<T extends NotificationType>(
  type: T,
): WhatsAppTemplateSpec<NotificationDataMap[T]> | null {
  return WHATSAPP_TEMPLATES[type] as WhatsAppTemplateSpec<NotificationDataMap[T]> | null;
}
