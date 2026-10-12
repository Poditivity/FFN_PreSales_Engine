import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { HubModule, HubTemplate } from "./types";

export async function listHubTemplates(): Promise<HubTemplate[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("hub_templates").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HubTemplate[];
}

export async function listHubTemplatesForTrack(trackId: string): Promise<HubTemplate[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("hub_templates")
    .select("*")
    .eq("track_id", trackId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HubTemplate[];
}

export interface HubTemplateInput {
  track_id: string;
  name: string;
  modules: HubModule[];
}

export async function createHubTemplate(input: HubTemplateInput): Promise<HubTemplate> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("hub_templates").insert(input).select().single();
  if (error) throw error;
  return data as HubTemplate;
}

export async function updateHubTemplate(id: string, input: HubTemplateInput): Promise<HubTemplate> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("hub_templates").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as HubTemplate;
}

export async function deleteHubTemplate(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("hub_templates").delete().eq("id", id);
  if (error) throw error;
}
