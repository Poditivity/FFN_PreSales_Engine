import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Mentor, Track } from "@/lib/content/types";
import { MentorsManager } from "./MentorsManager";

export default async function MentorsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: mentors, error }, { data: tracks }] = await Promise.all([
    supabase.from("mentors").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabase.from("tracks").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <MentorsManager initialMentors={(mentors ?? []) as Mentor[]} tracks={(tracks ?? []) as Track[]} />
    </div>
  );
}
