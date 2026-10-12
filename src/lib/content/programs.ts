import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Program } from "./types";

export async function listPrograms(): Promise<Program[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Program[];
}

export type ProgramInput = Omit<Program, "id" | "created_at" | "updated_at">;

export async function createProgram(input: ProgramInput): Promise<Program> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("programs").insert(input).select().single();
  if (error) throw error;
  return data as Program;
}

export async function updateProgram(id: string, input: ProgramInput): Promise<Program> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("programs").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Program;
}

export async function deleteProgram(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("programs").delete().eq("id", id);
  if (error) throw error;
}
