import { z } from "zod";
import { leadStageSchema } from "@/lib/leads/schema";

export const emailTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  // Set for the messages the system sends on its own (see lib/messaging/systemTemplates);
  // null for a template the team wrote.
  system_key: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export const stageEmailRuleSchema = z.object({
  id: z.string().uuid(),
  stage: leadStageSchema,
  template_id: z.string().uuid(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type StageEmailRule = z.infer<typeof stageEmailRuleSchema>;

export const messageDirectionSchema = z.literal("outbound");
export const messageTriggerSchema = z.enum(["manual", "stage_change"]);
export const messageStatusSchema = z.enum(["pending", "sent", "failed"]);

export const leadEmailMessageSchema = z.object({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  direction: messageDirectionSchema,
  trigger: messageTriggerSchema,
  template_id: z.string().uuid().nullable(),
  stage_email_rule_id: z.string().uuid().nullable(),
  to_email: z.string().nullable(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  status: messageStatusSchema,
  error: z.string().nullable(),
  sent_by: z.string().uuid().nullable(),
  created_at: z.string(),
  sent_at: z.string().nullable(),
});
export type LeadEmailMessage = z.infer<typeof leadEmailMessageSchema>;

export const leadEmailThreadSchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  created_at: z.string(),
});
export type LeadEmailThread = z.infer<typeof leadEmailThreadSchema>;

// A single, chronologically-mergeable history entry — either a live Phase 5
// thread message, or a read-only entry surfaced from an earlier phase's own
// log (Phase 1's send-submission-email, Phase 4's hub-send). Only the
// 'lead_email_message' kind can ever be composed or resent from here; the
// others are historical record only (see thread.ts — "don't rebuild those
// senders").
export type LeadHistoryEntry =
  | ({ kind: "lead_email_message" } & LeadEmailMessage)
  | {
      kind: "submission_email";
      id: string;
      subject: string;
      to_email: string;
      status: "sent" | "failed";
      created_at: string;
    }
  | {
      kind: "hub_email";
      id: string;
      subject: string;
      to_email: string;
      status: string;
      created_at: string;
    };
