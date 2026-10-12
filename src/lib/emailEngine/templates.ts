import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { EmailTemplate } from "./types";

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("email_templates").select("*").order("name", { ascending: true });
  if (error) throw error;
  // The system messages are listed separately (listSystemEmailRows) so the composer can mark them.
  return ((data ?? []) as EmailTemplate[]).filter((t) => !t.system_key);
}

/** The saved wording of the messages the system sends itself. A message with no row is on its default. */
export async function listSystemEmailRows(): Promise<EmailTemplate[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("email_templates").select("*").not("system_key", "is", null);
  if (error) throw error;
  return (data ?? []) as EmailTemplate[];
}

export type EmailTemplateInput = Pick<EmailTemplate, "name" | "subject" | "body">;

export async function createEmailTemplate(input: EmailTemplateInput): Promise<EmailTemplate> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("email_templates").insert(input).select().single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function updateEmailTemplate(id: string, input: EmailTemplateInput): Promise<EmailTemplate> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("email_templates").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  if (error) throw error;
}
