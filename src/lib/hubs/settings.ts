import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * The booking link and call to action shown in the hub-ready email and on the
 * closing block of every public hub. The block is a button to the booking link;
 * the person to contact is the team the email comes from, so there are no
 * contact details here.
 */
export interface HubSettings {
  booking_url: string | null;
  cta_text: string | null;
}

export const CTA_TEXT_MAX = 60;

/** The sentence to show when a booking link is not usable, or null when it is (or is empty). */
export function validateBookingUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? null : "Use a link that starts with https://.";
  } catch {
    return "Enter a full link, for example https://cal.com/ffn/intro.";
  }
}

export async function getHubSettings(): Promise<HubSettings> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("hub_settings").select("booking_url, cta_text").eq("id", true).single();
  if (error) throw error;
  return data as HubSettings;
}

export type HubSettingsInput = Partial<HubSettings>;

export async function updateHubSettings(input: HubSettingsInput): Promise<void> {
  const problem = validateBookingUrl(input.booking_url ?? "");
  if (problem) throw new Error(problem);
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase
    .from("hub_settings")
    .update({
      booking_url: input.booking_url?.trim() || null,
      cta_text: input.cta_text?.trim() || null,
    })
    .eq("id", true);
  if (error) throw error;
}
