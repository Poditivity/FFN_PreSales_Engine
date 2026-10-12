import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Founder } from "./types";

export async function listFounders(): Promise<Founder[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("founders")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Founder[];
}

export async function getFounder(id: string): Promise<Founder | null> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("founders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Founder | null;
}

export type FounderInput = Omit<Founder, "id" | "created_at" | "updated_at">;

export async function createFounder(input: FounderInput): Promise<Founder> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("founders").insert(input).select().single();
  if (error) throw error;
  return data as Founder;
}

export async function updateFounder(id: string, input: FounderInput): Promise<Founder> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("founders").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Founder;
}

export async function deleteFounder(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("founders").delete().eq("id", id);
  if (error) throw error;
}

// ---- Co-founders (self-referential many-to-many, see founder_co_founders) ----

export interface CoFounderSummary {
  id: string;
  name: string;
  photo_url: string | null;
}

/**
 * Full profiles of one founder's co-founders — symmetric regardless of which
 * side of the stored pair they're on. Returns the full row (not just a
 * summary) so the founder editor can show and edit their details in place,
 * not just their name.
 *
 * Fetched in two steps rather than an embedded select
 * (`founders:co_founder_id(*)`) — founder_co_founder_links is a UNION ALL
 * view, so PostgREST can't trace co_founder_id back to founders.id well
 * enough to embed through it, and silently returns no rows.
 */
export async function listCoFounders(founderId: string): Promise<Founder[]> {
  const supabase = createBrowserSupabaseClient();
  const { data: links, error: linksError } = await supabase
    .from("founder_co_founder_links")
    .select("co_founder_id")
    .eq("founder_id", founderId);
  if (linksError) throw linksError;
  const coFounderIds = (links ?? []).map((l) => l.co_founder_id);
  if (coFounderIds.length === 0) return [];

  const { data, error } = await supabase.from("founders").select("*").in("id", coFounderIds);
  if (error) throw error;
  return ((data ?? []) as Founder[]).sort((a, b) => a.name.localeCompare(b.name));
}

export async function linkCoFounders(founderIdA: string, founderIdB: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("link_co_founders", { p_a: founderIdA, p_b: founderIdB });
  if (error) throw error;
}

export async function unlinkCoFounders(founderIdA: string, founderIdB: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("unlink_co_founders", { p_a: founderIdA, p_b: founderIdB });
  if (error) throw error;
}
