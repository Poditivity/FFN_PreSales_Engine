import { z } from "zod";

// forms.schema is now a node/edge graph (see flowModel.ts), not a flat field
// list — Zod can't usefully constrain an arbitrary graph shape structurally,
// so it's typed loosely here and interpreted by flowModel's normalizeSchema/
// extractFields, which also tolerates the older flat-array shape.
export const formStatusSchema = z.enum(["draft", "active", "closed"]);
export type FormStatus = z.infer<typeof formStatusSchema>;

export const postSubmitActionSchema = z.enum(["message", "redirect"]);
export type PostSubmitAction = z.infer<typeof postSubmitActionSchema>;

export const formSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, numbers, hyphens only"),
  status: formStatusSchema,
  schema: z.unknown(),
  description: z.string().nullable().optional(),
  thank_you_message: z.string().nullable().optional(),
  post_submit_action: postSubmitActionSchema,
  redirect_url: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Form = z.infer<typeof formSchema>;

export const formSubmissionRowSchema = z.object({
  id: z.string().uuid(),
  form_id: z.string().uuid(),
  session_id: z.string(),
  data: z.record(z.string(), z.unknown()),
  field_timings: z.record(z.string(), z.unknown()),
  keystroke_counts: z.record(z.string(), z.number()),
  time_on_form_seconds: z.number().nullable(),
  partial: z.boolean(),
  completed: z.boolean(),
  status: z.string().nullable(),
  admin_notes: z.string().nullable(),
  rating: z.number().nullable(),
  confirmation_email_sent_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FormSubmissionRow = z.infer<typeof formSubmissionRowSchema>;
