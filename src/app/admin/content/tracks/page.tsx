import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/content/types";
import { TracksManager } from "./TracksManager";

export default async function TracksPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("tracks").select("*").order("sort_order", { ascending: true });

  return (
    <div>
      {error && (
        <p className="body-sm" style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }}>
          {error.message}
        </p>
      )}
      <TracksManager initialTracks={(data ?? []) as Track[]} />
    </div>
  );
}
