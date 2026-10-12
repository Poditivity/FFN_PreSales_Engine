// The messages the system sends on its own, as editable templates. The
// definitions and default wording live beside the edge functions that send them
// so the app and the mailer can never disagree; this file adds the saving.
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { EmailTemplate } from "@/lib/emailEngine/types";
import type { WhatsAppTemplate } from "./whatsapp";
import {
  SYSTEM_EMAIL_TEMPLATES,
  SYSTEM_WHATSAPP_TEMPLATES,
  type SystemEmailKey,
  type SystemVariable,
  type SystemWhatsAppKey,
} from "../../../supabase/functions/_shared/systemTemplates";

export * from "../../../supabase/functions/_shared/systemTemplates";

/** Sample values for the editor's preview. The answers table is built at send time, so it has no sample. */
export function sampleValues(variables: readonly SystemVariable[]): Record<string, string> {
  return Object.fromEntries(variables.filter((v) => v.key !== "answers").map((v) => [v.key, v.sample]));
}

/** Saves the team's wording for a system email. The first save creates its row. */
export async function saveSystemEmail(
  key: SystemEmailKey,
  existing: EmailTemplate | null,
  input: { subject: string; body: string },
): Promise<EmailTemplate> {
  const supabase = createBrowserSupabaseClient();
  const query = existing
    ? supabase.from("email_templates").update(input).eq("id", existing.id)
    : supabase.from("email_templates").insert({ ...input, name: SYSTEM_EMAIL_TEMPLATES[key].name, system_key: key });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data as EmailTemplate;
}

/** Back to the default wording: the row goes, and the built-in text is used again. */
export async function resetSystemEmail(row: EmailTemplate): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("email_templates").delete().eq("id", row.id);
  if (error) throw error;
}

export async function saveSystemWhatsApp(
  key: SystemWhatsAppKey,
  existing: WhatsAppTemplate | null,
  body: string,
): Promise<WhatsAppTemplate> {
  const supabase = createBrowserSupabaseClient();
  const query = existing
    ? supabase.from("whatsapp_templates").update({ body }).eq("id", existing.id)
    : supabase.from("whatsapp_templates").insert({ body, name: SYSTEM_WHATSAPP_TEMPLATES[key].name, system_key: key });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data as WhatsAppTemplate;
}

export async function resetSystemWhatsApp(row: WhatsAppTemplate): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("whatsapp_templates").delete().eq("id", row.id);
  if (error) throw error;
}
