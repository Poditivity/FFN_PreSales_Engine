import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Track } from "./types";

export async function listTracks(): Promise<Track[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("tracks").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Track[];
}

export interface TrackInput {
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export async function createTrack(input: TrackInput): Promise<Track> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("tracks").insert(input).select().single();
  if (error) throw error;
  return data as Track;
}

export async function updateTrack(id: string, input: TrackInput): Promise<Track> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("tracks").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Track;
}

export async function deleteTrack(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("tracks").delete().eq("id", id);
  if (error) throw error;
}
