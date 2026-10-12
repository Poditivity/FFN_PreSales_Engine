import { z } from "zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// A single global editable "About FFN" profile — same singleton-row shape
// as hub_settings (one row, id = true). Every field is optional: staff can
// leave any of it blank, and the corresponding hub block(s) simply omit
// whatever has nothing to show (enforced in hub-hydrate, not here).
export const ffnProfileSchema = z.object({
  id: z.boolean(),
  one_liner: z.string().nullable(),
  helps_founders_do: z.string().nullable(),
  approach: z.string().nullable(),
  differentiator: z.string().nullable(),
  founder_stages_supported: z.array(z.string()),
  startup_stages_supported: z.array(z.string()),
  founder_types: z.array(z.string()),
  industries: z.array(z.string()),
  problems_addressed: z.array(z.string()),
  support_formats: z.array(z.string()),
  credibility_founders_stat: z.string().nullable(),
  credibility_programs_stat: z.string().nullable(),
  credibility_events_stat: z.string().nullable(),
  credibility_partnerships_stat: z.string().nullable(),
  website_url: z.string().nullable(),
  updated_at: z.string(),
});
export type FfnProfile = z.infer<typeof ffnProfileSchema>;

export async function getFfnProfile(): Promise<FfnProfile> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("ffn_profile").select("*").eq("id", true).single();
  if (error) throw error;
  return data as FfnProfile;
}

export type FfnProfileInput = Omit<FfnProfile, "id" | "updated_at">;

export async function updateFfnProfile(input: FfnProfileInput): Promise<FfnProfile> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("ffn_profile").update(input).eq("id", true).select().single();
  if (error) throw error;
  return data as FfnProfile;
}
