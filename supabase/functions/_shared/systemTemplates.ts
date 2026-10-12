// The messages the system sends on its own, as editable templates. Pure
// TypeScript with no imports, so the admin app (the editors and "Reset to
// default"), the mail edge functions and Vitest all read the same definitions.
//
// Each one lives as a row in email_templates or whatsapp_templates with a
// system_key, beside the templates the team writes. The row is what gets sent.
// The default text here is the fallback when the row is missing or blank, and
// what "Reset to default" writes back, so a send never fails for lack of a
// template.
//
// What stays out on purpose: password reset codes and team invitations carry a
// credential, and the digests and escalation alerts are built from live
// numbers. None of those is free text, so none is a template.

export interface SystemVariable {
  token: string;
  key: string;
  label: string;
  sample: string;
}

export type SystemEmailKey = "submission_received" | "admin_new_submission" | "hub_ready";
export type SystemWhatsAppKey = "hub_link_message" | "submission_received" | "admin_new_submission" | "hub_ready" | "lead_update";

export interface SystemEmailDef {
  key: SystemEmailKey;
  name: string;
  /** One line for the team: when this goes out and to whom. */
  usedWhen: string;
  variables: readonly SystemVariable[];
  /** Variables that may be empty. A paragraph that uses one with no value is left out. */
  optional: readonly string[];
  subject: string;
  /** HTML from the visual editor. */
  body: string;
}

export interface SystemWhatsAppDef {
  key: SystemWhatsAppKey;
  name: string;
  /** The template name to register with Meta when WhatsApp is connected. Absent for a message that is only copied by hand. */
  metaName?: string;
  usedWhen: string;
  variables: readonly SystemVariable[];
  body: string;
}

const v = (key: string, label: string, sample: string): SystemVariable => ({ token: `{{${key}}}`, key, label, sample });

export const SYSTEM_EMAIL_TEMPLATES: Record<SystemEmailKey, SystemEmailDef> = {
  submission_received: {
    key: "submission_received",
    name: "Form submission: confirmation to the applicant",
    usedWhen: "Sent to the applicant right after they submit a form.",
    variables: [
      v("name", "Name", "Ananya"),
      v("form_title", "Form title", "Validation Lab application"),
      v("answers", "Their answers", "A table of the answers they gave"),
    ],
    optional: [],
    subject: 'Your submission for "{{form_title}}" has been received',
    body:
      "<p>Hi {{name}},</p>" +
      "<p>We have received your submission for <strong>{{form_title}}</strong>. We will review it and get back to you soon.</p>" +
      "<h3>Your answers</h3>" +
      "<p>{{answers}}</p>" +
      "<p>The Founders First Network team</p>",
  },
  admin_new_submission: {
    key: "admin_new_submission",
    name: "Form submission: notice to the team",
    usedWhen: "Sent to every admin and notification address when a form is submitted.",
    variables: [
      v("form_title", "Form title", "Validation Lab application"),
      v("submitter", "Who submitted", "Ananya Rao"),
      v("submitter_email", "Their email", "ananya@example.com"),
      v("answers", "Their answers", "A table of the answers they gave"),
    ],
    optional: ["submitter_email"],
    subject: "New submission: {{form_title}}",
    body:
      "<h2>{{form_title}}</h2>" +
      "<p>From: <strong>{{submitter}}</strong></p>" +
      "<h3>Submitted answers</h3>" +
      "<p>{{answers}}</p>",
  },
  hub_ready: {
    key: "hub_ready",
    name: "Hub: link to the applicant",
    usedWhen: "Sent to the applicant when you send or resend their hub.",
    variables: [
      v("name", "Name", "Ananya"),
      v("track", "Track", "Validation Lab"),
      v("hub_link", "Hub link", "https://example.com/hub/abc123"),
      v("booking_link", "Booking link", "https://cal.com/ffn/intro"),
    ],
    optional: ["booking_link"],
    subject: "Your {{track}} hub is ready",
    body:
      "<p>Hi {{name}},</p>" +
      "<p>We have put together a personalised page for the <strong>{{track}}</strong> track, with the founders, case studies and more that are relevant to you.</p>" +
      '<p><a href="https://{{hub_link}}">View your hub</a></p>' +
      '<p>Once you have had a look, you can also <a href="https://{{booking_link}}">book time with us</a>.</p>' +
      "<p>The Founders First Network team</p>",
  },
};

