import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Testimonial, Track } from "@/lib/content/types";
import { TestimonialsManager } from "./TestimonialsManager";

export default async function TestimonialsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: testimonials, error }, { data: founders }, { data: tracks }] = await Promise.all([
    supabase
      .from("testimonials")
      .select("*, founders:founder_id(id, name)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("founders").select("id, name, startup_name").order("name", { ascending: true }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <TestimonialsManager
        initialTestimonials={(testimonials ?? []) as unknown as Testimonial[]}
        founders={(founders ?? []) as { id: string; name: string; startup_name: string | null }[]}
        tracks={(tracks ?? []) as Track[]}
      />
    </div>
  );
}
