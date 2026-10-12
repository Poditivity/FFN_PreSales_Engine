import { normalizePhone } from "../../../supabase/functions/_shared/notifications/phone";
import { hubUrl } from "@/lib/hubs/hubs";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SYSTEM_WHATSAPP_TEMPLATES } from "./systemTemplates";
import { personalizeText, usesHubLink } from "./text";

export { usesHubLink };

/** WhatsApp's own ceiling on the text of one message is far higher; this keeps a message readable in a chat bubble. */
export const WA_MAX_CHARS = 1000;
export const WA_WARN_CHARS = 800;

// FFN's leads are in India, so a number typed without a country code is read as +91.
const DEFAULT_COUNTRY_CODE = "91";

export interface WhatsAppTemplate {
  id: string;
  name: string;
  body: string;
  /** Set for the messages the system fills in itself; null for a template the team wrote. */
  system_key?: string | null;
  created_at: string;
  updated_at: string;
}

export type WhatsAppTemplateInput = Pick<WhatsAppTemplate, "name" | "body">;

/** A wa.me link that opens a chat with the message filled in, or null when the number cannot be used. */
export function whatsappLink(phone: string, text: string): string | null {
  const normalized = normalizePhone(phone, DEFAULT_COUNTRY_CODE);
  if (!normalized.ok) return null;
  return `https://wa.me/${normalized.digits}?text=${encodeURIComponent(text)}`;
}

/** What a lead is greeted with when staff copy a hub message and nobody has edited the Hub link message. */
export const DEFAULT_HUB_MESSAGE = SYSTEM_WHATSAPP_TEMPLATES.hub_link_message.body;

/** The Hub link message as the team has it on the Messaging page, or the default when it has not been edited. */
export async function loadHubMessage(): Promise<string> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.from("whatsapp_templates").select("body").eq("system_key", "hub_link_message").maybeSingle();
    return data?.body?.trim() ? data.body : DEFAULT_HUB_MESSAGE;
  } catch {
    return DEFAULT_HUB_MESSAGE;
  }
}

/**
 * A WhatsApp message with this lead's details filled in: their name and, where
 * they have a hub, the link to it. Staff paste the result into WhatsApp
 * themselves. Run in the browser, because the hub link carries this site's address.
 */
export function whatsappMessage(text: string, name: string | null | undefined, hubToken: string | null | undefined): string {
  return personalizeText(text, name, { hub_link: hubToken ? hubUrl(hubToken) : "" });
}

/** Copies text to the clipboard. Returns false when the browser does not allow it. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function listWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("whatsapp_templates").select("*").order("name", { ascending: true });
  if (error) throw error;
  // The system messages are listed separately (listSystemWhatsAppRows) so the composer can mark them.
  return ((data ?? []) as WhatsAppTemplate[]).filter((t) => !t.system_key);
}

/** The saved wording of the messages the system sends itself. A message with no row is on its default. */
export async function listSystemWhatsAppRows(): Promise<WhatsAppTemplate[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("whatsapp_templates").select("*").not("system_key", "is", null);
  if (error) throw error;
  return (data ?? []) as WhatsAppTemplate[];
}

export async function createWhatsAppTemplate(input: WhatsAppTemplateInput): Promise<WhatsAppTemplate> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("whatsapp_templates").insert(input).select().single();
  if (error) throw error;
  return data as WhatsAppTemplate;
}

export async function updateWhatsAppTemplate(id: string, input: WhatsAppTemplateInput): Promise<WhatsAppTemplate> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("whatsapp_templates").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as WhatsAppTemplate;
}

export async function deleteWhatsAppTemplate(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
  if (error) throw error;
}
