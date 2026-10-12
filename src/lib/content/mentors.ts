import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Mentor } from "./types";

export async function listMentors(): Promise<Mentor[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("mentors")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Mentor[];
}

export type MentorInput = Omit<Mentor, "id" | "created_at" | "updated_at">;

export async function createMentor(input: MentorInput): Promise<Mentor> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("mentors").insert(input).select().single();
  if (error) throw error;
  return data as Mentor;
}

export async function updateMentor(id: string, input: MentorInput): Promise<Mentor> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("mentors").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Mentor;
}

export async function deleteMentor(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("mentors").delete().eq("id", id);
  if (error) throw error;
}
