import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AppSettingsPatch } from "./appSettings";

/** Saves part of the workspace settings row. Any signed-in admin can; RLS keeps everyone else out. */
export async function updateAppSettings(patch: AppSettingsPatch): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("app_settings").update(patch).eq("id", true);
  if (error) throw new Error(error.message);
}
