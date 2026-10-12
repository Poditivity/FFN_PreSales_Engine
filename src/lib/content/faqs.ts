import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Faq } from "./types";

export async function listFaqs(): Promise<Faq[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Faq[];
}

export type FaqInput = Omit<Faq, "id" | "created_at" | "updated_at">;

export async function createFaq(input: FaqInput): Promise<Faq> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("faqs").insert(input).select().single();
  if (error) throw error;
  return data as Faq;
}

export async function updateFaq(id: string, input: FaqInput): Promise<Faq> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.from("faqs").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Faq;
}

export async function deleteFaq(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) throw error;
}