// WhatsApp is not connected to Meta yet, so none of these sends by itself and all
// of them are editable. The hub link message is the one in use: it is what Copy
// WhatsApp message fills in. When WhatsApp is connected, Meta has to approve each
// text, and each one that goes out through Meta (it has a metaName) should be made
// non-editable then. The Meta-approved texts are in ./notifications/templates.ts.
export const SYSTEM_WHATSAPP_TEMPLATES: Record<SystemWhatsAppKey, SystemWhatsAppDef> = {
  hub_link_message: {
    key: "hub_link_message",
    name: "Hub link message",
    usedWhen: "Filled in when you use Copy WhatsApp message on a hub or a lead, then pasted into WhatsApp by you.",
    variables: [v("name", "Name", "Ananya"), v("hub_link", "Hub link", "https://example.com/hub/abc123")],
    body: "Hi {{name}}, here is your personal Founders First Network hub: {{hub_link}}",
  },
  submission_received: {
    key: "submission_received",
    name: "Form submission: confirmation to the applicant",
    metaName: "ffn_submission_received",
    usedWhen: "The WhatsApp message for an applicant who has just submitted a form.",
    variables: [v("name", "Name", "Ananya"), v("form_title", "Form title", "Validation Lab application")],
    body: "Hi {{name}}, we have received your application for {{form_title}}. Our team will review it and get back to you soon. Founders First Network",
  },
  admin_new_submission: {
    key: "admin_new_submission",
    name: "Form submission: notice to the team",
    metaName: "ffn_admin_new_submission",
    usedWhen: "The WhatsApp message to team members when a form is submitted.",
    variables: [v("form_title", "Form title", "Validation Lab application"), v("submitter", "Who submitted", "Ananya Rao")],
    body: "New submission for {{form_title}} from {{submitter}}. Open the FFN admin panel to review it.",
  },
  hub_ready: {
    key: "hub_ready",
    name: "Hub: link to the applicant",
    metaName: "ffn_hub_ready",
    usedWhen: "The WhatsApp message to an applicant when their hub is sent.",
    variables: [v("name", "Name", "Ananya"), v("track", "Track", "Validation Lab"), v("hub_link", "Hub link", "https://example.com/hub/abc123")],
    body: "Hi {{name}}, your personalised {{track}} hub from Founders First Network is ready. View it here: {{hub_link}} We look forward to hearing from you.",
  },
  lead_update: {
    key: "lead_update",
    name: "Email sent to a lead",
    metaName: "ffn_lead_update",
    usedWhen: "The WhatsApp notice that goes with a stage email or a manual email to a lead.",
    variables: [v("name", "Name", "Ananya"), v("program", "Program", "Validation Lab"), v("subject", "Email subject", "Next steps")],
    body: "Hi {{name}}, Founders First Network sent you a message about {{program}}: {{subject}}. Check your email for the full message.",
  },
};

export const SYSTEM_EMAIL_KEYS = Object.keys(SYSTEM_EMAIL_TEMPLATES) as SystemEmailKey[];

export function systemEmailDef(key: string | null | undefined): SystemEmailDef | null {
  return key && key in SYSTEM_EMAIL_TEMPLATES ? SYSTEM_EMAIL_TEMPLATES[key as SystemEmailKey] : null;
}

export function systemWhatsAppDef(key: string | null | undefined): SystemWhatsAppDef | null {
  return key && key in SYSTEM_WHATSAPP_TEMPLATES ? SYSTEM_WHATSAPP_TEMPLATES[key as SystemWhatsAppKey] : null;
}
