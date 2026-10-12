import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Testimonial } from "./types";

const TESTIMONIAL_SELECT = "*, founders:founder_id(id, name)";

export async function listTestimonials(): Promise<Testimonial[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select(TESTIMONIAL_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Testimonial[];
}

export type TestimonialInput = Pick<
  Testimonial,
  "founder_id" | "testimonial_quote" | "video_link" | "audience" | "featured" | "visibility" | "sort_order"
>;

export async function createTestimonial(input: TestimonialInput): Promise<Testimonial> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("testimonials")
    .insert(input)
    .select(TESTIMONIAL_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Testimonial;
}

export async function updateTestimonial(id: string, input: TestimonialInput): Promise<Testimonial> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("testimonials")
    .update(input)
    .eq("id", id)
    .select(TESTIMONIAL_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Testimonial;
}

export async function deleteTestimonial(id: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("testimonials").delete().eq("id", id);
  if (error) throw error;
}
